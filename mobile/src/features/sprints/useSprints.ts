import { useQuery } from '@tanstack/react-query';
import { sprintsApi } from '../../api/sprints';
import type { Sprint } from '../../types/api';

export function useSprints(workspaceId?: string | null) {
  return useQuery<Sprint[]>({
    queryKey: ['sprints', workspaceId ?? null],
    queryFn: () => sprintsApi.list(workspaceId),
    staleTime: 30_000,
  });
}

export const isOpenSprint = (s: Sprint): boolean => s.closed_at === null;
