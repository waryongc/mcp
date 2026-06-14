import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

interface DeleteTaskResult {
  id: string;
  title: string;
  status: string;
}

export const deleteTaskTool = {
  name: 'deleteTask',
  description:
    '태스크를 삭제합니다(소프트 삭제 — 보관 처리). "이 태스크 지워줘", "삭제해줘" 같은 요청에 사용. 되돌리려면 yeorot에서 직접 복구해야 하므로, 삭제 전 대상이 맞는지 확인할 것.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: '삭제할 태스크 UUID',
      },
    },
    required: ['id'],
  },
  async execute(rawInput: unknown): Promise<DeleteTaskResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    return yeorotFetch<DeleteTaskResult>(`/tasks/${parsed.data.id}`, {
      method: 'DELETE',
    });
  },
};
