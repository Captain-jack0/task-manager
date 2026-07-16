import { apiClient } from './client';
import type { GithubConnectInput, GithubStatus } from '@/types/api';

export const integrationsApi = {
  getGithub: async (): Promise<GithubStatus> => {
    const { data } = await apiClient.get<GithubStatus>('/integrations/github');
    return data;
  },
  connectGithub: async (input: GithubConnectInput): Promise<GithubStatus> => {
    const { data } = await apiClient.put<GithubStatus>('/integrations/github', input);
    return data;
  },
  disconnectGithub: async (): Promise<void> => {
    await apiClient.delete('/integrations/github');
  },
};
