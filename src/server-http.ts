import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { runWithApiKey } from './auth-context.js';
import { registerTools } from './register-tools.js';
import { VERSION } from './version.js';

/**
 * 원격(웹) MCP 서버 — Streamable HTTP + Bearer 키 패스스루 (Phase 1 MVP)
 *
 * - 단일 `/mcp` 엔드포인트 (POST/GET/DELETE), 세션은 Mcp-Session-Id 헤더 (stateful)
 * - 클라이언트가 `Authorization: Bearer yrk_...`로 자기 yeorot 키를 전달하면
 *   요청마다 AsyncLocalStorage(runWithApiKey)로 격리되어 yeorotFetch까지 전달된다.
 * - 세션은 최초 키에 바인딩 — 같은 세션을 다른 키로 재사용하면 401.
 */

const allowedHosts = config.MCP_ALLOWED_HOSTS
  ? config.MCP_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
  : ['127.0.0.1', `127.0.0.1:${config.PORT}`, 'localhost', `localhost:${config.PORT}`];
const allowedOrigins = config.MCP_ALLOWED_ORIGINS
  ? config.MCP_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : undefined;

// 세션별 transport / 키 바인딩 (단일 인스턴스 stateful — 확장 시 Redis 등으로 교체)
const transports = new Map<string, StreamableHTTPServerTransport>();
const sessionKeys = new Map<string, string>();

// yrk_ API 키 또는 onl1d OAuth 토큰 — 둘 다 yeorot 백엔드가 검증하므로 그대로 패스스루
function extractBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

// RFC 9728 Protected Resource Metadata — Claude의 OAuth 디스커버리 진입점
const prmDocument =
  config.MCP_RESOURCE_URL && config.MCP_AUTH_SERVER_URL
    ? {
        resource: config.MCP_RESOURCE_URL,
        authorization_servers: [config.MCP_AUTH_SERVER_URL],
        bearer_methods_supported: ['header'],
        scopes_supported: ['openid', 'profile', 'email'],
      }
    : null;

function unauthorized(res: express.Response, message: string): void {
  const challenge = prmDocument
    ? `Bearer realm="yeorot-mcp", resource_metadata="${new URL(config.MCP_RESOURCE_URL!).origin}/.well-known/oauth-protected-resource"`
    : 'Bearer realm="yeorot-mcp"';
  res
    .status(401)
    .set('WWW-Authenticate', challenge)
    .json({
      jsonrpc: '2.0',
      error: { code: -32001, message },
      id: null,
    });
}

const app = express();
app.use(express.json());
app.use(cors({ exposedHeaders: ['Mcp-Session-Id'], allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'MCP-Protocol-Version'] }));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', version: VERSION });
});

// 브라우저로 루트 접속 시 연결 방법 안내로 리다이렉트 (mcp.linear.app → linear.app/docs/mcp 방식)
// 임시: README 원격 연결 섹션. yeorot.cloud/docs/mcp 페이지가 생기면 이 URL만 교체.
const DOCS_REDIRECT_URL = encodeURI('https://github.com/waryongc/mcp#원격-서버로-연결하기-추천');
app.get('/', (_req, res) => {
  res.redirect(302, DOCS_REDIRECT_URL);
});

if (prmDocument) {
  // 루트 + 경로 변형(RFC 9728 §3: resource가 /mcp 경로를 가지면 이 경로로 조회하는 클라이언트도 있음)
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json(prmDocument);
  });
  app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
    res.json(prmDocument);
  });
}

app.post('/mcp', (req, res) => {
  void (async () => {
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      unauthorized(res, '인증이 필요합니다 — Authorization: Bearer 헤더(yeorot API 키 또는 OAuth 토큰)를 보내세요');
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      if (sessionKeys.get(sessionId) !== apiKey) {
        unauthorized(res, '세션이 다른 API 키로 시작되었습니다');
        return;
      }
      transport = transports.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
          sessionKeys.set(sid, apiKey);
        },
        enableDnsRebindingProtection: true,
        allowedHosts,
        ...(allowedOrigins ? { allowedOrigins } : {}),
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
          sessionKeys.delete(sid);
        }
      };
      const server = new McpServer({ name: 'yeorot-mcp', version: VERSION });
      registerTools(server);
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: 유효한 세션 ID가 없습니다' },
        id: null,
      });
      return;
    }

    await runWithApiKey(apiKey, () => transport.handleRequest(req, res, req.body));
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[yeorot-mcp] /mcp 처리 오류: ${message}\n`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: '내부 서버 오류' },
        id: null,
      });
    }
  });
});

// GET(SSE 스트림) / DELETE(세션 종료) — 기존 세션 필수
function handleSessionRequest(req: express.Request, res: express.Response): void {
  void (async () => {
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      unauthorized(res, '인증이 필요합니다 — Authorization: Bearer 헤더(yeorot API 키 또는 OAuth 토큰)를 보내세요');
      return;
    }
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).send('유효한 세션 ID가 없습니다');
      return;
    }
    if (sessionKeys.get(sessionId) !== apiKey) {
      unauthorized(res, '세션이 다른 API 키로 시작되었습니다');
      return;
    }
    const transport = transports.get(sessionId)!;
    await runWithApiKey(apiKey, () => transport.handleRequest(req, res));
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[yeorot-mcp] /mcp 세션 요청 오류: ${message}\n`);
    if (!res.headersSent) res.status(500).send('내부 서버 오류');
  });
}

app.get('/mcp', handleSessionRequest);
app.delete('/mcp', handleSessionRequest);

app.listen(config.PORT, () => {
  process.stderr.write(`[yeorot-mcp] v${VERSION} HTTP 서버 시작 — 포트 ${config.PORT}, /mcp\n`);
});
