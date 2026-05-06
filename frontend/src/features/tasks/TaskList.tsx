import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import type { Task, TaskStatus } from '@/types/api';
import { useDeleteTask, useUpdateTask } from './useTasks';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
}

export function TaskList({ tasks }: Props) {
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const handleStatus = (id: string, next: TaskStatus) => {
    updateMutation.mutate(
      { id, input: { status: next } },
      { onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')) },
    );
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Task deleted'),
      onError: (err) => toast.error(extractErrorMessage(err, 'Delete failed')),
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onToggleStatus={(next) => handleStatus(task.id, next)}
          onDelete={() => handleDelete(task.id)}
        />
      ))}
    </div>
  );
}
