import { apiClient } from './client';
import type { Workspace } from '../types/api';

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const { data } = await apiClient.get<Workspace[]>('/workspaces');
    return data;
  },
};
