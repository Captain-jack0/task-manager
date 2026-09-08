import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sprintsApi } from '@/api/sprints';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import type { Sprint, SprintCreateInput, SprintUpdateInput } from '@/types/api';

export const SPRINTS_KEY = ['sprints'] as const;

export function useSprints(workspaceId?: string) {
  return useQuery({
    queryKey: [...SPRINTS_KEY, workspaceId ?? null],
    queryFn: () => sprintsApi.list(workspaceId),
    staleTime: 30_000,
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SprintCreateInput) =>
      sprintsApi.create(input, useWorkspaceStore.getState().currentWorkspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SPRINTS_KEY }),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SprintUpdateInput }) =>
      sprintsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: SPRINTS_KEY }),
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sprintsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPRINTS_KEY });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/** Today falls inside the sprint's date range (dates are YYYY-MM-DD, compared as strings). */
export function isActiveSprint(sprint: Sprint, today: string = localToday()): boolean {
  return sprint.start_date <= today && today <= sprint.end_date;
}

export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
