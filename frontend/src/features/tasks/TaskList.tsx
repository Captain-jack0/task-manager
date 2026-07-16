import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import type { Project, Task, TaskStatus } from '@/types/api';
import { useDeleteTask, useSnooze, useUpdateTask } from './useTasks';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
  projects: Project[];
}

export function TaskList({ tasks, projects }: Props) {
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const snoozeMutation = useSnooze();
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const handleStatus = (id: string, next: TaskStatus) => {
    updateMutation.mutate(
      { id, input: { status: next } },
      { onError: (err) => toast.error(extractErrorMessage(err, 'Update failed')) },
    );
  };

  const handleSnooze = (id: string) => {
    snoozeMutation.mutate(id, {
      onSuccess: () => toast.success('Moved to tomorrow'),
      onError: (err) => toast.error(extractErrorMessage(err, 'Snooze failed')),
    });
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
      {tasks.map((task) => {
        const project = task.project_id ? projectById.get(task.project_id) : undefined;
        return (
          <TaskCard
            key={task.id}
            task={task}
            projectName={project?.name}
            projectColor={project?.color}
            onToggleStatus={(next) => handleStatus(task.id, next)}
            onSnooze={() => handleSnooze(task.id)}
            onDelete={() => handleDelete(task.id)}
          />
        );
      })}
    </div>
  );
}
