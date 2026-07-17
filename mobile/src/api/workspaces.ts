import { apiClient } from './client';
import type { Member, Workspace } from '../types/api';

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const { data } = await apiClient.get<Workspace[]>('/workspaces');
    return data;
  },
  listMembers: async (workspaceId: string): Promise<Member[]> => {
    const { data } = await apiClient.get<Member[]>(`/workspaces/${workspaceId}/members`);
    return data;
  },
};
