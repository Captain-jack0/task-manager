import type { TaskEnergy, TaskListFilters, TaskPriority, TaskSortField } from '@/types/api';

/** Filter/sort controls state — every value is a plain string so it can drive a <select>. */
export interface TaskFilterState {
  priority: TaskPriority | '';
  energy: TaskEnergy | '';
  /** '' = anyone, 'none' = unassigned, otherwise a member user_id. */
  assignee: string;
  due: '' | 'overdue' | 'today' | 'week' | 'none';
  maxMinutes: '' | '15' | '30' | '60' | '120';
  sort: TaskSortField;
  order: 'asc' | 'desc';
}

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  priority: '',
  energy: '',
  assignee: '',
  due: '',
  maxMinutes: '',
  sort: 'created_at',
  order: 'desc',
};

export const SORT_OPTIONS: { value: TaskSortField; label: string }[] = [
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'due_date', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'energy', label: 'Energy' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' },
  { value: 'estimated_minutes', label: 'Estimate' },
];

export function hasActiveFilters(f: TaskFilterState): boolean {
  return Boolean(f.priority || f.energy || f.assignee || f.due || f.maxMinutes);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Translate the control state into API query params. `now` is injectable for tests. */
export function toQuery(f: TaskFilterState, now: Date = new Date()): Partial<TaskListFilters> {
  const due: Partial<TaskListFilters> =
    f.due === 'overdue'
      ? { due_before: now.toISOString() }
      : f.due === 'today'
        ? { due_after: startOfDay(now).toISOString(), due_before: addDays(now, 1).toISOString() }
        : f.due === 'week'
          ? { due_after: startOfDay(now).toISOString(), due_before: addDays(now, 7).toISOString() }
          : f.due === 'none'
            ? { has_due_date: false }
            : {};
  return {
    priority: f.priority || undefined,
    energy: f.energy || undefined,
    assignee_id: f.assignee && f.assignee !== 'none' ? f.assignee : undefined,
    unassigned: f.assignee === 'none' ? true : undefined,
    max_minutes: f.maxMinutes ? Number(f.maxMinutes) : undefined,
    sort: f.sort,
    order: f.order,
    ...due,
  };
}
