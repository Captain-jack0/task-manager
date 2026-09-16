import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import { cn } from '@/lib/cn';
import { formatClock, useElapsedSeconds, useRunningTimer, useStartTimer, useStopTimer } from './useTime';

interface Props {
  taskId: string;
  className?: string;
}

/** ▶ Start / ■ Stop for one task; shows the live clock while this task's timer runs. */
export function TimerButton({ taskId, className }: Props) {
  const { data: running } = useRunningTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const isThis = running?.entry.task_id === taskId;
  const elapsed = useElapsedSeconds(isThis ? running?.entry.started_at : null);
  const pending = start.isPending || stop.isPending;

  const onClick = () => {
    if (isThis) {
      stop.mutate(taskId, {
        onSuccess: (e) => toast.success(`Logged ${e.minutes} min`),
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not stop timer')),
      });
    } else {
      start.mutate(taskId, {
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not start timer')),
      });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={isThis}
      title={isThis ? 'Stop the timer' : running ? 'Start here (stops your other timer)' : 'Start the timer'}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs transition-colors',
        isThis
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white',
        className,
      )}
    >
      {isThis ? `■ ${formatClock(elapsed)}` : '▶'}
    </button>
  );
}
