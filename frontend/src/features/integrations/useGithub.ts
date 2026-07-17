import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/api/integrations';
import type { GithubConnectInput } from '@/types/api';

export const GITHUB_KEY = ['integrations', 'github'] as const;

export function useGithubStatus() {
  return useQuery({
    queryKey: GITHUB_KEY,
    queryFn: () => integrationsApi.getGithub(),
    staleTime: 60_000,
  });
}

export function useGithubRepos(enabled: boolean) {
  return useQuery({
    queryKey: [...GITHUB_KEY, 'repos'],
    queryFn: () => integrationsApi.listRepos(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useConnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GithubConnectInput) => integrationsApi.connectGithub(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: GITHUB_KEY }),
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.disconnectGithub(),
    onSuccess: () => qc.invalidateQueries({ queryKey: GITHUB_KEY }),
  });
}
