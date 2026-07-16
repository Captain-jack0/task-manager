import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import type { ProjectCreateInput } from '@/types/api';

export const PROJECTS_KEY = ['projects'] as const;

export function useProjects(workspaceId?: string) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, workspaceId ?? null],
    queryFn: () => projectsApi.list(workspaceId),
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectCreateInput) =>
      projectsApi.create(input, useWorkspaceStore.getState().currentWorkspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
