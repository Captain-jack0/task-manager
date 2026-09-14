import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { cn } from '@/lib/cn';
import type { Task, TaskLinkKind, TaskRef } from '@/types/api';
import { STATUS_BADGE, STATUS_LABEL } from './status';
import { useAddTaskLink, useRemoveTaskLink, useTasks } from './useTasks';

const GROUPS: { key: 'blocked_by' | 'blocks' | 'related'; label: string; hint: string }[] = [
  { key: 'blocked_by', label: 'Blocked by', hint: 'This task waits for these. It returns to To do when they are all done.' },
  { key: 'blocks', label: 'Blocks', hint: 'These wait for this task.' },
  { key: 'related', label: 'Related', hint: 'Linked for context only; no status effect.' },
];

const KIND_LABEL: Record<TaskLinkKind, string> = {
  blocked_by: 'Blocked by',
  blocks: 'Blocks',
  relates: 'Related to',
};

const SELECT =
  'cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10';

/** Dependencies of one task: blocked-by / blocks / related, plus a picker to add more. */
export function TaskLinksSection({ task }: { task: Task }) {
  const [kind, setKind] = useState<TaskLinkKind>('blocked_by');
  const [query, setQuery] = useState('');
  const addLink = useAddTaskLink();
  const removeLink = useRemoveTaskLink();

  const search = query.trim();
  const results = useTasks({ workspace_id: task.workspace_id, search, limit: 8 }, search.length > 0);
  const linkedIds = new Set([task, ...task.blocked_by, ...task.blocks, ...task.related].map((t) => t.id));
  const candidates = (results.data?.data ?? []).filter((t) => !linkedIds.has(t.id));

  const add = (target: { id: string; title: string }) => {
    addLink.mutate(
      { id: task.id, input: { target_id: target.id, kind } },
      {
        onSuccess: () => {
          toast.success(`${KIND_LABEL[kind]} "${target.title}"`);
          setQuery('');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not link tasks')),
      },
    );
  };

  const remove = (ref: TaskRef) => {
    removeLink.mutate(
      { id: task.id, linkId: ref.link_id },
      {
        onSuccess: () => toast.success('Link removed'),
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not remove link')),
      },
    );
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Links</h2>

      {GROUPS.map((group) =>
        task[group.key].length === 0 ? null : (
          <div key={group.key} className="mt-3">
            <p className="text-xs font-medium text-slate-500" title={group.hint}>
              {group.label}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {task[group.key].map((ref) => (
                <li key={ref.link_id} className="group flex items-center gap-2 text-sm">
                  <span
                    className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_BADGE[ref.status])}
                  >
                    {STATUS_LABEL[ref.status]}
                  </span>
                  <Link
                    to={`/tasks/${ref.id}`}
                    className="min-w-0 truncate text-slate-700 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                  >
                    {ref.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(ref)}
                    aria-label={`Remove link to ${ref.title}`}
                    className="ml-auto text-slate-400 opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}

      <div className="mt-3 flex flex-wrap items-start gap-2">
        <select
          aria-label="Link kind"
          className={SELECT}
          value={kind}
          onChange={(e) => setKind(e.target.value as TaskLinkKind)}
        >
          <option value="blocked_by">Blocked by</option>
          <option value="blocks">Blocks</option>
          <option value="relates">Related to</option>
        </select>
        <div className="relative min-w-[16rem] flex-1">
          <Input
            aria-label="Search tasks to link"
            placeholder="Type to find a task…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
          {search.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-800 dark:bg-slate-900">
              {results.isLoading ? (
                <li className="px-3 py-1.5 text-slate-400">Searching…</li>
              ) : candidates.length === 0 ? (
                <li className="px-3 py-1.5 text-slate-400">No matching tasks.</li>
              ) : (
                candidates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => add(t)}
                      disabled={addLink.isPending}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className={cn('rounded-full px-1.5 text-[10px] font-medium', STATUS_BADGE[t.status])}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className="truncate">{t.title}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
