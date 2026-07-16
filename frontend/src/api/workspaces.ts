import { apiClient } from './client';
import type {
  AddMemberInput,
  Member,
  Workspace,
  WorkspaceCreateInput,
  WorkspaceRole,
} from '@/types/api';

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const { data } = await apiClient.get<Workspace[]>('/workspaces');
    return data;
  },
  create: async (input: WorkspaceCreateInput): Promise<Workspace> => {
    const { data } = await apiClient.post<Workspace>('/workspaces', input);
    return data;
  },
  listMembers: async (workspaceId: string): Promise<Member[]> => {
    const { data } = await apiClient.get<Member[]>(`/workspaces/${workspaceId}/members`);
    return data;
  },
  addMember: async (workspaceId: string, input: AddMemberInput): Promise<Member> => {
    const { data } = await apiClient.post<Member>(`/workspaces/${workspaceId}/members`, input);
    return data;
  },
  updateMemberRole: async (
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<Member> => {
    const { data } = await apiClient.put<Member>(
      `/workspaces/${workspaceId}/members/${userId}`,
      { role },
    );
    return data;
  },
  removeMember: async (workspaceId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`);
  },
};
