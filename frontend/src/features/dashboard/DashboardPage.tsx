import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/reports';
import { STATUS_LABEL, STATUS_ORDER } from '@/features/tasks/status';
import { formatDuration } from '@/features/time/useTime';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import { displayName } from '@/lib/people';
import type { Dashboard, TaskStatus } from '@/types/api';

const WINDOWS = [7, 14, 30] as const;

// Two categorical series from the validated reference palette (slot 1 blue, slot 2 orange).
const SERIES = {
  completed: { label: 'Completed', bar: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  created: { label: 'Created', bar: 'bg-[#eb6834] dark:bg-[#d95926]' },
};

const STATUS_BAR: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-amber-500',
  closed: 'bg-emerald-500',
};

const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={cn('text-2xl font-semibold tabular-nums tracking-tight', tone === 'warn' && value > 0 && 'text-amber-600 dark:text-amber-400')}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

/** Completed vs created per day. Thin paired bars, hover tooltips, legend + table fallback. */
function ActivityChart({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.per_day.flatMap((p) => [p.completed, p.created]));
  const height = 120;
  const dayLabel = (iso: string) => formatDate(`${iso}T00:00:00`);
  return (
    <figure>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        {(['completed', 'created'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', SERIES[k].bar)} aria-hidden />
            {SERIES[k].label}
          </span>
        ))}
        <span className="ml-auto tabular-nums">max {max}/day</span>
      </div>
      <div className="flex items-end gap-1 border-b border-slate-200 dark:border-slate-700" style={{ height }} role="img" aria-label="Completed and created tasks per day">
        {data.per_day.map((p) => (
          <div key={p.day} className="flex flex-1 items-end justify-center gap-0.5" title={`${dayLabel(p.day)}: ${p.completed} completed, ${p.created} created`}>
            {(['completed', 'created'] as const).map((k) => (
              <span
                key={k}
                className={cn('w-full max-w-[10px] rounded-t-[3px]', SERIES[k].bar, p[k] === 0 && 'opacity-30')}
                style={{ height: Math.max(2, Math.round((p[k] / max) * (height - 8))) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{dayLabel(data.per_day[0]?.day ?? '')}</span>
        <span>{dayLabel(data.per_day[data.per_day.length - 1]?.day ?? '')}</span>
      </div>
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer">Table view</summary>
        <table className="mt-1 w-full">
          <tbody>
            {data.per_day.map((p) => (
              <tr key={p.day}>
                <td className="py-0.5">{dayLabel(p.day)}</td>
                <td className="py-0.5 text-right tabular-nums">{p.completed}</td>
                <td className="py-0.5 text-right tabular-nums">{p.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function DashboardPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);
  const report = useQuery({
    queryKey: ['reports', 'dashboard', workspaceId ?? null, days],
    queryFn: () => reportsApi.dashboard(days, workspaceId),
    staleTime: 30_000,
  });
  const d = report.data;
  const totalTasks = d ? Object.values(d.by_status).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">How the workspace is doing over the last {days} days.</p>
        </div>
        <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                days === w ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {report.isLoading || !d ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={`Completed (${days}d)`} value={d.completed} />
            <Stat label={`Created (${days}d)`} value={d.created} />
            <Stat label="Overdue" value={d.overdue} tone="warn" />
            <Stat label="Open" value={d.open} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <section className={CARD}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Activity per day</h2>
              <ActivityChart data={d} />
            </section>

            <section className={CARD}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">By status</h2>
              <ul className="space-y-1.5">
                {STATUS_ORDER.map((s) => {
                  const count = d.by_status[s] ?? 0;
                  const width = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                  return (
                    <li key={s} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 text-slate-500">{STATUS_LABEL[s]}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <span className={cn('block h-full rounded-full', STATUS_BAR[s])} style={{ width: `${width}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
              {d.active_sprint && (
                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active sprint</h3>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{d.active_sprint.name}</span>
                    <span className="text-slate-500"> · ends {formatDate(`${d.active_sprint.end_date}T00:00:00`)}</span>
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${d.active_sprint.total ? Math.round((d.active_sprint.finished / d.active_sprint.total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.active_sprint.finished}/{d.active_sprint.total} finished
                  </p>
                </div>
              )}
            </section>
          </div>

          <section className={CARD}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">People</h2>
            {d.people.length === 0 ? (
              <p className="text-sm text-slate-500">Personal workspace — no members to compare.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Member</th>
                      <th className="py-1 pr-3 text-right font-medium">Open</th>
                      <th className="py-1 pr-3 text-right font-medium">Overdue</th>
                      <th className="py-1 pr-3 text-right font-medium">Done ({days}d)</th>
                      <th className="py-1 pr-3 text-right font-medium">Open estimate</th>
                      <th className="py-1 text-right font-medium">Logged ({days}d)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.people.map((p) => (
                      <tr key={p.user_id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3">{displayName(p)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.open}</td>
                        <td className={cn('py-2 pr-3 text-right tabular-nums', p.overdue > 0 && 'text-amber-600 dark:text-amber-400')}>{p.overdue}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.completed}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatDuration(p.estimated_open_minutes)}</td>
                        <td className="py-2 text-right tabular-nums">{formatDuration(p.logged_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-slate-400">
            Completed counts come from the activity log (tasks that entered Done (Test) or Closed in the window). See{' '}
            <Link to="/review" className="underline underline-offset-2">
              Weekly review
            </Link>{' '}
            for the personal list view and <Link to="/time" className="underline underline-offset-2">Time</Link> for the timesheet.
          </p>
        </>
      )}
    </div>
  );
}
