import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  include_tasks: z.boolean().optional().default(false),
});

interface MemberContribution {
  user_id: string;
  name: string;
  done_points: number;
  total_points: number;
}

interface Milestone {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
}

interface ProjectSummary {
  id: string;
  name: string;
  done_tasks: number;
  total_tasks: number;
  rate: number;
  effective_rate: number;
  members: MemberContribution[];
  milestones: Milestone[];
  last_activity_date: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  progress: number;
  assignee_id: string | null;
  due_time: string | null;
}

type GetProjectStatusResult =
  | { projects: ProjectSummary[] }
  | { project: ProjectSummary; tasks?: TaskItem[] };

export const getProjectStatusTool = {
  name: 'getProjectStatus',
  description:
    '프로젝트 현황을 조회합니다. project_id 없으면 전체 프로젝트 요약(진행률·멤버 기여도·마일스톤), ' +
    'project_id 있으면 해당 프로젝트 상세 + 선택적으로 태스크 목록.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      project_id: {
        type: 'string',
        description: '특정 프로젝트 UUID (생략하면 전체 요약)',
      },
      include_tasks: {
        type: 'boolean',
        description: '태스크 목록 포함 여부 (project_id 지정 시에만 유효, 기본 false)',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<GetProjectStatusResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const { project_id, include_tasks } = parsed.data;
    const summaries = await yeorotFetch<ProjectSummary[]>('/projects/summary');

    if (!project_id) {
      return { projects: summaries };
    }

    const project = summaries.find((p) => p.id === project_id);
    if (!project) {
      throw new Error(`프로젝트를 찾을 수 없습니다 (id: ${project_id})`);
    }

    if (!include_tasks) {
      return { project };
    }

    const tasks = await yeorotFetch<TaskItem[]>(`/projects/${project_id}/tasks`);
    return { project, tasks };
  },
};
