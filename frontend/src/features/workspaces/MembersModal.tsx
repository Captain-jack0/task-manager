import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { extractErrorMessage } from '@/api/client';
import type { Workspace, WorkspaceRole } from '@/types/api';
import {
  useAddMember,
  useCapacity,
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from './useMembers';

const ROLES: WorkspaceRole[] = ['admin', 'member', 'guest'];

function formatLoad(min: number): string {
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}
const SELECT_CLASS =
  'rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200';

interface Props {
  workspace: Workspace;
  open: boolean;
  onClose: () => void;
}

export function MembersModal({ workspace, open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const { data: members } = useMembers(open ? workspace.id : undefined);
  const { data: capacity } = useCapacity(open ? workspace.id : undefined, !workspace.is_personal);
  const addMember = useAddMember(workspace.id);
  const updateRole = useUpdateMemberRole(workspace.id);
  const removeMember = useRemoveMember(workspace.id);

  const canManage =
    (workspace.role === 'owner' || workspace.role === 'admin') && !workspace.is_personal;
  const maxLoad = Math.max(1, ...(capacity ?? []).map((c) => c.estimated_minutes));

  const handleAdd = () => {
    if (!email.trim()) return;
    addMember.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          toast.success('Member added');
          setEmail('');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not add member')),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={`Members · ${workspace.name}`}>
      {workspace.is_personal ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Personal workspaces are private and have no members.
        </p>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate text-sm">{m.email}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {canManage && m.role !== 'owner' ? (
                    <select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      onChange={(e) =>
                        updateRole.mutate({ userId: m.user_id, role: e.target.value as WorkspaceRole })
                      }
                      className={SELECT_CLASS}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs capitalize text-slate-500">{m.role}</span>
                  )}
                  {canManage && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => removeMember.mutate(m.user_id)}
                      className="text-xs text-slate-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {canManage ? (
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="mb-2 block text-xs font-medium text-slate-500">
                Add member by email
              </span>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  aria-label="Member email"
                  type="email"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-[12rem] flex-1"
                />
                <select
                  aria-label="New member role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                  className="rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Button onClick={handleAdd} isLoading={addMember.isPending} disabled={!email.trim()}>
                  Add
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                The person must already have an account.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Only owners and admins can manage members.
            </p>
          )}

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="mb-2 block text-xs font-medium text-slate-500">
              Team load · open assigned tasks
            </span>
            <div className="space-y-2.5">
              {(capacity ?? []).map((c) => (
                <div key={c.user_id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                      {c.email}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {c.open_task_count} open · {formatLoad(c.estimated_minutes)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-slate-900 dark:bg-slate-200"
                      style={{ width: `${Math.round((c.estimated_minutes / maxLoad) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {(capacity ?? []).length === 0 && (
                <p className="text-xs text-slate-400">No members.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
