import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeApi } from '@/api/time';
import type { TimeEntryCreateInput } from '@/types/api';

export const RUNNING_KEY = ['time', 'running'] as const;
const taskTimeKey = (taskId: string) => ['time', 'task', taskId] as const;

export function useRunningTimer(enabled = true) {
  return useQuery({
    queryKey: RUNNING_KEY,
    queryFn: () => timeApi.running(),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useTaskTime(taskId: string) {
  return useQuery({ queryKey: taskTimeKey(taskId), queryFn: () => timeApi.forTask(taskId) });
}

function useInvalidateTime() {
  const qc = useQueryClient();
  return (taskId?: string) => {
    qc.invalidateQueries({ queryKey: RUNNING_KEY });
    qc.invalidateQueries({ queryKey: ['time'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    if (taskId) qc.invalidateQueries({ queryKey: taskTimeKey(taskId) });
  };
}

export function useStartTimer() {
  const invalidate = useInvalidateTime();
  return useMutation({
    mutationFn: (taskId: string) => timeApi.start(taskId),
    onSuccess: (_e, taskId) => invalidate(taskId),
  });
}

export function useStopTimer() {
  const invalidate = useInvalidateTime();
  return useMutation({
    mutationFn: (taskId: string) => timeApi.stop(taskId),
    onSuccess: (_e, taskId) => invalidate(taskId),
  });
}

export function useLogTime() {
  const invalidate = useInvalidateTime();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TimeEntryCreateInput }) => timeApi.log(taskId, input),
    onSuccess: (_e, { taskId }) => invalidate(taskId),
  });
}

export function useDeleteTimeEntry(taskId: string) {
  const invalidate = useInvalidateTime();
  return useMutation({
    mutationFn: (id: string) => timeApi.removeEntry(id),
    onSuccess: () => invalidate(taskId),
  });
}

/** Seconds since `startedAt`, ticking once a second while mounted. */
export function useElapsedSeconds(startedAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
