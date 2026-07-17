import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { extractErrorMessage } from '../../api/client';
import { AppButton } from '../../components/ui';
import { useCreateTag, useTags } from '../tags/useTags';
import { colors } from '../../theme';
import type { Tag } from '../../types/api';
import { parseQuickAdd } from './quickParse';
import { useCreateTask } from './useTasks';

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export function QuickAddBar() {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const createTask = useCreateTask();

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const hasMeta =
    !!parsed.priority ||
    !!parsed.energy ||
    parsed.estimated_minutes != null ||
    !!parsed.due_date ||
    parsed.tagNames.length > 0;

  const submit = async () => {
    if (!parsed.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const tagIds: string[] = [];
      for (const name of parsed.tagNames) {
        const existing = (tags ?? []).find(
          (t: Tag) => t.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) tagIds.push(existing.id);
        else {
          const created = await createTag.mutateAsync({ name });
          tagIds.push(created.id);
        }
      }
      await createTask.mutateAsync({
        title: parsed.title,
        priority: parsed.priority,
        energy_level: parsed.energy ?? null,
        estimated_minutes: parsed.estimated_minutes ?? null,
        due_date: parsed.due_date ?? null,
        tag_ids: tagIds,
      });
      setText('');
    } catch (err) {
      Alert.alert('Could not add task', extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Quick add — Call doctor tomorrow 15:00 #health !high ~30m"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <AppButton title="Add" onPress={submit} loading={submitting} disabled={!parsed.title.trim()} />
      </View>

      {text.trim().length > 0 && hasMeta && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{parsed.title || '(no title)'}</Text>
          {parsed.due_date && <Chip label={`📅 ${new Date(parsed.due_date).toLocaleString()}`} />}
          {parsed.priority && <Chip label={`! ${parsed.priority}`} />}
          {parsed.energy && <Chip label={`^ ${parsed.energy}`} />}
          {parsed.estimated_minutes != null && <Chip label={`~${parsed.estimated_minutes}m`} />}
          {parsed.tagNames.map((t) => (
            <Chip key={t} label={`#${t}`} />
          ))}
        </View>
      )}

      <Text style={styles.hint}>Syntax: #tag · !priority · ^energy · ~30m · tomorrow · 15:00</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
  },
  preview: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  previewTitle: { fontSize: 12, color: colors.muted },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, color: colors.muted },
  hint: { fontSize: 11, color: colors.faint },
});
