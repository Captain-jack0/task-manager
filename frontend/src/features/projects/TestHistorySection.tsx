import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { TestRun, TestRunStatus } from '@/types/api';
import { useTestRuns } from './useTestRuns';
import { TestRunDetailModal } from './TestRunDetailModal';

const STATUS_BADGE: Record<TestRunStatus, string> = {
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  passed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  error: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const STATUS_LABEL: Record<TestRunStatus, string> = {
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  error: 'Error',
};

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manual',
  auto: 'Auto',
  pr: 'PR',
  issue: 'Issue',
};

interface TestHistorySectionProps {
  projectId: string;
  limit?: number;
}

export function TestHistorySection({ projectId, limit = 10 }: TestHistorySectionProps) {
  const { data: testRuns, isLoading, isError } = useTestRuns(projectId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading test history...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600">Failed to load test history.</p>;
  }

  if (!testRuns || testRuns.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">No test runs yet.</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Test runs will appear here when tests are executed.
        </p>
      </div>
    );
  }

  const displayRuns = limit ? testRuns.slice(0, limit) : testRuns;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Task
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Results
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Duration
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayRuns.map((run) => (
                <TestRunRow key={run.id} run={run} onClick={() => setSelectedRunId(run.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {limit && testRuns.length > limit && (
        <p className="text-center text-sm text-slate-500">
          Showing {limit} of {testRuns.length} test runs
        </p>
      )}

      <TestRunDetailModal
        projectId={projectId}
        runId={selectedRunId}
        onClose={() => setSelectedRunId(null)}
      />
    </div>
  );
}

interface TestRunRowProps {
  run: TestRun;
  onClick: () => void;
}

function TestRunRow({ run, onClick }: TestRunRowProps) {
  const hasTask = run.task_id != null;
  const hasFailed = run.failed_criteria > 0;
  const failureCount = run.findings?.findings?.length ?? run.failed_criteria;

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50">
      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
            STATUS_BADGE[run.status],
          )}
        >
          {STATUS_LABEL[run.status]}
        </span>
      </td>

      {/* Trigger */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {TRIGGER_LABEL[run.trigger_source] || run.trigger_source}
        </span>
      </td>

      {/* Task */}
      <td className="px-4 py-3">
        {hasTask ? (
          <Link
            to={`/tasks/${run.task_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            View Task →
          </Link>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>

      {/* Results */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600 dark:text-green-400">
            {run.passed_criteria} passed
          </span>
          {hasFailed && (
            <>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-red-600 dark:text-red-400">
                {failureCount} failed
              </span>
            </>
          )}
          <span className="text-slate-400 dark:text-slate-500">
            / {run.total_criteria}
          </span>
        </div>
      </td>

      {/* Duration */}
      <td className="px-4 py-3">
        {run.duration_seconds != null ? (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {Math.floor(run.duration_seconds / 60)}m {run.duration_seconds % 60}s
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatDate(run.created_at)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {run.github_run_url && (
          <a
            href={run.github_run_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            GitHub ↗
          </a>
        )}
      </td>
    </tr>
  );
}
