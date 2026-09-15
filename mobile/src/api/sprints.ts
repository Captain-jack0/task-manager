import { apiClient } from './client';
import type { Sprint } from '../types/api';

export const sprintsApi = {
  list: async (workspaceId?: string | null): Promise<Sprint[]> => {
    const { data } = await apiClient.get<Sprint[]>('/sprints', {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
};
