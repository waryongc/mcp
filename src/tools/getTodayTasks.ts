import { z } from 'zod';
import { yeorotFetch } from '../client.js';
import { getTodayKST } from '../dates.js';

const InputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
});

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  progress: number;
  project_id: string | null;
  due_time: string | null;
}

interface GetTodayTasksResult {
  date: string;
  count: number;
  tasks: TaskItem[];
}

export const getTodayTasksTool = {
  name: 'getTodayTasks',
  description: '오늘(또는 지정한 날짜)의 태스크 목록을 조회합니다.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description: '조회할 날짜 (YYYY-MM-DD). 생략하면 오늘(Asia/Seoul 기준)',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<GetTodayTasksResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const date = parsed.data.date ?? getTodayKST();
    const tasks = await yeorotFetch<TaskItem[]>(`/tasks?date=${date}`);

    return {
      date,
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        project_id: t.project_id,
        due_time: t.due_time,
      })),
    };
  },
};
