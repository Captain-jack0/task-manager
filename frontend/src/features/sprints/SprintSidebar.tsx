import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { Sprint } from '@/types/api';
import { isActiveSprint, isOpenSprint, isOverdueSprint } from './useSprints';

/** undefined = every task, 'backlog' = tasks with no sprint, otherwise a sprint id. */
export type SprintFilter = undefined | 'backlog' | string;

interface Props {
  sprints: Sprint[];
  value: SprintFilter;
  onChange: (next: SprintFilter) => void;
  onNew: () => void;
  onEdit: (sprint: Sprint) => void;
  onComplete: (sprint: Sprint) => void;
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

const ICON_BUTTON =
  'ml-1 text-slate-400 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100';

function SprintRow({
  sprint,
  selected,
  onSelect,
  onEdit,
  onComplete,
  onDelete,
}: {
  sprint: Sprint;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onComplete?: () => void;
  onDelete: () => void;
}) {
  const active = isActiveSprint(sprint);
  const overdue = isOverdueSprint(sprint);
  return (
    <div
      className={cn(
        'group flex items-start justify-between rounded-lg px-2.5 py-1.5 transition-colors',
        selected ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
      )}
    >
      <button type="button" onClick={onSelect} title={sprint.goal ?? undefined} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5 text-sm">
          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Active sprint" />}
          <span
            className={cn(
              'truncate',
              selected ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300',
              !isOpenSprint(sprint) && 'text-slate-400 dark:text-slate-500',
            )}
          >
            {sprint.name}
          </span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-400">
            {sprint.done_count}/{sprint.task_count}
          </span>
        </span>
        <span className="block text-[11px] text-slate-400">
          {formatDay(sprint.start_date)} – {formatDay(sprint.end_date)}
          {overdue && <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">· ended</span>}
        </span>
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${sprint.name}`}
          title="Edit sprint"
          className={cn(ICON_BUTTON, 'hover:text-slate-700 dark:hover:text-slate-200')}
        >
          ✎
        </button>
      )}
      {onComplete && (
        <button
          type="button"
          onClick={onComplete}
          aria-label={`Complete ${sprint.name}`}
          title="Complete sprint: carry unfinished tasks over, keep closed ones here"
          className={cn(ICON_BUTTON, 'hover:text-emerald-600 dark:hover:text-emerald-400', overdue && 'opacity-100')}
        >
          ✓
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${sprint.name}`}
        className={cn(ICON_BUTTON, 'hover:text-red-600 dark:hover:text-red-400')}
      >
        ×
      </button>
    </div>
  );
}

export function SprintSidebar({ sprints, value, onChange, onNew, onEdit, onComplete, onDelete }: Props) {
  const [showClosed, setShowClosed] = useState(false);
  const open = sprints.filter(isOpenSprint);
  const closed = sprints.filter((s) => !isOpenSprint(s));
  const select = (id: string) => onChange(value === id ? undefined : id);

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
        {open.map((s) => (
          <SprintRow
            key={s.id}
            sprint={s}
            selected={value === s.id}
            onSelect={() => select(s.id)}
            onEdit={() => onEdit(s)}
            onComplete={() => onComplete(s)}
            onDelete={() => onDelete(s)}
          />
        ))}
        {open.length === 0 && <p className="px-1 text-xs text-slate-400">No open sprints.</p>}

        {closed.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              aria-expanded={showClosed}
              className="mt-2 px-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showClosed ? '▾' : '▸'} Closed ({closed.length})
            </button>
            {showClosed &&
              closed.map((s) => (
                <SprintRow
                  key={s.id}
                  sprint={s}
                  selected={value === s.id}
                  onSelect={() => select(s.id)}
                  onDelete={() => onDelete(s)}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
