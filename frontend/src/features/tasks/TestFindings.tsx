import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import { tasksApi } from '@/api/tasks';
import type { Task } from '@/types/api';
import type { TestFinding } from './testReport';
import { TASKS_KEY, useTasks } from './useTasks';

const TITLE_MAX = 200; // backend limit on task titles

interface Props {
  task: Task;
  findings: TestFinding[];
}

/** Failed or untestable criteria from the latest test report; the user picks which become subtasks. */
export function TestFindings({ task, findings }: Props) {
  const qc = useQueryClient();
  const children = useTasks({
    workspace_id: task.workspace_id,
    parent_id: task.id,
    sort: 'created_at',
    order: 'asc',
    limit: 100,
  });
  const existing = new Set((children.data?.data ?? []).map((t) => t.title));
  const add = useMutation({
    mutationFn: (f: TestFinding) =>
      tasksApi.create(
        {
          title: f.criterion.slice(0, TITLE_MAX),
          description: [f.test && `Test: ${f.test}`, f.reason].filter(Boolean).join('\n\n') || null,
          parent_id: task.id,
          sprint_id: task.sprint_id,
          project_id: task.project_id,
        },
        task.workspace_id,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not add subtask')),
  });

  if (findings.length === 0) {
    return <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">All criteria passed.</p>;
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Test findings
      </h3>
      <ul className="mt-2 space-y-2">
        {findings.map((f) => {
          const added = existing.has(f.criterion.slice(0, TITLE_MAX));
          return (
            <li key={f.criterion} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100">{f.criterion}</p>
                {(f.test || f.reason) && (
                  <p className="break-words text-xs text-slate-500 dark:text-slate-400">
                    {f.test && <code className="font-mono">{f.test}</code>}
                    {f.test && f.reason && ' · '}
                    {f.reason}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={added || add.isPending}
                onClick={() => add.mutate(f)}
              >
                {added ? 'Added' : 'Add as subtask'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
