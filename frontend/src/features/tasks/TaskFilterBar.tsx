import type { Member } from '@/types/api';
import {
  DEFAULT_TASK_FILTERS,
  hasActiveFilters,
  SORT_OPTIONS,
  type TaskFilterState,
} from './taskFilters';

interface Props {
  value: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  members: Member[];
}

const SELECT =
  'cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs text-slate-700 transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-600 dark:focus:ring-white/10';

const LEVELS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

export function TaskFilterBar({ value, onChange, members }: Props) {
  const set = <K extends keyof TaskFilterState>(key: K, next: TaskFilterState[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by priority"
        className={SELECT}
        value={value.priority}
        onChange={(e) => set('priority', e.target.value as TaskFilterState['priority'])}
      >
        <option value="">Any priority</option>
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label} priority
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by energy"
        className={SELECT}
        value={value.energy}
        onChange={(e) => set('energy', e.target.value as TaskFilterState['energy'])}
      >
        <option value="">Any energy</option>
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label} energy
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by assignee"
        className={SELECT}
        value={value.assignee}
        onChange={(e) => set('assignee', e.target.value)}
      >
        <option value="">Anyone</option>
        <option value="none">Unassigned</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.email}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by due date"
        className={SELECT}
        value={value.due}
        onChange={(e) => set('due', e.target.value as TaskFilterState['due'])}
      >
        <option value="">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="week">Due this week</option>
        <option value="none">No due date</option>
      </select>

      <select
        aria-label="Filter by estimate"
        className={SELECT}
        value={value.maxMinutes}
        onChange={(e) => set('maxMinutes', e.target.value as TaskFilterState['maxMinutes'])}
      >
        <option value="">Any length</option>
        <option value="15">≤ 15 min</option>
        <option value="30">≤ 30 min</option>
        <option value="60">≤ 1 h</option>
        <option value="120">≤ 2 h</option>
      </select>

      {hasActiveFilters(value) && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_TASK_FILTERS, sort: value.sort, order: value.order })}
          className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          Clear filters
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <label htmlFor="task-sort" className="text-xs text-slate-400">
          Sort
        </label>
        <select
          id="task-sort"
          className={SELECT}
          value={value.sort}
          onChange={(e) => set('sort', e.target.value as TaskFilterState['sort'])}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => set('order', value.order === 'asc' ? 'desc' : 'asc')}
          aria-label={value.order === 'asc' ? 'Ascending, click for descending' : 'Descending, click for ascending'}
          title={value.order === 'asc' ? 'Ascending' : 'Descending'}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {value.order === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  );
}
