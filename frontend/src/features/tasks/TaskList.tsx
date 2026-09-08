import { toast } from 'sonner';
import { extractErrorMessage } from '@/api/client';
import type { Member, Project, Sprint, Task, TaskStatus } from '@/types/api';
import { useDeleteTask, useSnooze, useUpdateTask } from './useTasks';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  sprints?: Sprint[];
}

export function TaskList({ tasks, projects, members, sprints = [] }: Props) {
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const snoozeMutation = useSnooze();
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const emailById = new Map(members.map((m) => [m.user_id, m.email]));

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

  const handleSchedule = (id: string, iso: string) => {
    updateMutation.mutate(
      { id, input: { due_date: iso } },
      {
        onSuccess: () => toast.success('Scheduled'),
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not schedule')),
      },
    );
  };

  const handleSprint = (id: string, sprintId: string | null) => {
    const name = sprints.find((s) => s.id === sprintId)?.name ?? 'backlog';
    updateMutation.mutate(
      { id, input: { sprint_id: sprintId } },
      {
        onSuccess: () => toast.success(`Moved to ${name}`),
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not move task')),
      },
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
      {tasks.map((task) => {
        const project = task.project_id ? projectById.get(task.project_id) : undefined;
        return (
          <TaskCard
            key={task.id}
            task={task}
            projectName={project?.name}
            projectColor={project?.color}
            assigneeEmail={task.assignee_id ? emailById.get(task.assignee_id) : undefined}
            sprints={sprints}
            onToggleStatus={(next) => handleStatus(task.id, next)}
            onMoveToSprint={(sprintId) => handleSprint(task.id, sprintId)}
            onSnooze={() => handleSnooze(task.id)}
            onSchedule={(iso) => handleSchedule(task.id, iso)}
            onDelete={() => handleDelete(task.id)}
          />
        );
      })}
    </div>
  );
}
