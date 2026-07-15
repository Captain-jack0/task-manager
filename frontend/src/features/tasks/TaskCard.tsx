import { Link } from 'react-router-dom';
import type { Task, TaskStatus } from '@/types/api';
import { TagBadge } from '@/features/tags/TagBadge';
import { formatDate, isOverdue } from '@/lib/date';
import { cn } from '@/lib/cn';

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

interface Props {
  task: Task;
  onToggleStatus: (next: TaskStatus) => void;
  onSnooze: () => void;
  onDelete: () => void;
}

export function TaskCard({ task, onToggleStatus, onSnooze, onDelete }: Props) {
  const overdue = task.status !== 'done' && isOverdue(task.due_date);
  const nextStatus: TaskStatus =
    task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';

  return (
    <div
      className={cn(
        'group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
        task.status === 'done' && 'opacity-60',
      )}
      data-testid="task-card"
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'block text-sm font-semibold leading-snug tracking-tight hover:text-slate-500 dark:hover:text-slate-400',
            task.status === 'done' && 'line-through',
          )}
        >
          {task.title}
        </Link>
        <span
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
          title={`${task.priority} priority`}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {task.description}
        </p>
      )}

      {task.due_date && (
        <p className={cn('mt-2 text-xs', overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-400')}>
          Due {formatDate(task.due_date)}{overdue && ' · overdue'}
        </p>
      )}

      {(task.estimated_minutes != null || task.energy_level || task.snooze_count > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {task.estimated_minutes != null && <span>~{task.estimated_minutes}m</span>}
          {task.energy_level && <span className="capitalize">{task.energy_level} energy</span>}
          {task.snooze_count > 0 && (
            <span title="Times postponed">snoozed {task.snooze_count}×</span>
          )}
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onToggleStatus(nextStatus)}
          className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          Move to {STATUS_LABEL[nextStatus]} →
        </button>
        <div className="flex items-center gap-3">
          {task.status !== 'done' && (
            <button
              type="button"
              onClick={onSnooze}
              title="Push to tomorrow"
              className="text-xs text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
            >
              Snooze
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-400 opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
