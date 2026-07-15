import { apiClient } from './client';
import type {
  SuggestParams,
  SuggestResponse,
  Task,
  TaskCreateInput,
  TaskListFilters,
  TaskListResponse,
  TaskUpdateInput,
} from '@/types/api';

export const tasksApi = {
  list: async (filters: TaskListFilters = {}): Promise<TaskListResponse> => {
    const { data } = await apiClient.get<TaskListResponse>('/tasks', { params: filters });
    return data;
  },
  suggest: async (params: SuggestParams = {}): Promise<SuggestResponse> => {
    const { data } = await apiClient.get<SuggestResponse>('/tasks/suggest', { params });
    return data;
  },
  snooze: async (id: string): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/tasks/${id}/snooze`);
    return data;
  },
  get: async (id: string): Promise<Task> => {
    const { data } = await apiClient.get<Task>(`/tasks/${id}`);
    return data;
  },
  create: async (input: TaskCreateInput): Promise<Task> => {
    const { data } = await apiClient.post<Task>('/tasks', input);
    return data;
  },
  update: async (id: string, input: TaskUpdateInput): Promise<Task> => {
    const { data } = await apiClient.patch<Task>(`/tasks/${id}`, input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`);
  },
};
