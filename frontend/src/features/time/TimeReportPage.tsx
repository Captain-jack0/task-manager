import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { timeApi } from '@/api/time';
import { Button } from '@/components/Button';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { formatDate } from '@/lib/date';
import type { TimeReportRow } from '@/types/api';
import { formatDuration } from './useTime';

/** Monday 00:00 local of the week containing `d`, shifted by `offset` weeks. */
export function weekStart(d: Date, offset = 0): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + offset * 7);
  return start;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function groupBy<T, K extends string>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    out.set(k, [...(out.get(k) ?? []), r]);
  }
  return out;
}

const personLabel = (r: TimeReportRow) => r.user_name?.trim() || r.user_email;

export function TimeReportPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [offset, setOffset] = useState(0);
  const start = useMemo(() => weekStart(new Date(), offset), [offset]);
  const end = useMemo(() => addDays(start, 7), [start]);

  const report = useQuery({
    queryKey: ['time', 'report', workspaceId ?? null, start.toISOString()],
    queryFn: () => timeApi.report(start.toISOString(), end.toISOString(), workspaceId),
  });
  const rows = report.data?.rows ?? [];
  const byTask = groupBy(rows, (r) => r.task_id);
  const byPerson = groupBy(rows, (r) => r.user_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {formatDate(start)} – {formatDate(addDays(start, 6))}
            {report.data && ` · ${formatDuration(report.data.total_minutes)} logged`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
            ←
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>
            This week
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="Next week">
            →
          </Button>
        </div>
      </div>

      {report.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No time logged this week. Start a timer with ▶ on any task.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">By task</h2>
            <table className="w-full text-sm">
              <tbody>
                {[...byTask.entries()]
                  .map(([taskId, group]) => ({
                    taskId,
                    title: group[0].task_title,
                    minutes: group.reduce((s, r) => s + r.minutes, 0),
                    people: group.map((r) => `${personLabel(r)} ${formatDuration(r.minutes)}`).join(', '),
                  }))
                  .sort((a, b) => b.minutes - a.minutes)
                  .map((t) => (
                    <tr key={t.taskId} className="border-t border-slate-100 first:border-0 dark:border-slate-800">
                      <td className="py-2 pr-3">
                        <Link to={`/tasks/${t.taskId}`} className="font-medium hover:underline">
                          {t.title}
                        </Link>
                        <span className="block text-xs text-slate-400">{t.people}</span>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{formatDuration(t.minutes)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">By person</h2>
            <ul className="space-y-2 text-sm">
              {[...byPerson.entries()]
                .map(([userId, group]) => ({ userId, name: personLabel(group[0]), minutes: group.reduce((s, r) => s + r.minutes, 0) }))
                .sort((a, b) => b.minutes - a.minutes)
                .map((p) => (
                  <li key={p.userId} className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono tabular-nums">{formatDuration(p.minutes)}</span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
