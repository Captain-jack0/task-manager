import { apiClient } from './client';
import type { GithubStatus } from '../types/api';

export const integrationsApi = {
  getGithub: async (): Promise<GithubStatus> => {
    const { data } = await apiClient.get<GithubStatus>('/integrations/github');
    return data;
  },
};
