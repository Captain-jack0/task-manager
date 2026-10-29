import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testRunsApi } from '@/api/testRuns';
import type { TriggerTestsInput } from '@/types/api';

export const TEST_RUNS_QUERY_KEY = 'testRuns';

/**
 * Fetch test runs for a project
 */
export function useTestRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: [TEST_RUNS_QUERY_KEY, projectId],
    queryFn: () => testRunsApi.list(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Fetch test run summary for a project
 */
export function useTestRunSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: [TEST_RUNS_QUERY_KEY, 'summary', projectId],
    queryFn: () => testRunsApi.getSummary(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Fetch a specific test run
 */
export function useTestRun(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: [TEST_RUNS_QUERY_KEY, projectId, runId],
    queryFn: () => testRunsApi.get(projectId!, runId!),
    enabled: !!projectId && !!runId,
  });
}

/**
 * Trigger tests manually
 */
export function useTriggerTests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: TriggerTestsInput;
    }) => testRunsApi.trigger(projectId, input),
    onSuccess: (_, variables) => {
      // Invalidate test runs queries to refetch after triggering
      queryClient.invalidateQueries({
        queryKey: [TEST_RUNS_QUERY_KEY, variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: [TEST_RUNS_QUERY_KEY, 'summary', variables.projectId],
      });
    },
  });
}

/**
 * Fetch test dashboard for all projects
 */
export function useTestDashboard() {
  return useQuery({
    queryKey: [TEST_RUNS_QUERY_KEY, 'dashboard'],
    queryFn: () => testRunsApi.getDashboard(),
  });
}
