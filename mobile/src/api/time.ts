import { apiClient } from './client';
import type { RunningTimer, TimeEntry } from '../types/api';

export const timeApi = {
  start: async (taskId: string): Promise<TimeEntry> => {
    const { data } = await apiClient.post<TimeEntry>(`/tasks/${taskId}/timer/start`);
    return data;
  },
  stop: async (taskId: string): Promise<TimeEntry> => {
    const { data } = await apiClient.post<TimeEntry>(`/tasks/${taskId}/timer/stop`);
    return data;
  },
  running: async (): Promise<RunningTimer | null> => {
    const { data } = await apiClient.get<RunningTimer | null>('/time/running');
    return data;
  },
};
