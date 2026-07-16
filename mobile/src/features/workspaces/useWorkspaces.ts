import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '../../api/workspaces';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { Workspace } from '../../types/api';

export function useWorkspaces() {
  const query = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list(),
    staleTime: 5 * 60_000,
  });

  const current = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrent = useWorkspaceStore((s) => s.setCurrentWorkspace);

  // Default to the first workspace (personal) until the user picks one, and
  // recover if the stored id no longer exists (e.g. left a team).
  useEffect(() => {
    const list = query.data;
    if (!list || list.length === 0) return;
    if (!current || !list.some((w: Workspace) => w.id === current)) {
      setCurrent(list[0].id);
    }
  }, [query.data, current, setCurrent]);

  return query;
}
