import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors } from '../../theme';

function atHour(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(17, 0, 0, 0);
  return d;
}

const QUICK: { label: string; get: () => Date | null }[] = [
  { label: 'None', get: () => null },
  { label: 'Today', get: () => atHour(0) },
  { label: 'Tomorrow', get: () => atHour(1) },
  { label: 'Next week', get: () => atHour(7) },
];

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return a === b;
  return a.toDateString() === b.toDateString();
}

function label(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Due-date control: relative quick-picks + a native "Pick…" calendar. */
export function DueField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && date) {
      const d = new Date(date);
      d.setHours(17, 0, 0, 0);
      onChange(d);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        {QUICK.map((q) => {
          const qv = q.get();
          const active = q.label === 'None' ? value === null : sameDay(value, qv);
          return (
            <Pressable
              key={q.label}
              onPress={() => onChange(qv)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{q.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setShowPicker(true)} style={styles.chip}>
          <Text style={styles.chipText}>Pick…</Text>
        </Pressable>
      </View>

      {value && <Text style={styles.selected}>📅 {label(value)}</Text>}

      {showPicker && <DateTimePicker value={value ?? new Date()} mode="date" onChange={onPicked} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  chipTextActive: { color: colors.primaryText },
  selected: { fontSize: 13, color: colors.text, fontWeight: '500' },
});
