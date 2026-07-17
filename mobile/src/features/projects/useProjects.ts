import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { Project, ProjectCreateInput } from '../../types/api';

export function useProjects() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useQuery<Project[]>({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: ProjectCreateInput) => projectsApi.create(input, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  });
}
