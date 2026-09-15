import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { extractErrorMessage } from '../api/client';
import { AppButton, Field, Segmented } from '../components/ui';
import { useCreateTask } from '../features/tasks/useTasks';
import { DueField } from '../features/tasks/DueField';
import { useProjects } from '../features/projects/useProjects';
import { isOpenSprint, useSprints } from '../features/sprints/useSprints';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { TabParamList } from '../navigation';
import { colors, spacing } from '../theme';
import type { Project, TaskEnergy, TaskPriority } from '../types/api';

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

export function NewTaskScreen() {
  const nav = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const create = useCreateTask();
  const { data: projects } = useProjects();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data: sprints } = useSprints(workspaceId);
  const [sprintId, setSprintId] = useState('');
  const sprintOptions = [
    { label: 'Backlog', value: '' },
    ...(sprints ?? []).filter(isOpenSprint).map((s) => ({ label: s.name, value: s.id })),
  ];
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [energy, setEnergy] = useState<TaskEnergy | null>(null);
  const [minutes, setMinutes] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projectOptions = [
    { label: 'None', value: '' },
    ...(projects ?? []).map((p: Project) => ({ label: p.name, value: p.id })),
  ];

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
        due_date: dueDate ? dueDate.toISOString() : null,
        project_id: projectId || null,
        sprint_id: sprintId || null,
      },
      {
        onSuccess: () => {
          setTitle('');
          setPriority('medium');
          setEnergy(null);
          setMinutes(null);
          setDueDate(null);
          setProjectId('');
          setSprintId('');
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
          <DueField value={dueDate} onChange={setDueDate} />
        </View>

        {projects && projects.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Project</Text>
            <Segmented options={projectOptions} value={projectId} onChange={setProjectId} />
          </View>
        )}

        {sprintOptions.length > 1 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Sprint</Text>
            <Segmented options={sprintOptions} value={sprintId} onChange={setSprintId} />
          </View>
        )}

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
