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

  const { data: tagList } = useTags();
  const deleteTag = useDeleteTag();
  const tasksQuery = useTasks({
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

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Status
          </h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={
                  'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                  (statusFilter === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100'
                    : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTagFilter(undefined)}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium ' +
                (tagFilter === undefined
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100'
                  : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900')
              }
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
          </div>
        </div>
      </aside>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-sm">
            <Input
              label="Search"
              placeholder="Search title or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>+ New task</Button>
        </div>

        {tasksQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : tasksQuery.isError ? (
          <p className="text-sm text-red-600">Failed to load tasks.</p>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Create your first task to get started."
            action={<Button onClick={() => setCreateOpen(true)}>Create task</Button>}
          />
        ) : (
          <TaskList tasks={tasks} />
        )}

        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="New task"
        >
          <TaskForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            isSubmitting={createTask.isPending}
          />
        </Modal>
      </section>
    </div>
  );
}
