import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { formatDate } from '@/lib/date';
import { displayName } from '@/lib/people';
import type { Member, Project, Sprint, Task, TaskEvent, TaskStatus } from '@/types/api';
import { RECURRENCE_LABEL, STATUS_LABEL } from './status';

interface Props {
  task: Task;
  members: Member[];
  sprints: Sprint[];
  projects: Project[];
}

const FIELD_LABEL: Record<string, string> = {
  status: 'status',
  priority: 'priority',
  assignee_id: 'assignee',
  sprint_id: 'sprint',
  project_id: 'project',
  due_date: 'due date',
  parent_id: 'parent',
  recurrence: 'repeat',
};

const SHOWN_BY_DEFAULT = 8;

/** Renders raw stored values (ids, codes, ISO dates) with the names the page already has. */
function useValueLabel({ members, sprints, projects }: Omit<Props, 'task'>) {
  return (field: string, value: string | null): string => {
    if (value === null) return 'none';
    switch (field) {
      case 'status':
        return STATUS_LABEL[value as TaskStatus] ?? value;
      case 'assignee_id': {
        const m = members.find((x) => x.user_id === value);
        return m ? displayName(m) : 'someone';
      }
      case 'sprint_id':
        return sprints.find((s) => s.id === value)?.name ?? 'a sprint';
      case 'project_id':
        return projects.find((p) => p.id === value)?.name ?? 'a project';
      case 'due_date':
        return formatDate(value) || value;
      case 'recurrence':
        return RECURRENCE_LABEL[value as keyof typeof RECURRENCE_LABEL] ?? value;
      case 'parent_id':
        return 'a task';
      default:
        return value;
    }
  };
}

function sentence(e: TaskEvent, label: (field: string, value: string | null) => string): string {
  const who = e.actor ? displayName(e.actor) : 'System';
  switch (e.field) {
    case 'created':
      return e.new_value === 'recurrence' ? 'Created automatically from a repeating task' : `${who} created the task`;
    case 'link':
      return e.new_value
        ? `${who} linked it (${e.new_value.replace(':', ': ')})`
        : `${who} removed a link (${(e.old_value ?? '').replace(':', ': ')})`;
    default:
      return `${who} changed ${FIELD_LABEL[e.field] ?? e.field}: ${label(e.field, e.old_value)} → ${label(e.field, e.new_value)}`;
  }
}

export function ActivitySection({ task, members, sprints, projects }: Props) {
  const [showAll, setShowAll] = useState(false);
  const label = useValueLabel({ members, sprints, projects });
  const activity = useQuery({
    queryKey: ['tasks', 'activity', task.id],
    queryFn: () => tasksApi.activity(task.id),
    staleTime: 15_000,
  });
  const events = activity.data ?? [];
  const visible = showAll ? events : events.slice(0, SHOWN_BY_DEFAULT);

  return (
    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Activity</h2>
      {activity.isLoading ? (
        <p className="mt-2 text-xs text-slate-400">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No changes recorded yet.</p>
      ) : (
        <ol className="mt-2 space-y-1.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          {visible.map((e) => (
            <li key={e.id} className="text-xs text-slate-600 dark:text-slate-300">
              <span className="block">{sentence(e, label)}</span>
              <span className="text-slate-400">{formatDate(e.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
      {events.length > SHOWN_BY_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          {showAll ? 'Show less' : `Show all ${events.length}`}
        </button>
      )}
    </div>
  );
}
