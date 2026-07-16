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
import { useCreateProject, useDeleteProject, useProjects } from '@/features/projects/useProjects';
import { useMembers } from '@/features/workspaces/useMembers';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { cn } from '@/lib/cn';
import { QuickAdd } from './QuickAdd';
import { SuggestPanel } from './SuggestPanel';
import { TaskBoard } from './TaskBoard';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import type { TaskFormValues } from './schemas';
import { STATUS_LABEL, STATUS_ORDER } from './status';
import { useCreateTask, useTasks } from './useTasks';

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STATUS_ORDER.map((value) => ({ value, label: STATUS_LABEL[value] })),
];

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<'list' | 'board'>('list');

  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;

  const { data: tagList } = useTags();
  const deleteTag = useDeleteTag();
  const { data: projectList } = useProjects(workspaceId);
  const { data: memberList } = useMembers(workspaceId);
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const tasksQuery = useTasks({
    workspace_id: workspaceId,
    // The board shows every status as a column, so it ignores the status filter.
    status: view === 'board' || statusFilter === 'all' ? undefined : statusFilter,
    tag_id: tagFilter,
    project_id: projectFilter,
    search: search || undefined,
    limit: 100,
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
        project_id: values.project_id || null,
        assignee_id: values.assignee_id || null,
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

  const handleCreateProject = () => {
    const name = window.prompt('Project name');
    if (!name?.trim()) return;
    createProject.mutate(
      { name: name.trim() },
      {
        onSuccess: (p) => {
          toast.success(`Project "${p.name}" created`);
          setProjectFilter(p.id);
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not create project')),
      },
    );
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"? Its tasks stay, just unassigned.`)) return;
    deleteProject.mutate(id, {
      onSuccess: () => {
        toast.success('Project deleted');
        if (projectFilter === id) setProjectFilter(undefined);
      },
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not delete project')),
    });
  };

  const projects = projectList ?? [];
  const members = memberList ?? [];
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

      <QuickAdd />

      <SuggestPanel workspaceId={workspaceId} />

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="space-y-6">
          {view === 'list' && (
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
          )}

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

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Projects
              </h2>
              <button
                type="button"
                onClick={handleCreateProject}
                title="New project"
                aria-label="New project"
                className="text-base leading-none text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
              >
                +
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setProjectFilter(undefined)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                  projectFilter === undefined
                    ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                All projects
              </button>
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    projectFilter === p.id
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setProjectFilter(p.id === projectFilter ? undefined : p.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color ?? '#94a3b8' }}
                    />
                    <span
                      className={cn(
                        'truncate',
                        projectFilter === p.id
                          ? 'font-medium text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      {p.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(p.id, p.name)}
                    aria-label={`Delete ${p.name}`}
                    className="ml-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="px-1 text-xs text-slate-400">No projects yet.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Input
              aria-label="Search tasks"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs"
            />
            <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
              {(['list', 'board'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm capitalize transition-colors',
                    view === v
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {tasksQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : tasksQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load tasks.</p>
          ) : tasks.length === 0 ? (
            <EmptyState
              title={
                search || tagFilter || projectFilter || statusFilter !== 'all'
                  ? 'No matching tasks'
                  : 'No tasks yet'
              }
              description={
                search || tagFilter || projectFilter || statusFilter !== 'all'
                  ? 'Try clearing your filters.'
                  : 'Create your first task to get started.'
              }
              action={<Button onClick={() => setCreateOpen(true)}>Create task</Button>}
            />
          ) : view === 'board' ? (
            <TaskBoard tasks={tasks} projects={projects} members={members} />
          ) : (
            <TaskList tasks={tasks} projects={projects} members={members} />
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
