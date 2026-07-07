import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  project_id: z.string().uuid().optional(),
});

interface DigestStatusCounts {
  todo: number;
  inprog: number;
  blocked: number;
  done: number;
}

interface DigestBlockedTask {
  id: string;
  title: string;
  blocked_reason: string | null;
  project_name: string | null;
}

interface MemberDigestLine {
  user_id: string;
  display_name: string;
  yesterday_done_count: number;
  yesterday_done_points: number;
  today_task_count: number;
  today_points: number;
  today_status: DigestStatusCounts;
  blocked: DigestBlockedTask[];
  carryover_count: number;
  flags: Array<'no_plan_today' | 'all_carryover' | 'has_blocked' | 'stalled'>;
}

interface AttentionItem {
  type: 'blocked' | 'high_carryover' | 'no_plan';
  user_id: string;
  display_name: string;
  task_id: string | null;
  title: string;
  detail: string;
}

interface TeamMorningDigest {
  date: string;
  scope: 'org' | 'project';
  scope_id: string;
  scope_name: string;
  generated_at: string;
  team_summary: {
    total_members: number;
    member_count_active: number;
    tasks_today: number;
    by_status: DigestStatusCounts;
    completion_rate: number;
    carryover_tasks: number;
    blocked_tasks: number;
    yesterday_done_count: number;
    yesterday_done_points: number;
  };
  members: MemberDigestLine[];
  attention: AttentionItem[];
  retro_yesterday: { status: string; responded: boolean } | null;
}

export const getTeamDigestTool = {
  name: 'getTeamDigest',
  description:
    '팀 아침 다이제스트를 조회합니다. 팀(또는 지정한 프로젝트) 멤버별 어제 완료·오늘 계획·막힌 태스크·이월 현황과, ' +
    '리더가 스탠드업에서 물어봤을 주목 항목(막힘/장기이월/계획없음)을 반환. ' +
    '"팀 오늘 상황 브리핑해줘", "Backend 팀 오늘 어때" 같은 요청에 사용. ' +
    '⚠️ 리더/관리자 권한(super-admin, org-admin, 또는 해당 프로젝트 leader)이 있어야 하며, 일반 멤버는 403을 받는다.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description: '조회할 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul 기준). 오늘 이후 날짜는 지원하지 않음.',
      },
      project_id: {
        type: 'string',
        description: '특정 프로젝트로 스코프를 좁힐 때 프로젝트 UUID. 생략하면 조직 전체.',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<TeamMorningDigest> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }
    const date = parsed.data.date ?? getTodayKST();
    const params = new URLSearchParams({ date });
    if (parsed.data.project_id) params.set('project_id', parsed.data.project_id);
    return yeorotFetch<TeamMorningDigest>(`/team/digest?${params.toString()}`);
  },
};
