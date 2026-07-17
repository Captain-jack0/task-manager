import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../../components/ui';
import { useUpdateTask } from '../tasks/useTasks';
import { useCapacityStore } from '../../store/capacityStore';
import { colors } from '../../theme';
import type { Task, TaskPriority } from '../../types/api';

const DEFAULT_MIN = 30;
const RANK: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
const estOf = (t: Task) => t.estimated_minutes ?? DEFAULT_MIN;

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** `tasks` = open tasks committed to this week (overdue + due within 7 days). */
export function CapacityCard({ tasks }: { tasks: Task[] }) {
  const weeklyHours = useCapacityStore((s) => s.weeklyHours);
  const setWeeklyHours = useCapacityStore((s) => s.setWeeklyHours);
  const update = useUpdateTask();
  const [busy, setBusy] = useState(false);
  const [hoursText, setHoursText] = useState(String(weeklyHours));

  const capacityMin = weeklyHours * 60;

  const { planned, keep, move } = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const p = RANK[b.priority] - RANK[a.priority];
      if (p !== 0) return p;
      return (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1;
    });
    let running = 0;
    const keep: Task[] = [];
    const move: Task[] = [];
    for (const t of sorted) {
      const e = estOf(t);
      if (running + e <= capacityMin) {
        keep.push(t);
        running += e;
      } else {
        move.push(t);
      }
    }
    const planned = tasks.reduce((s, t) => s + estOf(t), 0);
    return { planned, keep, move };
  }, [tasks, capacityMin]);

  const over = planned > capacityMin && move.length > 0;
  const pct = Math.min(100, Math.round((planned / Math.max(1, capacityMin)) * 100));

  const applyReplan = async () => {
    setBusy(true);
    try {
      for (const t of move) {
        const base = t.due_date ? new Date(t.due_date) : new Date();
        base.setDate(base.getDate() + 7);
        await update.mutateAsync({ id: t.id, input: { due_date: base.toISOString() } });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, over && styles.cardWarn]}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>This week's capacity</Text>
        <View style={styles.hoursRow}>
          <TextInput
            value={hoursText}
            onChangeText={(t) => {
              setHoursText(t);
              const n = Number(t);
              if (!Number.isNaN(n) && n > 0) setWeeklyHours(n);
            }}
            keyboardType="number-pad"
            style={styles.hoursInput}
          />
          <Text style={styles.muted}>h</Text>
        </View>
      </View>

      <View style={styles.barLabels}>
        <Text style={[styles.muted, over && styles.warnText]}>~{fmt(planned)} planned</Text>
        <Text style={styles.faint}>of {weeklyHours}h</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }, over && styles.barFillWarn]} />
      </View>

      {over ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.body, styles.warnText]}>
            Over capacity. Move these {move.length} to next week to fit the rest into {weeklyHours}h:
          </Text>
          {move.map((t) => (
            <View key={t.id} style={styles.moveRow}>
              <Text style={styles.moveTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.faint}>~{fmt(estOf(t))}</Text>
            </View>
          ))}
          <AppButton
            title={`Move ${move.length} to next week`}
            onPress={applyReplan}
            loading={busy}
          />
        </View>
      ) : (
        <Text style={styles.muted}>
          {tasks.length === 0
            ? 'Nothing scheduled for this week.'
            : `On track — ${keep.length} task${keep.length === 1 ? '' : 's'} fit within ${weeklyHours}h.`}
        </Text>
      )}
      <Text style={styles.faint}>Tasks without an estimate count as ~{DEFAULT_MIN}m.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardWarn: { borderColor: '#fcd34d', backgroundColor: colors.warnBg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hoursInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 14,
    color: colors.text,
    minWidth: 52,
    textAlign: 'center',
    backgroundColor: colors.card,
  },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.text },
  barFillWarn: { backgroundColor: '#f59e0b' },
  body: { fontSize: 14, lineHeight: 20, color: colors.text },
  moveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  moveTitle: { flex: 1, fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  faint: { fontSize: 12, color: colors.faint },
  warnText: { color: colors.warnText, fontWeight: '500' },
});
