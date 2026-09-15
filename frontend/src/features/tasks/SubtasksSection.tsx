import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { tasksApi } from '@/api/tasks';
import { cn } from '@/lib/cn';
import type { Task } from '@/types/api';
import { STATUS_BADGE, STATUS_LABEL, isCompleted } from './status';
import { TASKS_KEY, useTasks, useUpdateTask } from './useTasks';

/** Children of a task: tick to finish, add more inline. One level only. */
export function SubtasksSection({ task }: { task: Task }) {
  const [title, setTitle] = useState('');
  const qc = useQueryClient();
  const children = useTasks({
    workspace_id: task.workspace_id,
    parent_id: task.id,
    sort: 'created_at',
    order: 'asc',
    limit: 100,
  });
  const update = useUpdateTask();
  const create = useMutation({
    mutationFn: (name: string) =>
      tasksApi.create(
        { title: name, parent_id: task.id, sprint_id: task.sprint_id, project_id: task.project_id },
        task.workspace_id,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      setTitle('');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not add subtask')),
  });

  const items = children.data?.data ?? [];
  const done = items.filter((t) => isCompleted(t.status)).length;

  const submit = () => {
    const name = title.trim();
    if (name) create.mutate(name);
  };

  const toggle = (sub: Task, checked: boolean) =>
    update.mutate(
      { id: sub.id, input: { status: checked ? 'done' : 'todo' } },
      { onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')) },
    );

  return (
    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Subtasks{items.length > 0 && <span className="ml-2 normal-case tracking-normal">{done}/{items.length}</span>}
      </h2>

      {items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((sub) => (
            <li key={sub.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isCompleted(sub.status)}
                onChange={(e) => toggle(sub, e.target.checked)}
                aria-label={`Mark ${sub.title} ${isCompleted(sub.status) ? 'not done' : 'done'}`}
                className="cursor-pointer accent-slate-900 dark:accent-white"
              />
              <Link
                to={`/tasks/${sub.id}`}
                className={cn(
                  'min-w-0 truncate text-slate-700 hover:underline dark:text-slate-300',
                  isCompleted(sub.status) && 'line-through text-slate-400',
                )}
              >
                {sub.title}
              </Link>
              <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_BADGE[sub.status])}>
                {STATUS_LABEL[sub.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <Input
          aria-label="New subtask"
          placeholder="Add a subtask…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          className="flex-1"
        />
        <Button size="sm" onClick={submit} isLoading={create.isPending} disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
