import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Segmented, formatDate } from '../components/ui';
import { STATUS_COLOR, STATUS_LABEL } from '../features/tasks/status';
import { useSuggest } from '../features/tasks/useTasks';
import type { RootStackParamList } from '../navigation';
import { useWorkspaceStore } from '../store/workspaceStore';
import { colors, priorityColor, spacing } from '../theme';
import type { TaskEnergy, TaskSuggestion } from '../types/api';

const ENERGY_OPTS = [
  { label: 'Any', value: 'any' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];
const MINUTE_OPTS = [
  { label: 'Any', value: 'any' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '2h', value: '120' },
];

export function NowScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [energy, setEnergy] = useState('any');
  const [minutes, setMinutes] = useState('any');

  const { data, isFetching } = useSuggest(
    {
      workspace_id: workspaceId ?? undefined,
      energy: energy === 'any' ? undefined : (energy as TaskEnergy),
      minutes: minutes === 'any' ? undefined : Number(minutes),
      limit: 5,
    },
    Boolean(workspaceId),
  );

  const suggestions = data?.suggestions ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>What should I do now?</Text>

      <View style={{ gap: 8 }}>
        <Text style={styles.label}>My energy</Text>
        <Segmented options={ENERGY_OPTS} value={energy} onChange={setEnergy} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Time I have</Text>
        <Segmented options={MINUTE_OPTS} value={minutes} onChange={setMinutes} />
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        {isFetching && suggestions.length === 0 ? (
          <Text style={styles.empty}>Finding the best fit…</Text>
        ) : suggestions.length === 0 ? (
          <Text style={styles.empty}>Nothing fits right now. Try a wider time or energy.</Text>
        ) : (
          suggestions.map((s: TaskSuggestion) => (
            <Pressable
              key={s.task.id}
              style={styles.card}
              onPress={() => nav.navigate('TaskDetail', { id: s.task.id })}
            >
              <Text style={styles.cardTitle}>{s.task.title}</Text>
              <Text style={styles.reason}>{s.reason}</Text>
              <View style={styles.badgeRow}>
                <Badge label={STATUS_LABEL[s.task.status]} color={STATUS_COLOR[s.task.status]} />
                <Badge label={s.task.priority} color={priorityColor[s.task.priority]} />
                {s.task.estimated_minutes != null && (
                  <Badge label={`~${s.task.estimated_minutes}m`} color={colors.faint} />
                )}
                {s.task.due_date && (
                  <Badge label={`due ${formatDate(s.task.due_date)}`} color={colors.muted} />
                )}
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing, gap: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '500', color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  reason: { fontSize: 13, color: colors.primary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24, fontSize: 14 },
});
