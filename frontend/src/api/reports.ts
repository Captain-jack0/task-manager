import { apiClient } from './client';
import type { Dashboard } from '@/types/api';

export const reportsApi = {
  dashboard: async (days: number, workspaceId?: string | null): Promise<Dashboard> => {
    const { data } = await apiClient.get<Dashboard>('/reports/dashboard', {
      params: { days, ...(workspaceId ? { workspace_id: workspaceId } : {}) },
    });
    return data;
  },
};
