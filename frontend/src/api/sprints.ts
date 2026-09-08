import { apiClient } from './client';
import type { Sprint, SprintCreateInput, SprintUpdateInput } from '@/types/api';

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
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/sprints/${id}`);
  },
};
