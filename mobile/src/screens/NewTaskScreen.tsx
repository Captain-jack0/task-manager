import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { extractErrorMessage } from '../api/client';
import { AppButton, Field, Segmented } from '../components/ui';
import { useCreateTask } from '../features/tasks/useTasks';
import type { TabParamList } from '../navigation';
import { colors, spacing } from '../theme';
import type { TaskEnergy, TaskPriority } from '../types/api';

const PRIORITY_OPTS = [
  { label: 'Low', value: 'low' as TaskPriority },
  { label: 'Medium', value: 'medium' as TaskPriority },
  { label: 'High', value: 'high' as TaskPriority },
];
const ENERGY_OPTS = [
  { label: 'Low', value: 'low' as TaskEnergy },
  { label: 'Medium', value: 'medium' as TaskEnergy },
  { label: 'High', value: 'high' as TaskEnergy },
];
const MINUTE_OPTS = [
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '2h', value: '120' },
];
const DUE_OPTS = [
  { label: 'None', value: 'none' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next week', value: 'week' },
];

function dueToIso(value: string): string | null {
  if (value === 'none') return null;
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  if (value === 'tomorrow') d.setDate(d.getDate() + 1);
  if (value === 'week') d.setDate(d.getDate() + 7);
  return d.toISOString();
}

export function NewTaskScreen() {
  const nav = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const create = useCreateTask();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [energy, setEnergy] = useState<TaskEnergy | null>(null);
  const [minutes, setMinutes] = useState<string | null>(null);
  const [due, setDue] = useState('none');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) {
      setError('Give the task a title.');
      return;
    }
    setError(null);
    create.mutate(
      {
        title: title.trim(),
        priority,
        energy_level: energy ?? undefined,
        estimated_minutes: minutes ? Number(minutes) : undefined,
        due_date: dueToIso(due),
      },
      {
        onSuccess: () => {
          setTitle('');
          setPriority('medium');
          setEnergy(null);
          setMinutes(null);
          setDue('none');
          nav.navigate('Tasks');
        },
        onError: (err) => setError(extractErrorMessage(err, 'Could not create task')),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing?"
        />

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Priority</Text>
          <Segmented options={PRIORITY_OPTS} value={priority} onChange={setPriority} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Energy needed</Text>
          <Segmented options={ENERGY_OPTS} value={energy} onChange={setEnergy} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Estimated time</Text>
          <Segmented options={MINUTE_OPTS} value={minutes} onChange={setMinutes} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Due</Text>
          <Segmented options={DUE_OPTS} value={due} onChange={setDue} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <AppButton title="Add task" onPress={submit} loading={create.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing, gap: 20 },
  label: { fontSize: 13, fontWeight: '500', color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
});
