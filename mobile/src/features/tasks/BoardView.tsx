import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui';
import { colors, priorityColor } from '../../theme';
import type { Task, TaskStatus } from '../../types/api';
import { NEXT_STATUS, STATUS_COLOR, STATUS_LABEL } from './status';
import { useUpdateTask } from './useTasks';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done', 'closed'];

export function BoardView({ tasks, onPick }: { tasks: Task[]; onPick: (id: string) => void }) {
  const update = useUpdateTask();

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
              items.map((t) => {
                const next = NEXT_STATUS[t.status];
                return (
                  <Pressable key={t.id} style={styles.card} onPress={() => onPick(t.id)}>
                    <Text style={styles.cardTitle} numberOfLines={3}>
                      {t.title}
                    </Text>
                    <Badge label={t.priority} color={priorityColor[t.priority]} />
                    {next && (
                      <Pressable
                        onPress={() => update.mutate({ id: t.id, input: { status: next } })}
                        hitSlop={6}
                      >
                        <Text style={styles.move}>→ {STATUS_LABEL[next]}</Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })
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
  move: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  empty: { fontSize: 13, color: colors.faint, paddingVertical: 8 },
});
