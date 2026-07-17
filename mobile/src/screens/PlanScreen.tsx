import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../components/ui';
import { CapacityCard } from '../features/review/CapacityCard';
import { CalendarCard } from '../features/calendar/CalendarCard';
import { isCompleted } from '../features/tasks/status';
import { useTasks } from '../features/tasks/useTasks';
import type { RootStackParamList } from '../navigation';
import { useWorkspaceStore } from '../store/workspaceStore';
import { colors, spacing } from '../theme';
import type { Task } from '../types/api';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  tasks,
  noteOf,
  empty,
  onPick,
}: {
  title: string;
  tasks: Task[];
  noteOf?: (t: Task) => string;
  empty: string;
  onPick: (id: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>
        {title} <Text style={styles.count}>{tasks.length}</Text>
      </Text>
      {tasks.length === 0 ? (
        <Text style={styles.faint}>{empty}</Text>
      ) : (
        tasks.map((t) => (
          <Pressable key={t.id} style={styles.row} onPress={() => onPick(t.id)}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {t.title}
            </Text>
            {noteOf && <Text style={styles.faint}>{noteOf(t)}</Text>}
          </Pressable>
        ))
      )}
    </View>
  );
}

export function PlanScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data } = useTasks({ workspace_id: workspaceId ?? undefined, limit: 200 });
  const tasks = data?.data ?? [];

  const now = new Date();
  const weekAgo = daysFromNow(-7);
  const weekAhead = daysFromNow(7);

  const completed = tasks.filter((t) => isCompleted(t.status) && new Date(t.updated_at) >= weekAgo);
  const createdThisWeek = tasks.filter((t) => new Date(t.created_at) >= weekAgo);
  const open = tasks.filter((t) => !isCompleted(t.status));
  const overdue = tasks
    .filter((t) => !isCompleted(t.status) && t.due_date && new Date(t.due_date) < now)
    .sort((a, b) => ((a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1));
  const comingUp = tasks
    .filter(
      (t) =>
        !isCompleted(t.status) &&
        t.due_date &&
        new Date(t.due_date) >= now &&
        new Date(t.due_date) <= weekAhead,
    )
    .sort((a, b) => ((a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1));
  const thisWeekLoad = tasks.filter(
    (t) => !isCompleted(t.status) && t.due_date && new Date(t.due_date) <= weekAhead,
  );

  const pick = (id: string) => nav.navigate('TaskDetail', { id });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Weekly review</Text>

      <View style={styles.statRow}>
        <Stat label="Completed" value={completed.length} />
        <Stat label="Created" value={createdThisWeek.length} />
        <Stat label="Overdue" value={overdue.length} />
        <Stat label="Open" value={open.length} />
      </View>

      <CapacityCard tasks={thisWeekLoad} />

      <Section
        title="Completed this week"
        tasks={completed}
        empty="Nothing finished in the last 7 days yet."
        onPick={pick}
      />
      <Section
        title="Overdue"
        tasks={overdue}
        noteOf={(t) => `due ${formatDate(t.due_date)}`}
        empty="Nothing overdue. Nice."
        onPick={pick}
      />
      <Section
        title="Coming up (7 days)"
        tasks={comingUp}
        noteOf={(t) => formatDate(t.due_date)}
        empty="Nothing scheduled for the next week."
        onPick={pick}
      />

      <CalendarCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing, gap: 18 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  count: { fontSize: 13, color: colors.faint, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTitle: { flex: 1, fontSize: 14, color: colors.text },
  faint: { fontSize: 12, color: colors.faint },
});
