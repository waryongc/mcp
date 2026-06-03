import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  status: z.enum(['todo', 'inprog', 'done', 'blocked', 'cancelled']),
  progress: z.number().int().min(0).max(100).optional(),
  blocked_reason: z.string().optional(),
});

interface UpdateTaskStatusResult {
  id: string;
  title: string;
  status: string;
  progress: number;
}

export const updateTaskStatusTool = {
  name: 'updateTaskStatus',
  description: '태스크의 상태와 진행률을 업데이트합니다.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: '태스크 UUID',
      },
      status: {
        type: 'string',
        enum: ['todo', 'inprog', 'done', 'blocked', 'cancelled'],
        description: '변경할 상태',
      },
      progress: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: '진행률 (0–100, 선택)',
      },
      blocked_reason: {
        type: 'string',
        description: '차단 사유 (status=blocked 일 때 사용, 선택)',
      },
    },
    required: ['id', 'status'],
  },
  async execute(rawInput: unknown): Promise<UpdateTaskStatusResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const body: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.progress !== undefined) body.progress = parsed.data.progress;
    if (parsed.data.blocked_reason !== undefined) body.blocked_reason = parsed.data.blocked_reason;

    return yeorotFetch<UpdateTaskStatusResult>(`/tasks/${parsed.data.id}`, {
      method: 'PATCH',
      body,
    });
  },
};
