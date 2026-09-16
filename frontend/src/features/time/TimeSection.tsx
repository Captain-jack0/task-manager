import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { formatDate } from '@/lib/date';
import { useAuthStore } from '@/features/auth/authStore';
import type { Task, TimeEntry } from '@/types/api';
import { TimerButton } from './TimerButton';
import { formatDuration, useDeleteTimeEntry, useLogTime, useTaskTime } from './useTime';

const who = (e: TimeEntry) => e.user_name?.trim() || e.user_email || 'someone';

/** Time on one task: total vs estimate, the timer, past entries, and a manual "log time" form. */
export function TimeSection({ task }: { task: Task }) {
  const me = useAuthStore((s) => s.user?.id);
  const time = useTaskTime(task.id);
  const remove = useDeleteTimeEntry(task.id);
  const log = useLogTime();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('10:00');
  const [note, setNote] = useState('');

  const total = time.data?.total_minutes ?? 0;
  const estimate = task.estimated_minutes;
  const pct = estimate ? Math.min(100, Math.round((total / estimate) * 100)) : 0;
  const over = estimate != null && total > estimate;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const started = new Date(`${date}T${from}:00`);
    const ended = new Date(`${date}T${to}:00`);
    if (!(ended > started)) {
      toast.error('End must be after start');
      return;
    }
    log.mutate(
      { taskId: task.id, input: { started_at: started.toISOString(), ended_at: ended.toISOString(), note: note.trim() || null } },
      {
        onSuccess: () => {
          setShowForm(false);
          setNote('');
          toast.success('Time logged');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not log time')),
      },
    );
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Time</h2>
        <TimerButton taskId={task.id} />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          <span className={over ? 'font-medium text-amber-600 dark:text-amber-400' : 'font-medium'}>{formatDuration(total)}</span>
          {estimate != null && <span className="text-slate-400"> of ~{formatDuration(estimate)} estimated</span>}
        </span>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          {showForm ? 'Cancel' : 'Log time…'}
        </button>
      </div>
      {estimate != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={over ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'} style={{ width: `${pct}%` }} />
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="From" type="time" value={from} onChange={(e) => setFrom(e.target.value)} required />
          <Input label="To" type="time" value={to} onChange={(e) => setTo(e.target.value)} required />
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" maxLength={200} className="w-40" />
          <Button type="submit" size="sm" isLoading={log.isPending}>
            Add
          </Button>
        </form>
      )}

      {(time.data?.entries.length ?? 0) > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          {time.data?.entries.map((e) => (
            <li key={e.id} className="group flex items-center gap-2">
              <span className="w-14 shrink-0 font-mono tabular-nums">{e.ended_at ? formatDuration(e.minutes) : '⏱ …'}</span>
              <span className="min-w-0 truncate">
                {who(e)} · {formatDate(e.started_at)}
                {e.note && <span className="text-slate-400"> · {e.note}</span>}
              </span>
              {e.user_id === me && e.ended_at && (
                <button
                  type="button"
                  onClick={() => remove.mutate(e.id)}
                  aria-label="Delete entry"
                  className="ml-auto text-slate-400 opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-400"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
