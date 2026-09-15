import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Sprint, Task, TaskStatus } from '@/types/api';
import { TagBadge } from '@/features/tags/TagBadge';
import { SprintPicker } from '@/features/sprints/SprintPicker';
import { formatDate, isOverdue } from '@/lib/date';
import { cn } from '@/lib/cn';
import { checklistLabel, stripMarkdown } from '@/lib/markdown';
import { scheduleIso, dateStrToIso } from '@/lib/schedule';
import { NEXT_STATUS, RECURRENCE_LABEL, STATUS_LABEL, isCompleted } from './status';

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

interface Props {
  task: Task;
  projectName?: string;
  projectColor?: string | null;
  assigneeName?: string;
  sprints?: Sprint[];
  selected?: boolean;
  /** Keyboard highlight (j / k). */
  focused?: boolean;
  onSelect?: (checked: boolean) => void;
  onToggleStatus: (next: TaskStatus) => void;
  onMoveToSprint?: (sprintId: string | null) => void;
  onSnooze: () => void;
  onSchedule: (iso: string) => void;
  onDelete: () => void;
}

export function TaskCard({
  task,
  projectName,
  projectColor,
  assigneeName,
  sprints = [],
  selected = false,
  focused = false,
  onSelect,
  onToggleStatus,
  onMoveToSprint,
  onSnooze,
  onSchedule,
  onDelete,
}: Props) {
  const done = isCompleted(task.status);
  const overdue = !done && isOverdue(task.due_date);
  const nextStatus = NEXT_STATUS[task.status];
  const checklist = checklistLabel(task.description);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  return (
    <div
      ref={ref}
      className={cn(
        'group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
        done && 'opacity-60',
        selected && 'border-slate-400 ring-2 ring-slate-300 dark:border-slate-500 dark:ring-slate-600',
        focused && 'border-slate-900 ring-2 ring-slate-900/30 dark:border-white dark:ring-white/30',
      )}
      data-testid="task-card"
      data-focused={focused || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select ${task.title}`}
            className="mt-1 shrink-0 cursor-pointer accent-slate-900 dark:accent-white"
          />
        )}
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'block min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight hover:text-slate-500 dark:hover:text-slate-400',
            done && 'line-through',
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
        <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-slate-500 dark:text-slate-400">
          {stripMarkdown(task.description)}
        </p>
      )}

      {done
        ? task.due_date && (
            <p className={cn('mt-2 text-xs', overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-400')}>
              Due {formatDate(task.due_date)}
            </p>
          )
        : (
          // Open tasks: show the due date (if any) plus one-tap (re)schedule shortcuts.
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            {task.due_date && (
              <span className={cn('font-medium', overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-300')}>
                Due {formatDate(task.due_date)}{overdue && ' · overdue'}
              </span>
            )}
            <span title="Set a due date — also shows the task on your calendar feed">
              {task.due_date ? '· Reschedule:' : '📅 Schedule:'}
            </span>
            {[
              { label: 'Today', days: 0 },
              { label: 'Tomorrow', days: 1 },
              { label: 'Next week', days: 7 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onSchedule(scheduleIso(opt.days))}
                className="font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {opt.label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Pick a due date"
              title="Pick a specific day"
              onChange={(e) => e.currentTarget.value && onSchedule(dateStrToIso(e.currentTarget.value))}
              className="ml-1 cursor-pointer rounded border border-slate-200 bg-transparent px-1 py-0.5 text-slate-500 dark:border-slate-700 dark:text-slate-400"
            />
          </div>
        )}

      {(task.estimated_minutes != null ||
        task.energy_level ||
        task.recurrence ||
        task.snooze_count > 0 ||
        checklist ||
        task.subtask_total > 0 ||
        task.blocked_by.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {task.estimated_minutes != null && <span>~{task.estimated_minutes}m</span>}
          {checklist && <span title="Checklist progress">{checklist}</span>}
          {task.subtask_total > 0 && (
            <span title="Subtasks done">⤷ {task.subtask_done}/{task.subtask_total}</span>
          )}
          {!done && task.blocked_by.length > 0 && (
            <span
              title={`Blocked by: ${task.blocked_by.map((t) => t.title).join(', ')}`}
              className="font-medium text-red-600 dark:text-red-400"
            >
              ⛔ blocked by {task.blocked_by.length}
            </span>
          )}
          {task.energy_level && <span className="capitalize">{task.energy_level} energy</span>}
          {task.recurrence && <span title="Repeats">↻ {RECURRENCE_LABEL[task.recurrence]}</span>}
          {task.snooze_count > 0 && (
            <span
              title="Times postponed"
              className={cn(task.snooze_count >= 3 && 'font-medium text-amber-600 dark:text-amber-400')}
            >
              snoozed {task.snooze_count}×
            </span>
          )}
        </div>
      )}

      {task.parent && (
        <p className="mt-2 truncate text-xs text-slate-400" title={`Subtask of ${task.parent.title}`}>
          ↑ {task.parent.title}
        </p>
      )}

      {projectName && (
        <div className="mt-2.5 inline-flex w-fit items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: projectColor ?? '#94a3b8' }}
          />
          {projectName}
        </div>
      )}

      {assigneeName && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            {assigneeName[0]}
          </span>
          <span className="truncate">{assigneeName}</span>
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
          {onMoveToSprint && (
            <SprintPicker sprints={sprints} value={task.sprint_id} onChange={onMoveToSprint} />
          )}
          {!done && (
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
