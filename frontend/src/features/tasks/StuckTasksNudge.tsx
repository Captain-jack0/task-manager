import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import type { Task } from '@/types/api';
import { isCompleted } from './status';
import { useDeleteTask, useResetSnooze, useUpdateTask } from './useTasks';

const THRESHOLD = 3;

export function StuckTasksNudge({ tasks }: { tasks: Task[] }) {
  const update = useUpdateTask();
  const resetSnooze = useResetSnooze();
  const del = useDeleteTask();

  const stuck = tasks.filter((t) => t.snooze_count >= THRESHOLD && !isCompleted(t.status));
  if (stuck.length === 0) return null;

  const doToday = (t: Task) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    update.mutate(
      { id: t.id, input: { due_date: today.toISOString() } },
      {
        onSuccess: () => {
          resetSnooze.mutate(t.id);
          toast.success('Scheduled for today');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')),
      },
    );
  };

  const deprioritize = (t: Task) => {
    update.mutate(
      { id: t.id, input: { priority: 'low' } },
      {
        onSuccess: () => {
          resetSnooze.mutate(t.id);
          toast.success('Lowered priority');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')),
      },
    );
  };

  const dismiss = (t: Task) =>
    resetSnooze.mutate(t.id, { onSuccess: () => toast.success('Dismissed') });

  const remove = (t: Task) => {
    if (!window.confirm('Delete this task?')) return;
    del.mutate(t.id, { onSuccess: () => toast.success('Deleted') });
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <h2 className="text-sm font-semibold tracking-tight text-amber-900 dark:text-amber-200">
        Keep getting snoozed
      </h2>
      <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/70">
        These have been pushed back a few times — too big, or no longer needed?
      </p>
      <ul className="mt-3 space-y-2">
        {stuck.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-900/50"
          >
            <div className="min-w-0">
              <Link
                to={`/tasks/${t.id}`}
                className="block truncate text-sm font-medium hover:text-slate-500 dark:hover:text-slate-400"
              >
                {t.title}
              </Link>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                snoozed {t.snooze_count}×
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => doToday(t)}>
                Do today
              </Button>
              <Button size="sm" variant="secondary" onClick={() => deprioritize(t)}>
                Lower priority
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(t)}>
                Dismiss
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
