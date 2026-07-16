import { apiClient } from './client';
import type { CalendarSubscription } from '@/types/api';

export const calendarApi = {
  getSubscription: async (): Promise<CalendarSubscription> => {
    const { data } = await apiClient.get<CalendarSubscription>('/calendar/subscription');
    return data;
  },
  rotate: async (): Promise<CalendarSubscription> => {
    const { data } = await apiClient.post<CalendarSubscription>('/calendar/subscription/rotate');
    return data;
  },
};
