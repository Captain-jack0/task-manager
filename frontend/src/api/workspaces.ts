import { apiClient } from './client';
import type { Workspace, WorkspaceCreateInput } from '@/types/api';

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const { data } = await apiClient.get<Workspace[]>('/workspaces');
    return data;
  },
  create: async (input: WorkspaceCreateInput): Promise<Workspace> => {
    const { data } = await apiClient.post<Workspace>('/workspaces', input);
    return data;
  },
};
