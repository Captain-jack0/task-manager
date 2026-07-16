import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton, Badge, Segmented, formatDate } from '../components/ui';
import { STATUS_COLOR, STATUS_LABEL } from '../features/tasks/status';
import { useDeleteTask, useSnooze, useTask, useUpdateTask } from '../features/tasks/useTasks';
import type { RootStackParamList } from '../navigation';
import { colors, priorityColor, spacing } from '../theme';
import type { TaskStatus } from '../types/api';

const STATUS_OPTS = (['todo', 'in_progress', 'blocked', 'done', 'closed'] as TaskStatus[]).map(
  (s) => ({ label: STATUS_LABEL[s], value: s }),
);

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

export function TaskDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: task, isLoading } = useTask(id);
  const update = useUpdateTask();
  const snooze = useSnooze();
  const remove = useDeleteTask();

  if (isLoading || !task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{isLoading ? 'Loading…' : 'Task not found.'}</Text>
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert('Delete task', `Delete “${task.title}”? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(task.id, { onSuccess: () => navigation.goBack() }),
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{task.title}</Text>

      <View style={styles.badgeRow}>
        <Badge label={task.priority} color={priorityColor[task.priority]} />
        {task.energy_level && <Badge label={`${task.energy_level} energy`} color={colors.muted} />}
        {task.estimated_minutes != null && (
          <Badge label={`~${task.estimated_minutes}m`} color={colors.faint} />
        )}
        {task.due_date && <Badge label={`due ${formatDate(task.due_date)}`} color={colors.muted} />}
        {task.snooze_count > 0 && (
          <Badge label={`snoozed ${task.snooze_count}×`} color={colors.warnText} />
        )}
      </View>

      {task.description ? (
        <Text style={styles.description}>{task.description}</Text>
      ) : (
        <Text style={styles.muted}>No description.</Text>
      )}

      <View style={{ gap: 8 }}>
        <Text style={styles.sectionLabel}>Status</Text>
        <Segmented
          options={STATUS_OPTS}
          value={task.status}
          onChange={(status) => update.mutate({ id: task.id, input: { status } })}
        />
      </View>

      <View style={{ gap: 10, marginTop: 8 }}>
        <AppButton
          title="Snooze to tomorrow"
          variant="secondary"
          loading={snooze.isPending}
          onPress={() => snooze.mutate(task.id)}
        />
        <AppButton
          title="Delete task"
          variant="danger"
          loading={remove.isPending}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing, gap: 18 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.muted },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
