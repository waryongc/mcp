import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getTodayTasksTool } from './tools/getTodayTasks.js';
import { updateTaskStatusTool } from './tools/updateTaskStatus.js';
import { getRackStatusTool } from './tools/getRackStatus.js';
import { createTaskTool } from './tools/createTask.js';
import { getProjectStatusTool } from './tools/getProjectStatus.js';
import { searchTasksTool } from './tools/searchTasks.js';
import { getStatsTool } from './tools/getStats.js';
import { checkForUpdate } from './update.js';
import { VERSION } from './version.js';

await import('./config.js');

// 업데이트 체크 — 백그라운드, 실패 무시
let pendingUpdate: string | null = null;
let updateNoticeSent = false;
checkForUpdate().then((v) => { pendingUpdate = v; }).catch(() => {});

function ok(result: unknown) {
  const notice = (!updateNoticeSent && pendingUpdate)
    ? `⚠️ yeorot MCP 새 버전(v${pendingUpdate})이 있습니다. 인스톨러를 다시 실행하면 업데이트됩니다.\n\n`
    : '';
  updateNoticeSent = true;
  return { content: [{ type: 'text' as const, text: notice + JSON.stringify(result, null, 2) }] };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `오류: ${message}` }], isError: true };
}

const server = new McpServer({ name: 'yeorot-mcp', version: VERSION });

server.tool(
  getTodayTasksTool.name,
  getTodayTasksTool.description,
  {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('조회할 날짜 (YYYY-MM-DD). 생략하면 오늘'),
    scope: z.enum(['mine', 'team']).optional().describe('"mine"(기본): 본인 태스크만. "team": 팀원 전체'),
  },
  async ({ date, scope }) => {
    try { return ok(await getTodayTasksTool.execute({ date, scope })); }
    catch (e) { return fail(e); }
  },
);

server.tool(
  updateTaskStatusTool.name,
  updateTaskStatusTool.description,
  {
    id: z.string().uuid().describe('태스크 UUID'),
    title: z.string().min(1).optional().describe('태스크 제목 (선택)'),
    description: z.string().nullable().optional().describe('태스크 설명 (선택, null로 초기화)'),
    status: z.enum(['todo', 'inprog', 'done', 'blocked', 'cancelled']).optional().describe('변경할 상태 (선택)'),
    priority: z.enum(['P1', 'P2', 'P3', 'P4']).nullable().optional().describe('우선순위 (선택, null로 해제)'),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('계획 날짜 YYYY-MM-DD (선택)'),
    due_time: z.string().nullable().optional().describe('마감 시간 (선택, null로 초기화)'),
    project_id: z.string().uuid().nullable().optional().describe('프로젝트 UUID (선택, null로 해제)'),
    estimated_minutes: z.number().int().positive().nullable().optional().describe('예상 소요 시간(분) (선택)'),
    progress: z.number().int().min(0).max(100).optional().describe('진행률 (0–100, 선택)'),
    blocked_reason: z.string().nullable().optional().describe('차단 사유 (status=blocked 일 때, 선택)'),
    story_points: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]).optional().describe('스토리 포인트 (선택)'),
  },
  async (input) => {
    try { return ok(await updateTaskStatusTool.execute(input)); }
    catch (e) { return fail(e); }
  },
);

server.tool(
  getRackStatusTool.name,
  getRackStatusTool.description,
  {
    rack_id: z.string().uuid().optional().describe('특정 랙 UUID (생략하면 전체 목록)'),
  },
  async ({ rack_id }) => {
    try { return ok(await getRackStatusTool.execute({ rack_id })); }
    catch (e) { return fail(e); }
  },
);

server.tool(
  createTaskTool.name,
  createTaskTool.description,
  {
    title: z.string().min(1).describe('태스크 제목 (필수)'),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('계획 날짜 YYYY-MM-DD (생략하면 오늘)'),
    description: z.string().optional().describe('상세 설명 (선택)'),
    priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional().describe('우선순위 (선택)'),
    status: z.string().optional().describe('초기 상태 (선택, 기본 todo)'),
    due_time: z.string().optional().describe('마감 시간 HH:MM (선택)'),
    project_id: z.string().uuid().optional().describe('프로젝트 UUID (선택)'),
    estimated_minutes: z.number().int().positive().optional().describe('예상 소요 시간(분) (선택)'),
  },
  async (input) => {
    try { return ok(await createTaskTool.execute(input)); }
    catch (e) { return fail(e); }
  },
);

server.tool(
  getProjectStatusTool.name,
  getProjectStatusTool.description,
  {
    project_id: z.string().uuid().optional().describe('특정 프로젝트 UUID (생략하면 전체 요약)'),
    include_tasks: z.boolean().optional().describe('태스크 목록 포함 여부 (project_id 지정 시에만 유효, 기본 false)'),
  },
  async ({ project_id, include_tasks }) => {
    try { return ok(await getProjectStatusTool.execute({ project_id, include_tasks })); }
    catch (e) { return fail(e); }
  },
);

server.tool(
  searchTasksTool.name,
  searchTasksTool.description,
  {
    q: z.string().min(2).max(100).describe('검색 키워드 (최소 2자, 최대 100자)'),
  },
  async ({ q }) => {
    try { return ok(await searchTasksTool.execute({ q })); }
    catch (e) { return fail(e); }
  },
);

server.tool(
  getStatsTool.name,
  getStatsTool.description,
  {
    period: z.enum(['day', 'week', 'month']).optional().describe('조회 기간 단위 (기본: week)'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('기준 날짜 YYYY-MM-DD (생략하면 오늘)'),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('조회 시작 날짜 (from+to 사용 시 period+date보다 우선)'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('조회 종료 날짜'),
  },
  async ({ period, date, from, to }) => {
    try { return ok(await getStatsTool.execute({ period, date, from, to })); }
    catch (e) { return fail(e); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[yeorot-mcp] v${VERSION} 시작됨\n`);
