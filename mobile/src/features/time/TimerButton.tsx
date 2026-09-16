import { Alert } from 'react-native';
import { extractErrorMessage } from '../../api/client';
import { AppButton } from '../../components/ui';
import { formatClock, useElapsedSeconds, useRunningTimer, useStartTimer, useStopTimer } from './useTimer';

/** "▶ Start timer" / "■ Stop 12:34" for one task. Starting stops any other running timer. */
export function TimerButton({ taskId }: { taskId: string }) {
  const { data: running } = useRunningTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const isThis = running?.entry.task_id === taskId;
  const elapsed = useElapsedSeconds(isThis ? running?.entry.started_at : null);

  return (
    <AppButton
      title={isThis ? `■ Stop  ${formatClock(elapsed)}` : running ? '▶ Start here (stops other timer)' : '▶ Start timer'}
      variant={isThis ? 'primary' : 'secondary'}
      loading={start.isPending || stop.isPending}
      onPress={() =>
        isThis
          ? stop.mutate(taskId, {
              onSuccess: (e) => Alert.alert('Timer stopped', `Logged ${e.minutes} min`),
              onError: (err) => Alert.alert('Could not stop', extractErrorMessage(err)),
            })
          : start.mutate(taskId, { onError: (err) => Alert.alert('Could not start', extractErrorMessage(err)) })
      }
    />
  );
}
