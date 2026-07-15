import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import type { TaskEnergy, TaskSuggestion } from '@/types/api';
import { cn } from '@/lib/cn';
import { useSuggest, useUpdateTask } from './useTasks';

const MINUTES = [15, 30, 45, 60, 90];
const ENERGIES: { value: TaskEnergy | undefined; label: string }[] = [
  { value: undefined, label: 'Any' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function chipClass(active: boolean): string {
  return cn(
    'rounded-lg px-2.5 py-1 text-sm transition-colors',
    active
      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800',
  );
}

export function SuggestPanel() {
  const [minutes, setMinutes] = useState(30);
  const [energy, setEnergy] = useState<TaskEnergy | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null);
  const [index, setIndex] = useState(0);

  const suggest = useSuggest();
  const updateTask = useUpdateTask();

  const runSuggest = () => {
    suggest.mutate(
      { minutes, energy, limit: 8 },
      {
        onSuccess: (res) => {
          setSuggestions(res.suggestions);
          setIndex(0);
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not get a suggestion')),
      },
    );
  };

  const current = suggestions?.[index];

  const startNow = () => {
    if (!current) return;
    updateTask.mutate(
      { id: current.task.id, input: { status: 'in_progress' } },
      {
        onSuccess: () => toast.success(`Started: ${current.task.title}`),
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not start task')),
      },
    );
  };

  const showAnother = () => {
    if (suggestions) setIndex((i) => (i + 1) % suggestions.length);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold tracking-tight">What should I do now?</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Tell me your time and energy — I'll pick one task.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">I have</span>
          <div className="flex flex-wrap gap-1">
            {MINUTES.map((m) => (
              <button key={m} type="button" onClick={() => setMinutes(m)} className={chipClass(minutes === m)}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Energy</span>
          <div className="flex flex-wrap gap-1">
            {ENERGIES.map((e) => (
              <button
                key={e.label}
                type="button"
                onClick={() => setEnergy(e.value)}
                className={chipClass(energy === e.value)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={runSuggest} isLoading={suggest.isPending}>
          Suggest a task
        </Button>
      </div>

      {suggestions &&
        (current ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/tasks/${current.task.id}`}
                className="font-semibold tracking-tight hover:text-slate-500 dark:hover:text-slate-400"
              >
                {current.task.title}
              </Link>
              <span className="shrink-0 text-xs text-slate-400">
                {index + 1}/{suggestions.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {current.reason}
              {current.task.estimated_minutes != null && ` · ~${current.task.estimated_minutes}m`}
              {current.task.energy_level && ` · ${current.task.energy_level} energy`}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={startNow} isLoading={updateTask.isPending}>
                Start now
              </Button>
              {suggestions.length > 1 && (
                <Button size="sm" variant="secondary" onClick={showAnother}>
                  Show another
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Nothing fits right now — try more time, or add estimates and energy levels to your tasks.
          </p>
        ))}
    </section>
  );
}
