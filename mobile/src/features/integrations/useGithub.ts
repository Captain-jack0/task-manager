import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '../../api/integrations';
import { tasksApi } from '../../api/tasks';
import type { GithubStatus } from '../../types/api';

export function useGithubStatus() {
  return useQuery<GithubStatus>({
    queryKey: ['github', 'status'],
    queryFn: () => integrationsApi.getGithub(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateGithubIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.createGithubIssue(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
