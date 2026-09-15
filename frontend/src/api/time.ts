import { apiClient } from './client';
import type { RunningTimer, TaskTime, TimeEntry, TimeEntryCreateInput, TimeReport } from '@/types/api';

export const timeApi = {
  start: async (taskId: string): Promise<TimeEntry> => {
    const { data } = await apiClient.post<TimeEntry>(`/tasks/${taskId}/timer/start`);
    return data;
  },
  stop: async (taskId: string): Promise<TimeEntry> => {
    const { data } = await apiClient.post<TimeEntry>(`/tasks/${taskId}/timer/stop`);
    return data;
  },
  log: async (taskId: string, input: TimeEntryCreateInput): Promise<TimeEntry> => {
    const { data } = await apiClient.post<TimeEntry>(`/tasks/${taskId}/time`, input);
    return data;
  },
  forTask: async (taskId: string): Promise<TaskTime> => {
    const { data } = await apiClient.get<TaskTime>(`/tasks/${taskId}/time`);
    return data;
  },
  running: async (): Promise<RunningTimer | null> => {
    const { data } = await apiClient.get<RunningTimer | null>('/time/running');
    return data;
  },
  removeEntry: async (id: string): Promise<void> => {
    await apiClient.delete(`/time/entries/${id}`);
  },
  report: async (startAt: string, endAt: string, workspaceId?: string | null): Promise<TimeReport> => {
    const { data } = await apiClient.get<TimeReport>('/time/report', {
      params: { start_at: startAt, end_at: endAt, ...(workspaceId ? { workspace_id: workspaceId } : {}) },
    });
    return data;
  },
};
