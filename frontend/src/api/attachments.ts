import { apiClient } from './client';
import type { Attachment, AttachmentConfig } from '@/types/api';

export const attachmentsApi = {
  /** Server-side limits (the size cap grows when object storage is configured). */
  config: async (): Promise<AttachmentConfig> => {
    const { data } = await apiClient.get<AttachmentConfig>('/attachments/config');
    return data;
  },
  list: async (taskId: string): Promise<Attachment[]> => {
    const { data } = await apiClient.get<Attachment[]>(`/tasks/${taskId}/attachments`);
    return data;
  },
  upload: async (taskId: string, file: File): Promise<Attachment> => {
    const form = new FormData();
    form.append('file', file, file.name);
    const { data } = await apiClient.post<Attachment>(`/tasks/${taskId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  /** Bytes come back through the authenticated client; the caller turns them into a download. */
  download: async (id: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(`/attachments/${id}/download`, { responseType: 'blob' });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/attachments/${id}`);
  },
};
