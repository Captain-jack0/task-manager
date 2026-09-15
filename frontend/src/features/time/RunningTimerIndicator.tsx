import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import { formatClock, useElapsedSeconds, useRunningTimer, useStopTimer } from './useTime';

/** Header pill: which task is being timed and for how long, with a stop button. */
export function RunningTimerIndicator() {
  const { data: running } = useRunningTimer();
  const stop = useStopTimer();
  const elapsed = useElapsedSeconds(running?.entry.started_at ?? null);
  if (!running) return null;

  return (
    <div className="hidden items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 py-0.5 pl-2.5 pr-1 text-xs text-emerald-800 md:flex dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
      <Link to={`/tasks/${running.entry.task_id}`} className="max-w-[10rem] truncate font-medium hover:underline">
        {running.task_title || 'Task'}
      </Link>
      <span className="font-mono tabular-nums">{formatClock(elapsed)}</span>
      <button
        type="button"
        onClick={() =>
          stop.mutate(running.entry.task_id, {
            onSuccess: (e) => toast.success(`Logged ${e.minutes} min`),
            onError: (err) => toast.error(extractErrorMessage(err, 'Could not stop timer')),
          })
        }
        disabled={stop.isPending}
        aria-label="Stop timer"
        className="rounded-full px-1.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
      >
        ■
      </button>
    </div>
  );
}
