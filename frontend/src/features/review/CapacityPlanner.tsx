import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import type { Task, TaskPriority } from '@/types/api';
import { useUpdateTask } from '@/features/tasks/useTasks';
import { cn } from '@/lib/cn';
import { useCapacityStore } from './capacityStore';

const DEFAULT_MIN = 30;
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };

const estOf = (t: Task) => t.estimated_minutes ?? DEFAULT_MIN;

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** `tasks` = open tasks committed to this week (overdue + due within 7 days). */
export function CapacityPlanner({ tasks }: { tasks: Task[] }) {
  const weeklyHours = useCapacityStore((s) => s.weeklyHours);
  const setWeeklyHours = useCapacityStore((s) => s.setWeeklyHours);
  const update = useUpdateTask();
  const [busy, setBusy] = useState(false);

  const capacityMin = weeklyHours * 60;

  const { planned, keep, move } = useMemo(() => {
    // Keep the most important + soonest first; the overflow gets moved.
    const sorted = [...tasks].sort((a, b) => {
      const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (p !== 0) return p;
      return (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1;
    });
    let running = 0;
    const keep: Task[] = [];
    const move: Task[] = [];
    for (const t of sorted) {
      const e = estOf(t);
      if (running + e <= capacityMin) {
        keep.push(t);
        running += e;
      } else {
        move.push(t);
      }
    }
    const planned = tasks.reduce((s, t) => s + estOf(t), 0);
    return { planned, keep, move };
  }, [tasks, capacityMin]);

  const over = planned > capacityMin && move.length > 0;
  const pct = Math.min(100, Math.round((planned / Math.max(1, capacityMin)) * 100));

  const applyReplan = async () => {
    setBusy(true);
    try {
      for (const t of move) {
        const base = t.due_date ? new Date(t.due_date) : new Date();
        base.setDate(base.getDate() + 7);
        await update.mutateAsync({ id: t.id, input: { due_date: base.toISOString() } });
      }
      toast.success(`Moved ${move.length} task${move.length === 1 ? '' : 's'} to next week`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not reschedule'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={cn(
        'rounded-2xl border p-4',
        over
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">This week's capacity</h2>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          I have
          <input
            type="number"
            min={1}
            max={168}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(Number(e.target.value))}
            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-900"
          />
          h this week
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className={cn(over && 'font-medium text-amber-700 dark:text-amber-400')}>
            ~{fmt(planned)} planned
          </span>
          <span className="text-slate-400">of {weeklyHours}h</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn('h-2 rounded-full', over ? 'bg-amber-500' : 'bg-slate-900 dark:bg-slate-200')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {over ? (
        <div className="mt-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            This week is over capacity. Moving these {move.length} to next week fits the rest into{' '}
            {weeklyHours}h:
          </p>
          <ul className="mt-2 space-y-1">
            {move.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  to={`/tasks/${t.id}`}
                  className="min-w-0 flex-1 truncate hover:text-slate-500 dark:hover:text-slate-400"
                >
                  {t.title}
                </Link>
                <span className="shrink-0 text-xs text-slate-400">~{fmt(estOf(t))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button size="sm" onClick={applyReplan} isLoading={busy}>
              Move {move.length} to next week
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {tasks.length === 0
            ? 'Nothing scheduled for this week.'
            : `On track — ${keep.length} task${keep.length === 1 ? '' : 's'} fit within ${weeklyHours}h.`}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">Tasks without an estimate count as ~{DEFAULT_MIN}m.</p>
    </section>
  );
}
