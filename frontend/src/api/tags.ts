import { apiClient } from './client';
import type { Tag, TagCreateInput, TagUpdateInput } from '@/types/api';

export const tagsApi = {
  list: async (): Promise<Tag[]> => {
    const { data } = await apiClient.get<Tag[]>('/tags');
    return data;
  },
  create: async (input: TagCreateInput): Promise<Tag> => {
    const { data } = await apiClient.post<Tag>('/tags', input);
    return data;
  },
  update: async (id: string, input: TagUpdateInput): Promise<Tag> => {
    const { data } = await apiClient.patch<Tag>(`/tags/${id}`, input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/tags/${id}`);
  },
};
