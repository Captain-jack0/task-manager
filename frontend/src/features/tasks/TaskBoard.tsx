import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import type { Task, TaskStatus } from '@/types/api';
import { TagBadge } from '@/features/tags/TagBadge';
import { cn } from '@/lib/cn';
import { useUpdateTask } from './useTasks';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const updateMutation = useUpdateTask();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  const move = (id: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    updateMutation.mutate(
      { id, input: { status } },
      { onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')) },
    );
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStatus(col.status);
            }}
            onDragLeave={() => setOverStatus((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || dragId;
              if (id) move(id, col.status);
              setDragId(null);
              setOverStatus(null);
            }}
            className={cn(
              'rounded-2xl border p-3 transition-colors',
              overStatus === col.status
                ? 'border-slate-400 bg-slate-100/70 dark:border-slate-600 dark:bg-slate-800/50'
                : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40',
            )}
            data-testid={`board-column-${col.status}`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {col.label}
              </h3>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="flex min-h-[60px] flex-col gap-2">
              {items.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', task.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId(task.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStatus(null);
                  }}
                  className={cn(
                    'cursor-grab rounded-xl border border-slate-200 bg-white p-3 transition-shadow hover:shadow-sm active:cursor-grabbing dark:border-slate-800 dark:bg-slate-900',
                    dragId === task.id && 'opacity-50',
                    task.status === 'done' && 'opacity-60',
                  )}
                  data-testid="board-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/tasks/${task.id}`}
                      className={cn(
                        'text-sm font-medium leading-snug tracking-tight hover:text-slate-500 dark:hover:text-slate-400',
                        task.status === 'done' && 'line-through',
                      )}
                    >
                      {task.title}
                    </Link>
                    <span
                      className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
                      title={`${task.priority} priority`}
                    />
                  </div>
                  {(task.estimated_minutes != null || task.energy_level) && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      {task.estimated_minutes != null && `~${task.estimated_minutes}m`}
                      {task.estimated_minutes != null && task.energy_level && ' · '}
                      {task.energy_level && `${task.energy_level} energy`}
                    </p>
                  )}
                  {task.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-slate-400">Drop tasks here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
