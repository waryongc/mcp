# 원격(웹) MCP 서버 전환 계획

> 로컬 stdio MCP 서버(`yeorot-mcp`)를 **웹에 띄워 여러 사용자가 원격 접속**하는 서버로 확장하기 위한 설계 문서.
> GitHub·Linear·Atlassian 등이 제공하는 "Remote MCP Server"와 같은 형태가 목표.

---

## 1. 현재 구조 (As-Is)

```
Claude Desktop ──spawn──> node index.mjs (자식 프로세스)
                          stdio(stdin/stdout)로 JSON-RPC
                          YEOROT_API_KEY (.env 단일 키) ──> yeorot API
```

- **전송**: `StdioServerTransport` — Claude가 로컬에서 프로세스를 직접 띄움
- **인증**: `.env`의 `YEOROT_API_KEY` 단일 값을 전역 `config` 싱글톤(`src/config.ts`)이 보유 → 모든 `yeorotFetch` 호출이 이 키 하나를 사용
- **배포**: 인스톨러가 사용자 PC마다 복사 → **1 설치 = 1 사용자 키**

→ 한 명이 자기 PC에서만 쓰는 구조. 모두가 접속하려면 서버를 한 곳에 띄우고, **사용자별 키를 요청마다 분리**해야 한다.

---

## 2. 목표 구조 (To-Be)

```
                 ┌── 사용자 A (Claude) ──┐
HTTPS /mcp  <────┤   각자 자기 yeorot 키  ├──> yeorot-mcp (한 곳에 호스팅)
(Streamable HTTP)└── 사용자 B (Claude) ──┘     요청별 키 분리 → yeorot API
```

- **전송**: `StreamableHTTPServerTransport` (MCP 표준 원격 전송, 단일 `/mcp` 엔드포인트)
  - 구버전 HTTP+SSE 2-엔드포인트 방식은 **deprecated** — 쓰지 않는다.
  - SDK 1.29.0에 `server/streamableHttp.js`로 이미 포함되어 있음.
- **인증**: 사용자마다 **자기 yeorot 키**가 요청 단위로 분리되어 `yeorotFetch`까지 전달
- **배포**: yeorot.cloud 같은 한 서버에 컨테이너로 상시 가동

---

## 3. 핵심 과제 — 멀티테넌트 인증

전송 방식 교체는 작업의 일부일 뿐이고, **진짜 난이도는 "사용자별 키 분리"**다.
현재 `yeorotFetch`는 전역 `config.YEOROT_API_KEY` 하나를 읽는다(`src/client.ts:22`).
원격 서버에서는 **요청을 보낸 사용자의 키**를 써야 한다.

### 3-1. 요청별 키를 `yeorotFetch`까지 전달하는 방법

| 방안 | 설명 | 평가 |
|---|---|---|
| **AsyncLocalStorage** (권장) | 요청 진입 시 사용자 키를 request-scoped store에 저장, `yeorotFetch`가 거기서 읽음 | 모든 tool 시그니처를 안 건드려도 됨. 변경 최소 |
| context 인자 명시 전달 | 각 tool `execute(input, ctx)`에 키를 인자로 넘김 | 명시적이나 모든 tool·핸들러 수정 필요 |

→ **AsyncLocalStorage** 채택. `client.ts`만 전역 키 대신 store에서 키를 꺼내도록 고치면 tool 코드는 그대로.

### 3-2. 사용자를 무엇으로 인증할 것인가

| 방안 | 동작 | 장단점 | 단계 |
|---|---|---|---|
| **Bearer 키 패스스루** | 클라이언트가 `Authorization: Bearer yrk_...` 헤더로 자기 yeorot 키를 직접 전달, 서버는 그 키를 그대로 yeorot에 사용 | 구현 단순, 즉시 가능. Claude "커스텀 커넥터"에서 헤더 지정으로 연결 | **Phase 1 (MVP)** |
| **OAuth 2.1** (MCP 공식) | yeorot이 OAuth 인가 서버, MCP 서버는 리소스 서버(RFC 9728 PRM + DCR). Claude가 "원격 MCP 추가" 시 로그인 팝업 → 토큰 발급 | 대기업 커넥터처럼 원클릭 연결. yeorot에 OAuth 엔드포인트 추가 필요(작업량 큼) | **Phase 2** |

- SDK에 OAuth용 `server/auth/`(provider·router·bearer 미들웨어)가 이미 들어있어 Phase 2의 토대는 있음.
- Phase 1 Bearer 방식으로 "모두 접속 가능"이라는 목표를 먼저 달성하고, Phase 2에서 UX를 OAuth로 고도화한다.

---

## 4. 코드 변경 범위

| 파일 | 변경 |
|---|---|
| `src/config.ts` | `YEOROT_API_KEY`를 **선택값**으로(원격 모드는 요청별 키 사용). `PORT`, `MCP_MODE`(stdio/http) 등 서버 설정 추가 |
| `src/client.ts` | 전역 키 대신 **AsyncLocalStorage store에서 키 조회**. 키 없으면 401 의미의 에러 |
| `src/auth-context.ts` (신규) | AsyncLocalStorage 정의 + `runWithApiKey(key, fn)` 헬퍼 |
| `src/register-tools.ts` (신규) | 현재 `index.ts`의 `server.tool(...)` 등록부를 `registerTools(server)` 함수로 추출 → stdio·http 양쪽이 공유 |
| `src/index.ts` | stdio 엔트리 유지(인스톨러·로컬 호환). `registerTools(server)` 호출만 남김 |
| `src/server-http.ts` (신규) | Express + `StreamableHTTPServerTransport`. `/mcp`(POST/GET/DELETE), `/healthz`. 요청 헤더에서 키 추출 → `runWithApiKey`로 감싸 핸들 |
| `package.json` | `express` 의존성, `start:http` 스크립트 추가 |
| `Dockerfile` (신규) | 컨테이너 빌드 |

> **하위호환 유지**: stdio 엔트리(`index.ts`)와 인스톨러는 그대로 둔다. tool 등록을 `registerTools()`로 공유해 두 전송이 같은 도구를 쓴다.

---

## 5. 세션 모드

`StreamableHTTPServerTransport`는 두 가지를 지원:

- **Stateful**: 서버가 `Mcp-Session-Id` 발급, 세션별 transport를 메모리에 보관. 수평 확장 시 sticky session 또는 외부 세션 스토어(Redis) 필요.
- **Stateless**: 요청마다 새 transport, 세션 없음. 서버→클라이언트 알림/재개 불가하나, 본 서버는 **tool 호출만 있고 구독이 없으므로** 확장에 유리.

→ 초기엔 **단일 인스턴스 stateful**(가장 단순), 트래픽 증가 시 stateless 또는 Redis 세션 스토어로 전환.

---

## 6. 배포 & 운영

- **HTTPS**: 리버스 프록시(nginx/Caddy) 또는 PaaS에서 TLS 종료. MCP 원격 서버는 평문 HTTP 금지.
- **CORS**: 브라우저 기반 MCP 클라이언트 대비 `Mcp-Session-Id` 헤더 노출 허용.
- **DNS rebinding 보호**: transport의 `enableDnsRebindingProtection` + `allowedHosts`/`allowedOrigins` 설정 (MCP 보안 권고).
- **헬스체크**: `/healthz`.
- **레이트 리밋**: 키(사용자)별 제한으로 yeorot 백엔드 보호.
- **로깅/관측성**: 요청·에러 로그(키 절대 미노출), 메트릭.
- **컨테이너**: Dockerfile → yeorot 인프라에 배포. 환경변수 `YEOROT_API_URL`, `PORT`, `MCP_MODE=http`.

---

## 7. 보안 체크리스트

- [ ] API 키를 stdout / AI 응답 / 로그에 절대 노출하지 않음 (기존 규칙 유지, `process.stderr`만)
- [ ] `yrk_` 접두사 검증 유지
- [ ] Origin 검증 / DNS rebinding 보호
- [ ] 키별 레이트 리밋
- [ ] TLS 강제, HTTP→HTTPS 리다이렉트
- [ ] 잘못된/만료 키 → 401, 내부 토폴로지(yeorot 내부 URL) 미노출

---

## 8. 단계별 로드맵

### Phase 0 — 리팩토링 (동작 변화 없음) ✅ 완료
- [x] `auth-context.ts` (AsyncLocalStorage) 추가
- [x] `client.ts`를 request-scoped 키 조회로 변경 (stdio는 env 키를 fallback으로 한 번 등록해 호환 — 이벤트 콜백에서 ALS 컨텍스트가 끊기는 문제 회피)
- [x] tool 등록을 `registerTools(server)`로 추출
- [x] `config.ts`에서 `YEOROT_API_KEY` 선택값化 (stdio 엔트리에서 필수 검증 유지)
- [x] 기존 stdio 동작 회귀 테스트 (키 가드·tools/list·tools/call·번들 빌드)

### Phase 1 — Streamable HTTP + Bearer 키 (MVP, "모두 접속 가능")
- [ ] `server-http.ts` (Express + StreamableHTTPServerTransport)
- [ ] `Authorization: Bearer yrk_...` 헤더 → `runWithApiKey`
- [ ] `/healthz`, CORS, DNS rebinding 보호
- [ ] Dockerfile + 배포(TLS)
- [ ] Claude 커스텀 커넥터로 연결 검증

### Phase 2 — OAuth 2.1 (대기업 커넥터 수준 UX)
- [ ] yeorot OAuth 인가 서버 (authorize/token, DCR)
- [ ] MCP 서버를 OAuth 리소스 서버로 (`server/auth/` 라우터 + bearer 검증, RFC 9728 PRM)
- [ ] Claude "원격 MCP 추가" 원클릭 로그인 검증

### Phase 3 — 하드닝 & 확장
- [ ] 키별 레이트 리밋
- [ ] 수평 확장 (stateless 또는 Redis 세션 스토어)
- [ ] 관측성(메트릭·감사 로그)

---

## 9. 미결정 사항 (착수 전 확정 필요)

- **호스팅 대상**: yeorot.cloud 자체 VM vs PaaS(Railway/Fly/Render 등)
- **Phase 2 OAuth 범위**: yeorot에 OAuth 서버를 붙일 수 있는지 (yeorot 백엔드 작업 수반)
- **세션 모드**: stateful 단일 인스턴스로 시작 → 확장 시점 결정
- **MVP 인증을 Bearer로 충분히 볼지**, 처음부터 OAuth로 갈지

---

## 참고

- MCP Transports — https://modelcontextprotocol.io/docs/concepts/transports
- MCP Authorization — https://modelcontextprotocol.io/specification/draft/basic/authorization
- `@modelcontextprotocol/sdk` 1.29.0: `server/streamableHttp.js`, `server/auth/`
