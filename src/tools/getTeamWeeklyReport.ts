import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  project_id: z.string().uuid().optional(),
});

interface TeamWeeklyProjectItem {
  project_id: string;
  project_name: string;
  done_points: number;
  total_points: number;
  effective_rate: number;
  task_count_done: number;
  task_count_total: number;
  prev_done_points: number;
  delta_points: number;
}

interface TeamWeeklyMemberItem {
  user_id: string;
  display_name: string;
  done_count: number;
  done_points: number;
  carryover_incidents: number;
  cycle_time_avg_minutes: number | null;
  sample_size: number;
}

interface TeamCarryoverWatchItem {
  id: string;
  title: string;
  carryover_count: number;
  planned_date: string;
  assignee_name: string;
  project_name: string | null;
}

interface CycleTimeSummary {
  sample_size: number;
  avg_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  low_sample: boolean;
}

interface TeamWeeklyReport {
  week_start: string;
  week_end: string;
  scope: 'org' | 'project';
  scope_id: string;
  scope_name: string;
  generated_at: string;
  velocity: {
    this_week_done_points: number;
    prev_week_done_points: number;
    delta_points: number;
    delta_pct: number | null;
  };
  projects: TeamWeeklyProjectItem[];
  members: TeamWeeklyMemberItem[];
  carryover_watch: TeamCarryoverWatchItem[];
  cycle_time: CycleTimeSummary | null;
}

export const getTeamWeeklyReportTool = {
  name: 'getTeamWeeklyReport',
  description:
    '팀(또는 지정한 프로젝트) 주간보고 초안을 조회합니다. 이번 주(또는 date가 속한 주) velocity(전주 대비), ' +
    '프로젝트별 진척, 멤버별 완료·이월 현황, 이월 감시 상위 목록, 착수~완료 소요시간 요약을 반환. ' +
    '"이번 주 팀 주간보고 써줘", "Backend 프로젝트 이번 주 어땠는지 정리해줘" 같은 요청에 사용. ' +
    '⚠️ 리더/관리자 권한(super-admin, org-admin, 또는 해당 프로젝트 leader)이 있어야 하며, 일반 멤버는 403을 받는다. ' +
    '이 tool은 구조화 데이터만 반환하므로, 자연어 요약 문장은 이 데이터를 바탕으로 직접 작성할 것.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description:
          '조회할 주에 속한 아무 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul)이 속한 이번 주. 오늘 이후 날짜는 지원하지 않음.',
      },
      project_id: {
        type: 'string',
        description: '특정 프로젝트로 스코프를 좁힐 때 프로젝트 UUID. 생략하면 조직 전체.',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<TeamWeeklyReport> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }
    const date = parsed.data.date ?? getTodayKST();
    const params = new URLSearchParams({ date });
    if (parsed.data.project_id) params.set('project_id', parsed.data.project_id);
    return yeorotFetch<TeamWeeklyReport>(`/team/weekly-report?${params.toString()}`);
  },
};
