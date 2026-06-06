import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  scope: z.enum(['mine', 'team']).optional().default('mine'),
});

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  progress: number;
  project_id: string | null;
  due_time: string | null;
  assignee_id: string | null;
}

interface GetTodayTasksResult {
  date: string;
  scope: 'mine' | 'team';
  count: number;
  tasks: TaskItem[];
}

export const getTodayTasksTool = {
  name: 'getTodayTasks',
  description:
    '날짜별 태스크 목록을 조회합니다. 오늘 할 일 확인, 스탠드업 준비, 팀원 진행상황 파악 시 사용. scope=team으로 팀 전체 태스크 조회 가능.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description: '조회할 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul 기준). 어제·내일 등 특정 날짜 지정 가능.',
      },
      scope: {
        type: 'string',
        enum: ['mine', 'team'],
        description: '"mine"(기본): 내 태스크만 조회. "team": 내가 속한 프로젝트의 팀원 전체 태스크 조회.',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<GetTodayTasksResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const { scope } = parsed.data;
    const date = parsed.data.date ?? getTodayKST();

    let tasks: TaskItem[];
    if (scope === 'mine') {
      const me = await yeorotFetch<{ user: { id: string } }>('/auth/me');
      const userId = me?.user?.id;
      if (!userId) {
        throw new Error('/auth/me에서 유저 ID를 가져오지 못했습니다');
      }
      tasks = await yeorotFetch<TaskItem[]>(`/tasks?date=${date}&assignee_id=${userId}`);
    } else {
      tasks = await yeorotFetch<TaskItem[]>(`/tasks?date=${date}`);
    }

    return {
      date,
      scope,
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        project_id: t.project_id,
        due_time: t.due_time,
        assignee_id: t.assignee_id,
      })),
    };
  },
};
