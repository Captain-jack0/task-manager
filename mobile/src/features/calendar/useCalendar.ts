import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarApi } from '../../api/calendar';
import type { CalendarSubscription } from '../../types/api';

const CALENDAR_KEY = ['calendar', 'subscription'] as const;

export function useCalendarSubscription(enabled: boolean) {
  return useQuery<CalendarSubscription>({
    queryKey: CALENDAR_KEY,
    queryFn: () => calendarApi.get(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useRotateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => calendarApi.rotate(),
    onSuccess: (data: CalendarSubscription) => qc.setQueryData(CALENDAR_KEY, data),
  });
}
