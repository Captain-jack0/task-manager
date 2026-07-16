import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import { TagBadge } from '@/features/tags/TagBadge';
import { formatDate, isOverdue } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { TaskStatus } from '@/types/api';
import { useGithubStatus } from '@/features/integrations/useGithub';
import { TaskForm } from './TaskForm';
import type { TaskFormValues } from './schemas';
import { STATUS_BADGE, STATUS_LABEL, STATUS_ORDER, isCompleted } from './status';
import { useCreateGithubIssue, useDeleteTask, useTask, useUpdateTask } from './useTasks';

const PRIORITY_DOT: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const taskQuery = useTask(id);
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const createIssue = useCreateGithubIssue();
  const { data: github } = useGithubStatus();

  if (taskQuery.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (taskQuery.isError || !taskQuery.data)
    return (
      <div>
        <p className="text-sm text-red-600">Task not found.</p>
        <Button variant="secondary" className="mt-2" onClick={() => navigate('/tasks')}>
          Back
        </Button>
      </div>
    );

  const task = taskQuery.data;
  const overdue = !isCompleted(task.status) && isOverdue(task.due_date);

  const handleSave = (values: TaskFormValues) => {
    updateMutation.mutate(
      {
        id: task.id,
        input: {
          title: values.title,
          description: values.description || null,
          status: values.status,
          priority: values.priority,
          due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
          energy_level: values.energy_level || null,
          estimated_minutes: values.estimated_minutes ? Number(values.estimated_minutes) : null,
          tag_ids: values.tag_ids,
        },
      },
      {
        onSuccess: () => {
          toast.success('Saved');
          setEditing(false);
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')),
      },
    );
  };

  const handleStatus = (status: TaskStatus) => {
    updateMutation.mutate(
      { id: task.id, input: { status } },
      { onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')) },
    );
  };

  const handleDelete = () => {
    if (!window.confirm('Delete this task?')) return;
    deleteMutation.mutate(task.id, {
      onSuccess: () => {
        toast.success('Deleted');
        navigate('/tasks');
      },
      onError: (err) => toast.error(extractErrorMessage(err, 'Delete failed')),
    });
  };

  const handleCreateIssue = () => {
    createIssue.mutate(task.id, {
      onSuccess: (t) =>
        toast.success(
          t.github_issue_number ? `Opened issue #${t.github_issue_number}` : 'Issue opened',
        ),
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not open issue')),
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : navigate('/tasks'))}
          className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← {editing ? 'Cancel edit' : 'Back'}
        </button>
        {!editing && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <TaskForm
            initial={task}
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
            isSubmitting={updateMutation.isPending}
          />
        </div>
      ) : (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_BADGE[task.status])}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
              {task.priority} priority
            </span>
          </div>

          <h1 className={cn('mt-3 text-xl font-semibold tracking-tight', isCompleted(task.status) && 'line-through')}>
            {task.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            {task.due_date && (
              <span className={cn(overdue && 'text-red-600 dark:text-red-400')}>
                Due {formatDate(task.due_date)}{overdue && ' · overdue'}
              </span>
            )}
            {task.estimated_minutes != null && <span>~{task.estimated_minutes} min</span>}
            {task.energy_level && <span className="capitalize">{task.energy_level} energy</span>}
            {task.snooze_count > 0 && <span>snoozed {task.snooze_count}×</span>}
          </div>

          {task.description ? (
            <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {task.description}
            </p>
          ) : (
            <p className="mt-5 text-sm italic text-slate-400">No description.</p>
          )}

          {task.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">GitHub</span>
            {task.github_issue_url ? (
              <a
                href={task.github_issue_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-slate-900 underline underline-offset-2 dark:text-white"
              >
                Issue #{task.github_issue_number} ↗
              </a>
            ) : github?.connected ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCreateIssue}
                isLoading={createIssue.isPending}
              >
                Create GitHub issue
              </Button>
            ) : (
              <span className="text-sm text-slate-400">
                Connect GitHub in the header to open issues.
              </span>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="mb-2 block text-xs font-medium text-slate-500">Set status</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  disabled={task.status === s || updateMutation.isPending}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-sm transition-colors disabled:cursor-not-allowed',
                    task.status === s
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
