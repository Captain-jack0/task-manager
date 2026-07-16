import type { TaskStatus } from '@/types/api';

/** Workflow order: To do → In progress → Blocked → Done (Test) → Closed. */
export const STATUS_ORDER: TaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'done',
  'closed',
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done (Test)',
  closed: 'Closed',
};

/** Where the single "Move to →" action on a card sends each status. */
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  blocked: 'in_progress',
  done: 'closed',
  closed: 'todo',
};

export const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  done: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

/** Statuses treated as "finished" (struck through, not overdue, not suggested). */
const COMPLETED: TaskStatus[] = ['done', 'closed'];
export const isCompleted = (status: TaskStatus): boolean => COMPLETED.includes(status);
