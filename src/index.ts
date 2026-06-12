import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { setFallbackApiKey } from './auth-context.js';
import { registerTools } from './register-tools.js';
import { VERSION } from './version.js';

// stdio 모드는 .env 단일 키가 필수 (원격 모드는 요청별 키라 config에서는 선택값)
if (!config.YEOROT_API_KEY) {
  process.stderr.write('[yeorot-mcp] 환경변수 검증 실패:\n  YEOROT_API_KEY: YEOROT_API_KEY is required\n');
  process.exit(1);
}
setFallbackApiKey(config.YEOROT_API_KEY);

const server = new McpServer({ name: 'yeorot-mcp', version: VERSION });
registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[yeorot-mcp] v${VERSION} 시작됨\n`);
