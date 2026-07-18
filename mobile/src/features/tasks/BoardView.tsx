import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui';
import { colors, priorityColor } from '../../theme';
import type { Task, TaskStatus } from '../../types/api';
import { dueToIso } from './due';
import { NEXT_STATUS, STATUS_COLOR, STATUS_LABEL, isCompleted } from './status';
import { useUpdateTask } from './useTasks';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done', 'closed'];

function BoardCard({ task, onPick }: { task: Task; onPick: (id: string) => void }) {
  const update = useUpdateTask();
  const [showPicker, setShowPicker] = useState(false);
  const next = NEXT_STATUS[task.status];

  const scheduleAt = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(17, 0, 0, 0);
    update.mutate({ id: task.id, input: { due_date: nd.toISOString() } });
  };

  return (
    <Pressable style={styles.card} onPress={() => onPick(task.id)}>
      <Text style={styles.cardTitle} numberOfLines={3}>
        {task.title}
      </Text>
      <Badge label={task.priority} color={priorityColor[task.priority]} />

      {!isCompleted(task.status) && (
        <View style={styles.sched}>
          <Text style={styles.schedLabel}>{task.due_date ? 'Move:' : '📅'}</Text>
          {(
            [
              { label: 'Today', value: 'today' },
              { label: 'Tmrw', value: 'tomorrow' },
              { label: 'Week', value: 'week' },
            ] as const
          ).map((o) => (
            <Pressable
              key={o.value}
              hitSlop={4}
              onPress={() => update.mutate({ id: task.id, input: { due_date: dueToIso(o.value) } })}
            >
              <Text style={styles.schedLink}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable hitSlop={4} onPress={() => setShowPicker(true)}>
            <Text style={styles.schedLink}>Pick…</Text>
          </Pressable>
        </View>
      )}

      {next && (
        <Pressable
          hitSlop={6}
          onPress={() => update.mutate({ id: task.id, input: { status: next } })}
        >
          <Text style={styles.move}>→ {STATUS_LABEL[next]}</Text>
        </Pressable>
      )}

      {showPicker && (
        <DateTimePicker
          value={task.due_date ? new Date(task.due_date) : new Date()}
          mode="date"
          onChange={(e, d) => {
            setShowPicker(false);
            if (e.type === 'set' && d) scheduleAt(d);
          }}
        />
      )}
    </Pressable>
  );
}

export function BoardView({ tasks, onPick }: { tasks: Task[]; onPick: (id: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.board}
    >
      {COLUMNS.map((st) => {
        const items = tasks.filter((t) => t.status === st);
        return (
          <View key={st} style={styles.column}>
            <View style={styles.colHead}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLOR[st] }]} />
              <Text style={styles.colTitle}>{STATUS_LABEL[st]}</Text>
              <Text style={styles.colCount}>{items.length}</Text>
            </View>
            {items.length === 0 ? (
              <Text style={styles.empty}>—</Text>
            ) : (
              items.map((t) => <BoardCard key={t.id} task={t} onPick={onPick} />)
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  board: { gap: 12, paddingBottom: 8 },
  column: { width: 240, gap: 8 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  colCount: { fontSize: 12, color: colors.faint, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  sched: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  schedLabel: { fontSize: 11, color: colors.faint },
  schedLink: { fontSize: 11, fontWeight: '600', color: colors.primary },
  move: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  empty: { fontSize: 13, color: colors.faint, paddingVertical: 8 },
});
