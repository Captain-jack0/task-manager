import { Link } from 'react-router-dom';
import type { Task } from '@/types/api';
import { useTasks } from '@/features/tasks/useTasks';
import { isCompleted } from '@/features/tasks/status';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { formatDate } from '@/lib/date';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function TaskRow({ task, note }: { task: Task; note?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <Link
        to={`/tasks/${task.id}`}
        className="min-w-0 flex-1 truncate text-sm font-medium hover:text-slate-500 dark:hover:text-slate-400"
      >
        {task.title}
      </Link>
      {note && <span className="shrink-0 text-xs text-slate-400">{note}</span>}
    </li>
  );
}

function Section({
  title,
  tasks,
  noteOf,
  empty,
  tone = 'default',
}: {
  title: string;
  tasks: Task[];
  noteOf?: (t: Task) => string;
  empty: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
        {title}
        <span
          className={
            tone === 'warn'
              ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }
        >
          {tasks.length}
        </span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} note={noteOf?.(t)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReviewPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const { data, isLoading } = useTasks({ workspace_id: workspaceId, limit: 100 });
  const tasks = data?.data ?? [];

  const now = new Date();
  const weekAgo = daysFromNow(-7);
  const weekAhead = daysFromNow(7);

  const completed = tasks.filter(
    (t) => isCompleted(t.status) && new Date(t.updated_at) >= weekAgo,
  );
  const createdThisWeek = tasks.filter((t) => new Date(t.created_at) >= weekAgo);
  const overdue = tasks
    .filter((t) => !isCompleted(t.status) && t.due_date && new Date(t.due_date) < now)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const comingUp = tasks
    .filter(
      (t) =>
        !isCompleted(t.status) &&
        t.due_date &&
        new Date(t.due_date) >= now &&
        new Date(t.due_date) <= weekAhead,
    )
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const open = tasks.filter((t) => !isCompleted(t.status));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly review</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          A quick look back at the last 7 days — and what's coming up.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Completed this week" value={completed.length} />
            <Stat label="Created this week" value={createdThisWeek.length} />
            <Stat label="Overdue" value={overdue.length} />
            <Stat label="Still open" value={open.length} />
          </div>

          <Section
            title="Completed this week"
            tasks={completed}
            empty="Nothing finished in the last 7 days yet."
          />
          <Section
            title="Overdue — needs a decision"
            tasks={overdue}
            tone="warn"
            noteOf={(t) => `due ${formatDate(t.due_date as string)}`}
            empty="Nothing overdue. Nice."
          />
          <Section
            title="Coming up (next 7 days)"
            tasks={comingUp}
            noteOf={(t) => formatDate(t.due_date as string)}
            empty="Nothing scheduled for the next week."
          />
        </>
      )}
    </div>
  );
}
