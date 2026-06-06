import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['todo', 'inprog', 'done', 'blocked', 'cancelled']).optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).nullable().optional(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'planned_date must be YYYY-MM-DD').optional(),
  due_time: z.string().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  estimated_minutes: z.number().int().positive().nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  blocked_reason: z.string().nullable().optional(),
  story_points: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(5),
    z.literal(8),
    z.literal(13),
  ]).optional(),
});

interface UpdateTaskResult {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string | null;
  description: string | null;
  planned_date: string | null;
  due_time: string | null;
  project_id: string | null;
  estimated_minutes: number | null;
  blocked_reason: string | null;
  story_points: number | null;
}

export const updateTaskStatusTool = {
  name: 'updateTaskStatus',
  description:
    '태스크의 상태·진행률·제목·날짜·우선순위 등을 변경합니다. 상태 업데이트, 완료 처리, 태스크 내용 수정 시 사용.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: '태스크 UUID',
      },
      title: {
        type: 'string',
        description: '태스크 제목 (선택)',
      },
      description: {
        type: 'string',
        description: '태스크 설명 (선택, null로 초기화 가능)',
      },
      status: {
        type: 'string',
        enum: ['todo', 'inprog', 'done', 'blocked', 'cancelled'],
        description: '변경할 상태 (선택)',
      },
      priority: {
        type: 'string',
        enum: ['P1', 'P2', 'P3', 'P4'],
        description: '우선순위 (선택, null로 해제)',
      },
      planned_date: {
        type: 'string',
        description: '계획 날짜 YYYY-MM-DD (선택)',
      },
      due_time: {
        type: 'string',
        description: '마감 시간 (선택, null로 초기화 가능)',
      },
      project_id: {
        type: 'string',
        description: '프로젝트 UUID (선택, null로 해제)',
      },
      estimated_minutes: {
        type: 'number',
        description: '예상 소요 시간 분 단위 (선택, null로 초기화 가능)',
      },
      progress: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: '진행률 (0–100, 선택)',
      },
      blocked_reason: {
        type: 'string',
        description: '차단 사유 (status=blocked 일 때 사용, 선택, null로 초기화 가능)',
      },
      story_points: {
        type: 'number',
        enum: [1, 2, 3, 5, 8, 13],
        description: '스토리 포인트 (1·2·3·5·8·13, 선택)',
      },
    },
    required: ['id'],
  },
  async execute(rawInput: unknown): Promise<UpdateTaskResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const body = Object.fromEntries(
      Object.entries(parsed.data).filter(([k, v]) => k !== 'id' && v !== undefined),
    );

    return yeorotFetch<UpdateTaskResult>(`/tasks/${parsed.data.id}`, {
      method: 'PATCH',
      body,
    });
  },
};
