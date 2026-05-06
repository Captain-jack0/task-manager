import { Link } from 'react-router-dom';
import type { Task, TaskStatus } from '@/types/api';
import { TagBadge } from '@/features/tags/TagBadge';
import { formatDate, isOverdue } from '@/lib/date';
import { cn } from '@/lib/cn';

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

interface Props {
  task: Task;
  onToggleStatus: (next: TaskStatus) => void;
  onDelete: () => void;
}

export function TaskCard({ task, onToggleStatus, onDelete }: Props) {
  const overdue = task.status !== 'done' && isOverdue(task.due_date);
  const nextStatus: TaskStatus =
    task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-900',
        task.status === 'done'
          ? 'border-slate-200 opacity-70 dark:border-slate-800'
          : 'border-slate-200 dark:border-slate-800',
      )}
      data-testid="task-card"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'block text-base font-semibold hover:underline',
            task.status === 'done' && 'line-through',
          )}
        >
          {task.title}
        </Link>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_STYLES[task.priority])}>
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
          {task.description}
        </p>
      )}

      {task.due_date && (
        <p className={cn('mt-2 text-xs', overdue ? 'text-red-600' : 'text-slate-500')}>
          Due {formatDate(task.due_date)}{overdue && ' (overdue)'}
        </p>
      )}

      {task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onToggleStatus(nextStatus)}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          → {nextStatus.replace('_', ' ')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-slate-500 hover:text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
