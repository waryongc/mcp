import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
});

interface StatsResult {
  period?: 'day' | 'week' | 'month';
  date?: string;
  from?: string;
  to?: string;
  stats: unknown;
}

export const getStatsTool = {
  name: 'getStats',
  description:
    '기간별 태스크 완료율·생산성 통계를 조회합니다. 주간 리뷰, 월간 성과 확인, 개인 생산성 파악 시 사용.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      period: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        description: '조회 기간 단위 (기본: week)',
      },
      date: {
        type: 'string',
        description: '기준 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul 기준)',
      },
      from: {
        type: 'string',
        description: '조회 시작 날짜 (YYYY-MM-DD). from+to 사용 시 period+date보다 우선',
      },
      to: {
        type: 'string',
        description: '조회 종료 날짜 (YYYY-MM-DD). from+to 사용 시 period+date보다 우선',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<StatsResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const { period, date, from, to } = parsed.data;

    let endpoint: string;
    let resultBase: Omit<StatsResult, 'stats'>;

    if (from !== undefined && to !== undefined) {
      endpoint = `/stats?from=${from}&to=${to}`;
      resultBase = { from, to };
    } else {
      const resolvedDate = date ?? getTodayKST();
      endpoint = `/stats?period=${period}&date=${resolvedDate}`;
      resultBase = { period, date: resolvedDate };
    }

    const stats = await yeorotFetch<unknown>(endpoint);

    return { ...resultBase, stats };
  },
};
