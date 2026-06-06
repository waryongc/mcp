import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  q: z.string().min(2, '검색어는 최소 2자 이상이어야 합니다').max(100, '검색어는 최대 100자입니다'),
});

interface SearchResult {
  id: string;
  type: string;
  title: string;
  status?: string;
  project_id?: string | null;
}

interface SearchTasksResult {
  query: string;
  results: SearchResult[];
  count: number;
}

export const searchTasksTool = {
  name: 'searchTasks',
  description:
    '키워드로 태스크·프로젝트를 검색합니다. 태스크 이름이 기억나지 않을 때, 특정 키워드가 포함된 항목을 찾을 때 사용.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      q: {
        type: 'string',
        description: '검색 키워드 (최소 2자, 최대 100자)',
      },
    },
    required: ['q'],
  },
  async execute(rawInput: unknown): Promise<SearchTasksResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    const { q } = parsed.data;
    const results = await yeorotFetch<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`);

    return {
      query: q,
      results: results.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        ...(r.status !== undefined && { status: r.status }),
        ...(r.project_id !== undefined && { project_id: r.project_id }),
      })),
      count: results.length,
    };
  },
};
