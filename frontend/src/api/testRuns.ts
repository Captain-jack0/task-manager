import { apiClient } from './client';
import type { TestRun, TestRunSummary, TriggerTestsInput } from '@/types/api';

export const testRunsApi = {
  /**
   * List test runs for a project
   */
  list: async (
    projectId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<TestRun[]> => {
    const { data } = await apiClient.get<TestRun[]>(
      `/projects/${projectId}/test-runs`,
      { params: options },
    );
    return data;
  },

  /**
   * Get test run summary for a project
   */
  getSummary: async (projectId: string): Promise<TestRunSummary> => {
    const { data } = await apiClient.get<TestRunSummary>(
      `/projects/${projectId}/test-runs/summary`,
    );
    return data;
  },

  /**
   * Get a specific test run by ID
   */
  get: async (projectId: string, runId: string): Promise<TestRun> => {
    const { data } = await apiClient.get<TestRun>(
      `/projects/${projectId}/test-runs/${runId}`,
    );
    return data;
  },

  /**
   * Trigger tests manually for a project
   */
  trigger: async (
    projectId: string,
    input: TriggerTestsInput,
  ): Promise<{ message: string; project_id: string; repo: string }> => {
    const { data } = await apiClient.post(
      `/projects/${projectId}/test-runs/trigger`,
      input,
    );
    return data;
  },

  /**
   * Get test run dashboard for all projects
   */
  getDashboard: async (): Promise<Record<string, TestRunSummary>> => {
    const { data } = await apiClient.get<Record<string, TestRunSummary>>(
      `/test-runs/dashboard`,
    );
    return data;
  },
};
