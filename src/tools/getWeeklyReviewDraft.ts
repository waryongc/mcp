import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
});

interface CompletedByProject {
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  done_count: number;
  story_points_sum: number;
}

interface CarryoverWatchItem {
  id: string;
  title: string;
  status: 'todo' | 'inprog' | 'blocked' | 'done' | 'cancelled';
  project_id: string | null;
  project_name: string | null;
  carryover_count: number;
  planned_date: string;
}

interface VelocitySummary {
  this_week_done_points: number;
  prev_week_done_points: number;
  delta_points: number;
  delta_pct: number | null;
  this_week_done_count: number;
  prev_week_done_count: number;
}

interface CycleTimeSummary {
  sample_size: number;
  avg_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  low_sample: boolean;
}

interface WeeklyReviewDraftResponse {
  week_start: string;
  week_end: string;
  generated_at: string;
  completed: {
    total_count: number;
    total_story_points: number;
    by_project: CompletedByProject[];
  };
  carryover_watch: CarryoverWatchItem[];
  velocity: VelocitySummary;
  cycle_time: CycleTimeSummary | null;
}

export const getWeeklyReviewDraftTool = {
  name: 'getWeeklyReviewDraft',
  description:
    '주간 리뷰 초안 데이터를 조회합니다. 이번 주(또는 date가 속한 주)의 완료 태스크(프로젝트별 그룹+SP 합), ' +
    '이월이 잦았던 태스크 상위 목록, 지난주 대비 velocity 변화, 착수~완료 소요시간 요약(데이터 없으면 생략)을 반환. ' +
    '"주간 리뷰 초안 써줘", "이번 주 어땠는지 정리해줘", "지난주 리뷰 써줘" 같은 요청에 사용. ' +
    '이 tool은 구조화 데이터만 반환하므로, 자연어 리뷰 문장은 이 데이터를 바탕으로 직접 작성할 것.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description:
          '조회할 주에 속한 아무 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul)이 속한 이번 주. ' +
          '"지난주"를 요청받으면 오늘로부터 7일 전 날짜를 계산해서 넘길 것. 오늘 이후 날짜는 지원하지 않음.',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<WeeklyReviewDraftResponse> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }
    const date = parsed.data.date ?? getTodayKST();
    return yeorotFetch<WeeklyReviewDraftResponse>(`/weekly-review/draft?date=${date}`);
  },
};
