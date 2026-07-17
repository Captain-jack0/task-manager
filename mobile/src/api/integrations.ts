import { apiClient } from './client';
import type { GithubRepo, GithubStatus } from '../types/api';

export const integrationsApi = {
  getGithub: async (): Promise<GithubStatus> => {
    const { data } = await apiClient.get<GithubStatus>('/integrations/github');
    return data;
  },
  listRepos: async (): Promise<GithubRepo[]> => {
    const { data } = await apiClient.get<GithubRepo[]>('/integrations/github/repos');
    return data;
  },
};
