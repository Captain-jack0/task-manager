import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import type { Project, Task, TaskStatus } from '@/types/api';
import { TagBadge } from '@/features/tags/TagBadge';
import { cn } from '@/lib/cn';
import { useUpdateTask } from './useTasks';
import { STATUS_LABEL, STATUS_ORDER, isCompleted } from './status';

const COLUMNS = STATUS_ORDER.map((status) => ({ status, label: STATUS_LABEL[status] }));

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function TaskBoard({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const updateMutation = useUpdateTask();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const move = (id: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    updateMutation.mutate(
      { id, input: { status } },
      { onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')) },
    );
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
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
              'flex min-w-[240px] flex-1 flex-col rounded-2xl border p-3 transition-colors',
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
                    isCompleted(task.status) && 'opacity-60',
                  )}
                  data-testid="board-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/tasks/${task.id}`}
                      className={cn(
                        'text-sm font-medium leading-snug tracking-tight hover:text-slate-500 dark:hover:text-slate-400',
                        isCompleted(task.status) && 'line-through',
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
                  {task.project_id && projectById.has(task.project_id) && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-400">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: projectById.get(task.project_id)?.color ?? '#94a3b8' }}
                      />
                      {projectById.get(task.project_id)?.name}
                    </div>
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
