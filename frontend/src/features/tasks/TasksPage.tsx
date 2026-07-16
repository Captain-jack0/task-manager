import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { extractErrorMessage } from '@/api/client';
import type { TaskStatus } from '@/types/api';
import { TagBadge } from '@/features/tags/TagBadge';
import { useTags, useDeleteTag } from '@/features/tags/useTags';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { cn } from '@/lib/cn';
import { SuggestPanel } from './SuggestPanel';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import type { TaskFormValues } from './schemas';
import { useCreateTask, useTasks } from './useTasks';

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;

  const { data: tagList } = useTags();
  const deleteTag = useDeleteTag();
  const tasksQuery = useTasks({
    workspace_id: workspaceId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    tag_id: tagFilter,
    search: search || undefined,
    limit: 50,
  });
  const createTask = useCreateTask();

  const handleCreate = (values: TaskFormValues) => {
    createTask.mutate(
      {
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
        energy_level: values.energy_level || null,
        estimated_minutes: values.estimated_minutes ? Number(values.estimated_minutes) : null,
        tag_ids: values.tag_ids,
      },
      {
        onSuccess: () => {
          toast.success('Task created');
          setCreateOpen(false);
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not create task')),
      },
    );
  };

  const handleDeleteTag = (id: string, name: string) => {
    if (!window.confirm(`Delete tag "${name}"?`)) return;
    deleteTag.mutate(id, {
      onSuccess: () => {
        toast.success('Tag deleted');
        if (tagFilter === id) setTagFilter(undefined);
      },
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not delete tag')),
    });
  };

  const tasks = tasksQuery.data?.data ?? [];
  const total = tasksQuery.data?.total ?? tasks.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {tasksQuery.isLoading ? 'Loading…' : `${total} ${total === 1 ? 'task' : 'tasks'}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New task</Button>
      </div>

      <SuggestPanel workspaceId={workspaceId} />

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="space-y-6">
          <div>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status
            </h2>
            <div className="flex flex-col gap-0.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                    statusFilter === opt.value
                      ? 'bg-slate-900 font-medium text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tags
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTagFilter(undefined)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  tagFilter === undefined
                    ? 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                All
              </button>
              {(tagList ?? []).map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  selected={tagFilter === tag.id}
                  onClick={() => setTagFilter(tag.id === tagFilter ? undefined : tag.id)}
                  onRemove={() => handleDeleteTag(tag.id, tag.name)}
                />
              ))}
              {(tagList ?? []).length === 0 && (
                <p className="px-1 text-xs text-slate-400">No tags yet.</p>
              )}
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-5">
            <Input
              aria-label="Search tasks"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm"
            />
          </div>

          {tasksQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : tasksQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load tasks.</p>
          ) : tasks.length === 0 ? (
            <EmptyState
              title={search || tagFilter || statusFilter !== 'all' ? 'No matching tasks' : 'No tasks yet'}
              description={
                search || tagFilter || statusFilter !== 'all'
                  ? 'Try clearing your filters.'
                  : 'Create your first task to get started.'
              }
              action={<Button onClick={() => setCreateOpen(true)}>Create task</Button>}
            />
          ) : (
            <TaskList tasks={tasks} />
          )}
        </section>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New task">
        <TaskForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          isSubmitting={createTask.isPending}
        />
      </Modal>
    </div>
  );
}
