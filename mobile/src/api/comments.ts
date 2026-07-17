import { apiClient } from './client';
import type { Comment } from '../types/api';

export const commentsApi = {
  list: async (taskId: string): Promise<Comment[]> => {
    const { data } = await apiClient.get<Comment[]>(`/tasks/${taskId}/comments`);
    return data;
  },
  create: async (taskId: string, body: string): Promise<Comment> => {
    const { data } = await apiClient.post<Comment>(`/tasks/${taskId}/comments`, { body });
    return data;
  },
  remove: async (taskId: string, commentId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}/comments/${commentId}`);
  },
};
