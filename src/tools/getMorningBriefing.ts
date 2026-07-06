import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
});

interface BriefingTaskItem {
  id: string;
  title: string;
  status: 'todo' | 'inprog' | 'blocked';
  priority: 'P1' | 'P2' | 'P3' | 'P4' | null;
  project_id: string | null;
  project_name: string | null;
  milestone_id: string | null;
  milestone_name: string | null;
  due_time: string | null;
  carryover_count: number;
  story_points: number;
}

interface RecommendedTaskItem extends BriefingTaskItem {
  score: number;
  reason: string;
  reason_tags: Array<'carryover' | 'due_today' | 'milestone_risk' | 'project_risk' | 'high_sp' | 'scheduled'>;
}

interface BriefingResponse {
  date: string;
  generated_at: string;
  summary: {
    total_tasks: number;
    carryover_count: number;
    due_today_count: number;
    at_risk_count: number;
  };
  carryover_tasks: BriefingTaskItem[];
  due_today_tasks: BriefingTaskItem[];
  at_risk_tasks: BriefingTaskItem[];
  recommended: RecommendedTaskItem[];
}

export const getMorningBriefingTool = {
  name: 'getMorningBriefing',
  description:
    '오늘의 아침 브리핑을 조회합니다. 이월된 태스크, 오늘 마감 태스크, 위험도 높은 프로젝트/마일스톤 관련 태스크, 우선 추천 top 3(사유 포함)를 반환. "아침 브리핑 해줘", "오늘 뭐부터 해야해?" 같은 요청에 사용.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description: '조회할 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul 기준). 오늘 이후 날짜는 지원하지 않음.',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<BriefingResponse> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }
    const date = parsed.data.date ?? getTodayKST();
    return yeorotFetch<BriefingResponse>(`/briefing?date=${date}`);
  },
};
