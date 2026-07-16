import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton, Badge, formatDate } from '../components/ui';
import { NEXT_STATUS, STATUS_COLOR, STATUS_LABEL, isCompleted } from '../features/tasks/status';
import { useSnooze, useTasks, useUpdateTask } from '../features/tasks/useTasks';
import { useWorkspaces } from '../features/workspaces/useWorkspaces';
import type { RootStackParamList } from '../navigation';
import { useWorkspaceStore } from '../store/workspaceStore';
import { colors, priorityColor, spacing } from '../theme';
import type { Task, Workspace } from '../types/api';

export function TasksScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const { data: workspaces } = useWorkspaces();
  const tasksQuery = useTasks({ workspace_id: workspaceId ?? undefined, limit: 100 });
  const tasks = tasksQuery.data?.data ?? [];

  return (
    <View style={styles.screen}>
      {workspaces && workspaces.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.wsBar}
          contentContainerStyle={styles.wsBarContent}
        >
          {workspaces.map((w: Workspace) => {
            const active = w.id === workspaceId;
            return (
              <Pressable
                key={w.id}
                onPress={() => setWorkspace(w.id)}
                style={[styles.wsChip, active && styles.wsChipActive]}
              >
                <Text style={[styles.wsChipText, active && styles.wsChipTextActive]}>
                  {w.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TaskCard task={item} onPress={() => nav.navigate('TaskDetail', { id: item.id })} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isRefetching}
            onRefresh={() => tasksQuery.refetch()}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tasksQuery.isLoading ? 'Loading…' : 'No tasks yet. Add one from the New tab.'}
          </Text>
        }
      />
    </View>
  );
}

function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  const update = useUpdateTask();
  const snooze = useSnooze();
  const next = NEXT_STATUS[task.status];
  const stuck = task.snooze_count >= 3 && !isCompleted(task.status);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.cardTitle}>{task.title}</Text>
      <View style={styles.badgeRow}>
        <Badge label={STATUS_LABEL[task.status]} color={STATUS_COLOR[task.status]} />
        <Badge label={task.priority} color={priorityColor[task.priority]} />
        {task.due_date && <Badge label={`due ${formatDate(task.due_date)}`} color={colors.muted} />}
        {task.estimated_minutes != null && (
          <Badge label={`~${task.estimated_minutes}m`} color={colors.faint} />
        )}
        {stuck && <Badge label={`snoozed ${task.snooze_count}×`} color={colors.warnText} />}
      </View>

      {!isCompleted(task.status) && (
        <View style={styles.actions}>
          {next && (
            <View style={styles.actionBtn}>
              <AppButton
                title={`→ ${STATUS_LABEL[next]}`}
                variant="secondary"
                loading={update.isPending}
                onPress={() => update.mutate({ id: task.id, input: { status: next } })}
              />
            </View>
          )}
          <View style={styles.actionBtn}>
            <AppButton
              title="Snooze"
              variant="secondary"
              loading={snooze.isPending}
              onPress={() => snooze.mutate(task.id)}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wsBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  wsBarContent: { padding: 12, gap: 8 },
  wsChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  wsChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  wsChipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  wsChipTextActive: { color: colors.primaryText },
  listContent: { padding: spacing, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, fontSize: 14 },
});
