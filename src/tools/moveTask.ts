import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'planned_date must be YYYY-MM-DD'),
});

interface MoveTaskResult {
  id: string;
  title: string;
  status: string;
  planned_date: string | null;
}

export const moveTaskTool = {
  name: 'moveTask',
  description:
    '태스크의 계획 날짜를 다른 날로 옮깁니다. "이 태스크 내일로 미뤄줘", "다음 주 월요일로 옮겨줘" 같은 일정 이동 요청에 사용. 날짜만 바꾸며 상태·진행률은 유지됩니다.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: '이동할 태스크 UUID',
      },
      planned_date: {
        type: 'string',
        description: '옮길 날짜 YYYY-MM-DD',
      },
    },
    required: ['id', 'planned_date'],
  },
  async execute(rawInput: unknown): Promise<MoveTaskResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    return yeorotFetch<MoveTaskResult>(`/tasks/${parsed.data.id}/move`, {
      method: 'PATCH',
      body: { planned_date: parsed.data.planned_date },
    });
  },
};
