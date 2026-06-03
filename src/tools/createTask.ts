import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const InputSchema = z.object({
  title: z.string().min(1, 'title은 필수입니다'),
  planned_date: z.string().regex(DATE_RE, 'planned_date must be YYYY-MM-DD').optional(),
  description: z.string().optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  status: z.enum(['todo', 'inprog', 'done', 'blocked', 'cancelled']).optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/, 'due_time must be HH:MM').optional(),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  estimated_minutes: z.number().int().positive().optional(),
});

interface CreateTaskResult {
  id: string;
  title: string;
  status: string;
  planned_date: string | null;
  project_id: string | null;
}

export const createTaskTool = {
  name: 'createTask',
  description: '새로운 태스크를 생성합니다.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: '태스크 제목 (필수)',
      },
      planned_date: {
        type: 'string',
        description: '계획 날짜 YYYY-MM-DD (생략하면 오늘)',
      },
      description: {
        type: 'string',
        description: '상세 설명 (선택)',
      },
      priority: {
        type: 'string',
        enum: ['P1', 'P2', 'P3', 'P4'],
        description: '우선순위 (선택)',
      },
      status: {
        type: 'string',
        enum: ['todo', 'inprog', 'done', 'blocked', 'cancelled'],
        description: '초기 상태 (선택, 기본 todo)',
      },
      due_time: {
        type: 'string',
        description: '마감 시간 HH:MM 형식 (선택)',
      },
      project_id: {
        type: 'string',
        description: '프로젝트 UUID (선택)',
      },
      estimated_minutes: {
        type: 'number',
        description: '예상 소요 시간(분) (선택)',
      },
    },
    required: ['title'],
  },
  async execute(rawInput: unknown): Promise<CreateTaskResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const body: Record<string, unknown> = {
      title: parsed.data.title,
      planned_date: parsed.data.planned_date ?? getTodayKST(),
    };

    if (parsed.data.description !== undefined) body.description = parsed.data.description;
    if (parsed.data.priority !== undefined) body.priority = parsed.data.priority;
    if (parsed.data.status !== undefined) body.status = parsed.data.status;
    if (parsed.data.due_time !== undefined) body.due_time = parsed.data.due_time;
    if (parsed.data.project_id !== undefined) body.project_id = parsed.data.project_id;
    if (parsed.data.estimated_minutes !== undefined) body.estimated_minutes = parsed.data.estimated_minutes;

    return yeorotFetch<CreateTaskResult>('/tasks', {
      method: 'POST',
      body,
    });
  },
};
