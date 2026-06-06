import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({
  rack_id: z.string().uuid('rack_id must be a valid UUID').optional(),
});

interface RackSummary {
  id: string;
  name: string;
  total_slots: number;
  used_slots: number;
}

interface RackItem {
  id: string;
  slot_start: number;
  slot_size: number;
  item_type: string;
  assignee: string | null;
  model: string | null;
  ip_address: string | null;
}

interface RackDetail {
  id: string;
  name: string;
  total_slots: number;
  items: RackItem[];
}

type GetRackStatusResult = { racks: RackSummary[] } | { rack: RackDetail };

export const getRackStatusTool = {
  name: 'getRackStatus',
  description:
    '서버 랙 현황을 조회합니다. 랙 가용 슬롯·장비 배치 확인, 특정 랙 상세 조회 시 사용. rack_id 생략 시 전체 랙 목록 반환.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      rack_id: {
        type: 'string',
        description: '특정 랙의 UUID. 생략하면 전체 랙 목록 반환.',
      },
    },
    required: [],
  },
  async execute(rawInput: unknown): Promise<GetRackStatusResult> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    }

    if (parsed.data.rack_id) {
      const rack = await yeorotFetch<RackDetail>(`/racks/${parsed.data.rack_id}`);
      return { rack };
    }

    const racks = await yeorotFetch<RackSummary[]>('/racks');
    return { racks };
  },
};
