import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getTodayTasksTool } from './tools/getTodayTasks.js';
import { updateTaskStatusTool } from './tools/updateTaskStatus.js';
import { getRackStatusTool } from './tools/getRackStatus.js';
import { createTaskTool } from './tools/createTask.js';

// Config validation runs on import — exits with error on missing env vars
await import('./config.js');

const server = new McpServer({
  name: 'yeorot-mcp',
  version: '0.1.0',
});

// Register getTodayTasks
server.tool(
  getTodayTasksTool.name,
  getTodayTasksTool.description,
  {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('조회할 날짜 (YYYY-MM-DD). 생략하면 오늘'),
  },
  async ({ date }) => {
    try {
      const result = await getTodayTasksTool.execute({ date });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `오류: ${message}` }], isError: true };
    }
  },
);

// Register updateTaskStatus
server.tool(
  updateTaskStatusTool.name,
  updateTaskStatusTool.description,
  {
    id: z.string().uuid().describe('태스크 UUID'),
    status: z.enum(['todo', 'inprog', 'done', 'blocked', 'cancelled']).describe('변경할 상태'),
    progress: z.number().int().min(0).max(100).optional().describe('진행률 (0–100, 선택)'),
    blocked_reason: z.string().optional().describe('차단 사유 (status=blocked 일 때, 선택)'),
  },
  async ({ id, status, progress, blocked_reason }) => {
    try {
      const result = await updateTaskStatusTool.execute({ id, status, progress, blocked_reason });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `오류: ${message}` }], isError: true };
    }
  },
);

// Register getRackStatus
server.tool(
  getRackStatusTool.name,
  getRackStatusTool.description,
  {
    rack_id: z.string().uuid().optional().describe('특정 랙 UUID (생략하면 전체 목록)'),
  },
  async ({ rack_id }) => {
    try {
      const result = await getRackStatusTool.execute({ rack_id });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `오류: ${message}` }], isError: true };
    }
  },
);

// Register createTask
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
    try {
      const result = await createTaskTool.execute(input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `오류: ${message}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[yeorot-mcp] 서버 시작됨\n');
