import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '../../api/workspaces';
import type { Member } from '../../types/api';

/** Members of a given workspace — used for the assignee picker and @mentions.
 * `workspaceId` comes from the task being viewed (not necessarily the current
 * workspace). Disabled/returns [] for a personal workspace with no members. */
export function useMembers(workspaceId: string | null | undefined) {
  return useQuery<Member[]>({
    queryKey: ['members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
}
