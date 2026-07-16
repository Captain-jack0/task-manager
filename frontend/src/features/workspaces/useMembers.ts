import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/api/workspaces';
import type { AddMemberInput, WorkspaceRole } from '@/types/api';

const membersKey = (workspaceId?: string) => ['workspaces', workspaceId ?? null, 'members'];

export function useMembers(workspaceId?: string) {
  return useQuery({
    queryKey: membersKey(workspaceId),
    queryFn: () => workspacesApi.listMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useAddMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => workspacesApi.addMember(workspaceId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(workspaceId) }),
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      workspacesApi.updateMemberRole(workspaceId, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(workspaceId) }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: membersKey(workspaceId) });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
