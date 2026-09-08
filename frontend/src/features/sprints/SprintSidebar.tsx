import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { Sprint } from '@/types/api';
import { isActiveSprint } from './useSprints';

/** undefined = every task, 'backlog' = tasks with no sprint, otherwise a sprint id. */
export type SprintFilter = undefined | 'backlog' | string;

interface Props {
  sprints: Sprint[];
  value: SprintFilter;
  onChange: (next: SprintFilter) => void;
  onNew: () => void;
  onDelete: (sprint: Sprint) => void;
}

// Sprint dates are plain YYYY-MM-DD; parse as local midnight so a UTC-offset
// browser doesn't show the previous day.
const formatDay = (day: string) => formatDate(`${day}T00:00:00`);

const rowClass = (active: boolean) =>
  cn(
    'rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
    active
      ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  );

export function SprintSidebar({ sprints, value, onChange, onNew, onDelete }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sprints</h2>
        <button
          type="button"
          onClick={onNew}
          title="New sprint"
          aria-label="New sprint"
          className="text-base leading-none text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
        >
          +
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => onChange(undefined)} className={rowClass(value === undefined)}>
          All
        </button>
        <button
          type="button"
          onClick={() => onChange(value === 'backlog' ? undefined : 'backlog')}
          className={rowClass(value === 'backlog')}
        >
          Backlog
        </button>
        {sprints.map((s) => {
          const active = isActiveSprint(s);
          const selected = value === s.id;
          return (
            <div
              key={s.id}
              className={cn(
                'group flex items-start justify-between rounded-lg px-2.5 py-1.5 transition-colors',
                selected ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
            >
              <button
                type="button"
                onClick={() => onChange(selected ? undefined : s.id)}
                title={s.goal ?? undefined}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm">
                  {active && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                      title="Active sprint"
                    />
                  )}
                  <span
                    className={cn(
                      'truncate',
                      selected
                        ? 'font-medium text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300',
                    )}
                  >
                    {s.name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-400">
                    {s.done_count}/{s.task_count}
                  </span>
                </span>
                <span className="block text-[11px] text-slate-400">
                  {formatDay(s.start_date)} – {formatDay(s.end_date)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(s)}
                aria-label={`Delete ${s.name}`}
                className="ml-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
              >
                ×
              </button>
            </div>
          );
        })}
        {sprints.length === 0 && <p className="px-1 text-xs text-slate-400">No sprints yet.</p>}
      </div>
    </div>
  );
}
