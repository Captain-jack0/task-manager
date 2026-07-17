import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { extractErrorMessage } from '../api/client';
import { AppButton, Badge, Field, Segmented, formatDate } from '../components/ui';
import { STATUS_COLOR, STATUS_LABEL } from '../features/tasks/status';
import { dueToIso } from '../features/tasks/due';
import { useDeleteTask, useSnooze, useTask, useUpdateTask } from '../features/tasks/useTasks';
import { useProjects } from '../features/projects/useProjects';
import type { RootStackParamList } from '../navigation';
import { colors, priorityColor, spacing } from '../theme';
import type { Project, TaskEnergy, TaskPriority, TaskStatus, TaskUpdateInput } from '../types/api';

const STATUS_OPTS = (['todo', 'in_progress', 'blocked', 'done', 'closed'] as TaskStatus[]).map(
  (s) => ({ label: STATUS_LABEL[s], value: s }),
);
const PRIORITY_OPTS = [
  { label: 'Low', value: 'low' as TaskPriority },
  { label: 'Medium', value: 'medium' as TaskPriority },
  { label: 'High', value: 'high' as TaskPriority },
];
const ENERGY_OPTS = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];
const DUE_OPTS = [
  { label: 'Keep', value: 'keep' },
  { label: 'None', value: 'none' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next week', value: 'week' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

export function TaskDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: task, isLoading } = useTask(id);
  const { data: projects } = useProjects();
  const update = useUpdateTask();
  const snooze = useSnooze();
  const remove = useDeleteTask();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [energy, setEnergy] = useState('none');
  const [estimate, setEstimate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueChoice, setDueChoice] = useState('keep');
  const [err, setErr] = useState<string | null>(null);

  const projectOptions = [
    { label: 'None', value: '' },
    ...(projects ?? []).map((p: Project) => ({ label: p.name, value: p.id })),
  ];
  const projectName = task?.project_id
    ? (projects ?? []).find((p: Project) => p.id === task.project_id)?.name
    : undefined;

  if (isLoading || !task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{isLoading ? 'Loading…' : 'Task not found.'}</Text>
      </View>
    );
  }

  const startEdit = () => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority);
    setEnergy(task.energy_level ?? 'none');
    setEstimate(task.estimated_minutes != null ? String(task.estimated_minutes) : '');
    setProjectId(task.project_id ?? '');
    setDueChoice('keep');
    setErr(null);
    setEditing(true);
  };

  const save = async () => {
    if (!title.trim()) {
      setErr('Title cannot be empty.');
      return;
    }
    setErr(null);
    const n = Number(estimate);
    const input: TaskUpdateInput = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      priority,
      energy_level: energy === 'none' ? null : (energy as TaskEnergy),
      estimated_minutes:
        estimate.trim() === '' || Number.isNaN(n) ? null : Math.max(1, Math.round(n)),
      project_id: projectId === '' ? null : projectId,
    };
    if (dueChoice !== 'keep') input.due_date = dueToIso(dueChoice);
    try {
      await update.mutateAsync({ id: task.id, input });
      setEditing(false);
    } catch (e) {
      setErr(extractErrorMessage(e, 'Could not save changes'));
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete task', `Delete “${task.title}”? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(task.id, { onSuccess: () => navigation.goBack() }),
      },
    ]);
  };

  if (editing) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Task title" />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details"
          multiline
        />
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>Priority</Text>
          <Segmented options={PRIORITY_OPTS} value={priority} onChange={setPriority} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>Energy</Text>
          <Segmented options={ENERGY_OPTS} value={energy} onChange={setEnergy} />
        </View>
        <Field
          label="Estimated minutes"
          value={estimate}
          onChangeText={setEstimate}
          keyboardType="number-pad"
          placeholder="e.g. 30"
        />
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>Due</Text>
          <Segmented options={DUE_OPTS} value={dueChoice} onChange={setDueChoice} />
        </View>
        {projects && projects.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>Project</Text>
            <Segmented options={projectOptions} value={projectId} onChange={setProjectId} />
          </View>
        )}

        {err && <Text style={styles.error}>{err}</Text>}

        <View style={{ gap: 10, marginTop: 4 }}>
          <AppButton title="Save changes" onPress={save} loading={update.isPending} />
          <AppButton title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{task.title}</Text>
      </View>

      <View style={styles.badgeRow}>
        <Badge label={STATUS_LABEL[task.status]} color={STATUS_COLOR[task.status]} />
        <Badge label={task.priority} color={priorityColor[task.priority]} />
        {projectName && <Badge label={projectName} color={colors.primary} />}
        {task.energy_level && <Badge label={`${task.energy_level} energy`} color={colors.muted} />}
        {task.estimated_minutes != null && (
          <Badge label={`~${task.estimated_minutes}m`} color={colors.faint} />
        )}
        {task.due_date && <Badge label={`due ${formatDate(task.due_date)}`} color={colors.muted} />}
        {task.snooze_count > 0 && (
          <Badge label={`snoozed ${task.snooze_count}×`} color={colors.warnText} />
        )}
      </View>

      {task.description ? (
        <Text style={styles.description}>{task.description}</Text>
      ) : (
        <Text style={styles.muted}>No description.</Text>
      )}

      <View style={{ gap: 8 }}>
        <Text style={styles.sectionLabel}>Status</Text>
        <Segmented
          options={STATUS_OPTS}
          value={task.status}
          onChange={(status) => update.mutate({ id: task.id, input: { status } })}
        />
      </View>

      <View style={{ gap: 10, marginTop: 8 }}>
        <AppButton title="Edit task" variant="secondary" onPress={startEdit} />
        <AppButton
          title="Snooze to tomorrow"
          variant="secondary"
          loading={snooze.isPending}
          onPress={() => snooze.mutate(task.id)}
        />
        <AppButton
          title="Delete task"
          variant="danger"
          loading={remove.isPending}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing, gap: 18 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, flex: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.muted },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
});
