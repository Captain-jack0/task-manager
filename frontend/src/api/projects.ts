import { apiClient } from './client';
import type { Project, ProjectCreateInput, ProjectUpdateInput } from '@/types/api';

export const projectsApi = {
  list: async (workspaceId?: string | null): Promise<Project[]> => {
    const { data } = await apiClient.get<Project[]>('/projects', {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
  create: async (
    input: ProjectCreateInput,
    workspaceId?: string | null,
  ): Promise<Project> => {
    const { data } = await apiClient.post<Project>('/projects', input, {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
  update: async (id: string, input: ProjectUpdateInput): Promise<Project> => {
    const { data } = await apiClient.put<Project>(`/projects/${id}`, input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
};
