import { useEffect } from 'react';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import { useWorkspaceStore } from './workspaceStore';
import { useCreateWorkspace, useWorkspaces } from './useWorkspaces';

export function WorkspaceSwitcher() {
  const { data: workspaces } = useWorkspaces();
  const currentId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrent = useWorkspaceStore((s) => s.setCurrentWorkspaceId);
  const createWorkspace = useCreateWorkspace();

  // Default to the personal workspace once loaded, or if the stored id is stale.
  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;
    const valid = currentId && workspaces.some((w) => w.id === currentId);
    if (!valid) {
      const personal = workspaces.find((w) => w.is_personal) ?? workspaces[0];
      setCurrent(personal.id);
    }
  }, [workspaces, currentId, setCurrent]);

  const handleCreate = () => {
    const name = window.prompt('Team workspace name');
    if (!name?.trim()) return;
    createWorkspace.mutate(
      { name: name.trim() },
      {
        onSuccess: (ws) => {
          setCurrent(ws.id);
          toast.success(`Workspace "${ws.name}" created`);
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not create workspace')),
      },
    );
  };

  if (!workspaces || workspaces.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Current workspace"
        value={currentId ?? ''}
        onChange={(e) => setCurrent(e.target.value)}
        className="cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-8 text-sm text-slate-700 transition-colors focus:border-slate-400 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.is_personal ? 'Personal' : w.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleCreate}
        title="New team workspace"
        aria-label="New team workspace"
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        +
      </button>
    </div>
  );
}
