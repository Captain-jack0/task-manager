import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { TestRun, TestRunStatus } from '@/types/api';
import { useTestRun } from './useTestRuns';

interface Props {
  projectId: string;
  runId: string | null;
  onClose: () => void;
}

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

export function TestRunDetailModal({ projectId, runId, onClose }: Props) {
  const { data: run, isLoading, isError } = useTestRun(projectId, runId ?? undefined);

  if (!runId) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Test Run Details"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {isLoading && (
        <p className="text-sm text-slate-500">Loading test run details...</p>
      )}

      {isError && (
        <p className="text-sm text-red-600">Failed to load test run details.</p>
      )}

      {run && <TestRunDetails run={run} />}
    </Modal>
  );
}

interface TestRunDetailsProps {
  run: TestRun;
}

function TestRunDetails({ run }: TestRunDetailsProps) {
  const findings = run.findings?.findings ?? [];
  const hasFailed = run.failed_criteria > 0;

  return (
    <div className="space-y-5 text-sm">
      {/* Status and metadata */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_BADGE[run.status],
            )}
          >
            {STATUS_LABEL[run.status]}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatDate(run.created_at)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Criteria
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {run.total_criteria}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Duration</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {run.duration_seconds != null
                ? `${Math.floor(run.duration_seconds / 60)}m ${run.duration_seconds % 60}s`
                : '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Passed</p>
            <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
              {run.passed_criteria}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Failed</p>
            <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">
              {run.failed_criteria}
            </p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        {run.task_id && (
          <Link
            to={`/tasks/${run.task_id}`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View Task →
          </Link>
        )}

        {run.github_run_url && (
          <a
            href={run.github_run_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            GitHub Run ↗
          </a>
        )}

        {run.test_command && (
          <div className="w-full">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Test Command
            </p>
            <code className="mt-1 block rounded bg-slate-900 px-2 py-1 text-xs text-slate-100 dark:bg-slate-950">
              {run.test_command}
            </code>
          </div>
        )}
      </div>

      {/* Findings */}
      {hasFailed && findings.length > 0 && (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
            Test Failures ({findings.length})
          </h3>
          <div className="space-y-3">
            {findings.map((finding, index) => (
              <FindingCard key={index} finding={finding} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Full report */}
      {run.report_body && (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Full Report</h3>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">
              {run.report_body}
            </pre>
          </div>
        </div>
      )}

      {/* Empty state for passed tests */}
      {!hasFailed && run.status === 'passed' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            ✓ All tests passed!
          </p>
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
            {run.passed_criteria} of {run.total_criteria} criteria met
          </p>
        </div>
      )}
    </div>
  );
}

interface FindingCardProps {
  finding: {
    criterion: string;
    test: string;
    reason: string;
  };
  index: number;
}

function FindingCard({ finding, index }: FindingCardProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white dark:bg-red-500">
          {index + 1}
        </span>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-xs font-medium text-red-900 dark:text-red-100">Criterion</p>
            <p className="mt-0.5 text-sm text-red-800 dark:text-red-200">
              {finding.criterion}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-red-900 dark:text-red-100">Test</p>
            <p className="mt-0.5 text-sm text-red-800 dark:text-red-200">{finding.test}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-red-900 dark:text-red-100">Reason</p>
            <p className="mt-0.5 text-sm text-red-800 dark:text-red-200">{finding.reason}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
