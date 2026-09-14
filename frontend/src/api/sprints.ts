import { apiClient } from './client';
import type { Sprint, SprintCloseResult, SprintCreateInput, SprintUpdateInput } from '@/types/api';

export const sprintsApi = {
  list: async (workspaceId?: string | null): Promise<Sprint[]> => {
    const { data } = await apiClient.get<Sprint[]>('/sprints', {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
  create: async (input: SprintCreateInput, workspaceId?: string | null): Promise<Sprint> => {
    const { data } = await apiClient.post<Sprint>('/sprints', input, {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
  update: async (id: string, input: SprintUpdateInput): Promise<Sprint> => {
    const { data } = await apiClient.put<Sprint>(`/sprints/${id}`, input);
    return data;
  },
  /** Complete a sprint; unfinished tasks go to `moveTo` (another open sprint) or the backlog. */
  close: async (id: string, moveTo: string | null): Promise<SprintCloseResult> => {
    const { data } = await apiClient.post<SprintCloseResult>(`/sprints/${id}/close`, {
      move_to: moveTo,
    });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/sprints/${id}`);
  },
};
