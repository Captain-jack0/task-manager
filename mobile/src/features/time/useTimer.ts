import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeApi } from '../../api/time';
import type { RunningTimer } from '../../types/api';

const RUNNING_KEY = ['time', 'running'];

export function useRunningTimer() {
  return useQuery<RunningTimer | null>({
    queryKey: RUNNING_KEY,
    queryFn: () => timeApi.running(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

function useAfterTimerChange() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: RUNNING_KEY });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };
}

export function useStartTimer() {
  const after = useAfterTimerChange();
  return useMutation({ mutationFn: (taskId: string) => timeApi.start(taskId), onSuccess: after });
}

export function useStopTimer() {
  const after = useAfterTimerChange();
  return useMutation({ mutationFn: (taskId: string) => timeApi.stop(taskId), onSuccess: after });
}

export function useElapsedSeconds(startedAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
