import type { TaskStatus } from '../../types/api';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done (Test)',
  closed: 'Closed',
};

// Colour per status for the small badge pill.
export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: '#64748b',
  in_progress: '#4f46e5',
  blocked: '#dc2626',
  done: '#059669',
  closed: '#94a3b8',
};

// The single forward action shown on a task ("→ In progress", "→ Done", …).
export const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: 'in_progress',
  in_progress: 'done',
  blocked: 'in_progress',
  done: 'closed',
};

export function isCompleted(status: TaskStatus): boolean {
  return status === 'done' || status === 'closed';
}
