import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import { TaskForm } from './TaskForm';
import type { TaskFormValues } from './schemas';
import { useDeleteTask, useTask, useUpdateTask } from './useTasks';

export function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const taskQuery = useTask(id);
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  if (taskQuery.isLoading) return <p className="text-sm">Loading…</p>;
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

  const handleSubmit = (values: TaskFormValues) => {
    updateMutation.mutate(
      {
        id: task.id,
        input: {
          title: values.title,
          description: values.description || null,
          status: values.status,
          priority: values.priority,
          due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
          tag_ids: values.tag_ids,
        },
      },
      {
        onSuccess: () => {
          toast.success('Saved');
          navigate('/tasks');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')),
      },
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/tasks')}
          className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back
        </button>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          Delete task
        </Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <TaskForm
          initial={task}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/tasks')}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    </div>
  );
}
