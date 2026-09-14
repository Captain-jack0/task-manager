import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { extractErrorMessage } from '@/api/client';
import { useTasks } from '@/features/tasks/useTasks';
import type { Sprint } from '@/types/api';
import { isOpenSprint, useCloseSprint } from './useSprints';

interface Props {
  sprint: Sprint | null;
  sprints: Sprint[];
  onClose: () => void;
}

const SELECT =
  'cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10';

/** Complete a sprint: choose where its unfinished tasks go; closed tasks stay as history. */
export function CompleteSprintModal({ sprint, sprints, onClose }: Props) {
  const [moveTo, setMoveTo] = useState<string>('');
  const closeSprint = useCloseSprint();
  const preview = useTasks({ sprint_id: sprint?.id, limit: 100 }, Boolean(sprint));

  if (!sprint) return null;

  const tasks = preview.data?.data ?? [];
  const closedCount = tasks.filter((t) => t.status === 'closed').length;
  const unfinished = (preview.data?.total ?? tasks.length) - closedCount;
  const targets = sprints.filter((s) => isOpenSprint(s) && s.id !== sprint.id);

  const confirm = () => {
    closeSprint.mutate(
      { id: sprint.id, moveTo: moveTo || null },
      {
        onSuccess: (r) => {
          const dest = targets.find((s) => s.id === moveTo)?.name ?? 'the backlog';
          toast.success(`Sprint completed: ${r.moved} moved to ${dest}, ${r.kept} kept as history`);
          onClose();
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not complete sprint')),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Complete "${sprint.name}"`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={closeSprint.isPending}>
            Cancel
          </Button>
          <Button onClick={confirm} isLoading={closeSprint.isPending} disabled={preview.isLoading}>
            Complete sprint
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {preview.isLoading ? (
          <p className="text-slate-500">Counting tasks…</p>
        ) : (
          <ul className="space-y-1 text-slate-600 dark:text-slate-300">
            <li>
              <span className="font-medium text-slate-900 dark:text-white">{unfinished}</span> unfinished
              task{unfinished === 1 ? '' : 's'} (To do, In progress, Blocked, Done (Test)) will be moved.
            </li>
            <li>
              <span className="font-medium text-slate-900 dark:text-white">{closedCount}</span> closed
              task{closedCount === 1 ? '' : 's'} stay here as history.
            </li>
          </ul>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="move-to" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Move unfinished tasks to
          </label>
          <select id="move-to" className={SELECT} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">Backlog</option>
            {targets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.start_date} → {s.end_date}
              </option>
            ))}
          </select>
          {targets.length === 0 && (
            <p className="text-xs text-slate-400">No other open sprint yet — create the next one first if you want to carry tasks into it.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
