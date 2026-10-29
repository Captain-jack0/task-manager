import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { TestRunStatus } from '@/types/api';
import { useProjects } from './useProjects';
import { useTestDashboard } from './useTestRuns';

const STATUS_DOT: Record<TestRunStatus, string> = {
  running: 'bg-blue-500',
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  error: 'bg-orange-500',
};

const STATUS_LABEL: Record<TestRunStatus, string> = {
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  error: 'Error',
};

interface TestDashboardProps {
  workspaceId?: string;
}

export function TestDashboard({ workspaceId }: TestDashboardProps) {
  const { data: projects } = useProjects(workspaceId);
  const { data: dashboard, isLoading, isError } = useTestDashboard();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading test dashboard...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600">Failed to load test dashboard.</p>;
  }

  if (!dashboard || Object.keys(dashboard).length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No test data available yet.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Test results will appear here when tests are executed.
        </p>
      </div>
    );
  }

  // Filter projects that have test data
  const projectsWithTests = projects?.filter((p) => dashboard[p.id]) ?? [];

  if (projectsWithTests.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No test data available yet.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Test results will appear here when tests are executed.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projectsWithTests.map((project) => {
        const summary = dashboard[project.id];
        if (!summary) return null;

        const hasTests = summary.total_runs > 0;
        const passRate = hasTests
          ? Math.round((summary.passed_count / summary.total_runs) * 100)
          : 0;

        return (
          <div
            key={project.id}
            className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Project header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {project.color && (
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {project.name}
                </h3>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Runs
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {summary.total_runs}
                </p>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-900/20">
                <p className="text-xs font-medium text-green-900 dark:text-green-100">
                  Passed
                </p>
                <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
                  {summary.passed_count}
                </p>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
                <p className="text-xs font-medium text-red-900 dark:text-red-100">Failed</p>
                <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">
                  {summary.failed_count}
                </p>
              </div>
            </div>

            {/* Pass rate */}
            {hasTests && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Pass Rate
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {passRate}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={cn(
                      'h-full transition-all',
                      passRate >= 80
                        ? 'bg-green-500'
                        : passRate >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500',
                    )}
                    style={{ width: `${passRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Latest run */}
            {summary.latest_run && (
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Latest Run
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      STATUS_DOT[summary.latest_run.status as TestRunStatus],
                    )}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {STATUS_LABEL[summary.latest_run.status as TestRunStatus]}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(summary.latest_run.created_at)}
                  </span>
                </div>
                {summary.latest_run.status === 'passed' && (
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    {summary.latest_run.passed_criteria} of{' '}
                    {summary.latest_run.total_criteria} criteria met
                  </p>
                )}
                {summary.latest_run.status === 'failed' && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {summary.latest_run.failed_criteria} of{' '}
                    {summary.latest_run.total_criteria} criteria failed
                  </p>
                )}
              </div>
            )}

            {/* View details link */}
            <div className="mt-4">
              <Link
                to={`/projects/${project.id}/tests`}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                View Test History →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
