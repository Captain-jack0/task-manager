import { apiClient } from './client';
import type {
  BulkResult,
  SuggestParams,
  SuggestResponse,
  Task,
  TaskCreateInput,
  TaskListFilters,
  TaskBulkChanges,
  TaskEvent,
  TaskLinkInput,
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
  resetSnooze: async (id: string): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/tasks/${id}/reset-snooze`);
    return data;
  },
  get: async (id: string): Promise<Task> => {
    const { data } = await apiClient.get<Task>(`/tasks/${id}`);
    return data;
  },
  create: async (input: TaskCreateInput, workspaceId?: string | null): Promise<Task> => {
    const { data } = await apiClient.post<Task>('/tasks', input, {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
  update: async (id: string, input: TaskUpdateInput): Promise<Task> => {
    const { data } = await apiClient.patch<Task>(`/tasks/${id}`, input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`);
  },
  bulkUpdate: async (taskIds: string[], changes: TaskBulkChanges): Promise<BulkResult> => {
    const { data } = await apiClient.post<BulkResult>('/tasks/bulk', { task_ids: taskIds, ...changes });
    return data;
  },
  bulkDelete: async (taskIds: string[]): Promise<BulkResult> => {
    const { data } = await apiClient.post<BulkResult>('/tasks/bulk-delete', { task_ids: taskIds });
    return data;
  },
  activity: async (id: string): Promise<TaskEvent[]> => {
    const { data } = await apiClient.get<TaskEvent[]>(`/tasks/${id}/activity`);
    return data;
  },
  addLink: async (id: string, input: TaskLinkInput): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/tasks/${id}/links`, input);
    return data;
  },
  removeLink: async (id: string, linkId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}/links/${linkId}`);
  },
  createGithubIssue: async (id: string): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/tasks/${id}/github-issue`);
    return data;
  },
  syncGithubIssue: async (id: string): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/tasks/${id}/github-sync`);
    return data;
  },
};
