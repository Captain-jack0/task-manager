import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { STATUS_LABEL, STATUS_ORDER } from '@/features/tasks/status';
import { formatDate } from '@/lib/date';
import type { Sprint, TaskStatus } from '@/types/api';
import { useSprintReport } from './useSprints';

interface Props {
  sprint: Sprint | null;
  onClose: () => void;
}

const BAR: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-amber-500',
  closed: 'bg-emerald-500',
};

const formatDay = (day: string) => formatDate(`${day}T00:00:00`);

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} h`;
}

/** Sprint summary: progress, status breakdown, estimates, carry-over. */
export function SprintReportModal({ sprint, onClose }: Props) {
  const report = useSprintReport(sprint?.id);
  if (!sprint) return null;
  const r = report.data;
  const pct = r && r.total > 0 ? Math.round((r.finished / r.total) * 100) : 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${sprint.name} · summary`}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <p className="text-xs text-slate-400">
          {formatDay(sprint.start_date)} – {formatDay(sprint.end_date)}
          {sprint.closed_at && ` · completed ${formatDate(sprint.closed_at)}`}
        </p>
        {sprint.goal && <p className="italic">“{sprint.goal}”</p>}

        {report.isLoading || !r ? (
          <p className="text-slate-500">Loading…</p>
        ) : (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-white">
                  {r.finished}/{r.total} finished
                </span>
                <span className="text-xs text-slate-400">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ul className="space-y-1.5">
              {STATUS_ORDER.map((s) => {
                const count = r.by_status[s] ?? 0;
                const width = r.total > 0 ? (count / r.total) * 100 : 0;
                return (
                  <li key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-slate-500">{STATUS_LABEL[s]}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className={`block h-full rounded-full ${BAR[s]}`} style={{ width: `${width}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-slate-500">
              Estimated work: {formatMinutes(r.estimated_minutes_finished)} finished of{' '}
              {formatMinutes(r.estimated_minutes)} planned.
            </p>
            {sprint.closed_at && (
              <p className="text-xs text-slate-500">
                {r.sprint.carried_over} task{r.sprint.carried_over === 1 ? '' : 's'} carried over when the sprint
                was completed; {r.total} kept here as history.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
