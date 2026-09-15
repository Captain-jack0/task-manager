import { apiClient } from './client';
import type { Notification, NotificationList } from '@/types/api';

export const notificationsApi = {
  list: async (unreadOnly = false): Promise<NotificationList> => {
    const { data } = await apiClient.get<NotificationList>('/notifications', {
      params: unreadOnly ? { unread_only: true } : undefined,
    });
    return data;
  },
  markRead: async (id: string): Promise<Notification> => {
    const { data } = await apiClient.post<Notification>(`/notifications/${id}/read`);
    return data;
  },
  markAllRead: async (): Promise<NotificationList> => {
    const { data } = await apiClient.post<NotificationList>('/notifications/read-all');
    return data;
  },
};
