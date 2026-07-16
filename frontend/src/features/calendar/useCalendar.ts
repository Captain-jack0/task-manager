import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarApi } from '@/api/calendar';
import type { CalendarSubscription } from '@/types/api';

export const CALENDAR_KEY = ['calendar', 'subscription'] as const;

/** Fetch (minting on first use) the iCal feed URL. Gated by `enabled` so we
 * don't create a token until the user actually opens the calendar panel. */
export function useCalendarSubscription(enabled: boolean) {
  return useQuery({
    queryKey: CALENDAR_KEY,
    queryFn: () => calendarApi.getSubscription(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useRotateCalendarToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => calendarApi.rotate(),
    onSuccess: (data: CalendarSubscription) => qc.setQueryData(CALENDAR_KEY, data),
  });
}
