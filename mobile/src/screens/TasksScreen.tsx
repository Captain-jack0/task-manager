import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppModal } from '../components/AppModal';
import { AppButton, Badge, Field, formatDate } from '../components/ui';
import { NEXT_STATUS, STATUS_COLOR, STATUS_LABEL, isCompleted } from '../features/tasks/status';
import { QuickAddBar } from '../features/tasks/QuickAddBar';
import { BoardView } from '../features/tasks/BoardView';
import { dueToIso } from '../features/tasks/due';
import { useSnooze, useTasks, useUpdateTask } from '../features/tasks/useTasks';
import { useCreateProject, useProjects } from '../features/projects/useProjects';
import { GithubImportModal } from '../features/projects/GithubImportModal';
import { useGithubStatus } from '../features/integrations/useGithub';
import { useWorkspaces } from '../features/workspaces/useWorkspaces';
import { useMembers } from '../features/workspaces/useMembers';
import type { RootStackParamList } from '../navigation';
import { useWorkspaceStore } from '../store/workspaceStore';
import { colors, priorityColor, spacing } from '../theme';
import type { Member, Project, Task, TaskStatus, Workspace } from '../types/api';

const STATUS_FILTERS: { label: string; value: 'all' | TaskStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'To do', value: 'todo' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Blocked', value: 'blocked' },
  { label: 'Done', value: 'done' },
  { label: 'Closed', value: 'closed' },
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function TasksScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const { data: workspaces } = useWorkspaces();
  const { data: projects } = useProjects();
  const { data: members } = useMembers(workspaceId);
  const tasksQuery = useTasks({ workspace_id: workspaceId ?? undefined, limit: 200 });
  const tasks = tasksQuery.data?.data ?? [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const createProject = useCreateProject();
  const { data: githubStatus } = useGithubStatus();

  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (projects ?? []).forEach((p: Project) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  const assigneeEmailById = useMemo(() => {
    const map: Record<string, string> = {};
    (members ?? []).forEach((m: Member) => {
      map[m.user_id] = m.email;
    });
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (statusFilter === 'all' || t.status === statusFilter) &&
        (projectFilter === 'all' || t.project_id === projectFilter) &&
        (q === '' || t.title.toLowerCase().includes(q)),
    );
  }, [tasks, search, statusFilter, projectFilter]);

  const submitNewProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    createProject.mutate(
      { name },
      {
        onSuccess: (p) => {
          setProjectFilter(p.id);
          setNewProjectName('');
          setShowNewProject(false);
        },
      },
    );
  };

  const header = (
    <View style={styles.header}>
      <QuickAddBar />

      {workspaces && workspaces.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {workspaces.map((w: Workspace) => (
            <Chip
              key={w.id}
              label={w.name}
              active={w.id === workspaceId}
              onPress={() => setWorkspace(w.id)}
            />
          ))}
        </ScrollView>
      )}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search tasks"
        placeholderTextColor={colors.faint}
        style={styles.search}
        autoCapitalize="none"
        returnKeyType="search"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            active={statusFilter === s.value}
            onPress={() => setStatusFilter(s.value)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All projects" active={projectFilter === 'all'} onPress={() => setProjectFilter('all')} />
        {(projects ?? []).map((p: Project) => (
          <Chip
            key={p.id}
            label={p.name}
            active={projectFilter === p.id}
            onPress={() => setProjectFilter(p.id)}
          />
        ))}
        <Chip label="＋ New" active={false} onPress={() => setShowNewProject(true)} />
        {githubStatus?.connected && (
          <Chip label="⤓ GitHub" active={false} onPress={() => setShowImport(true)} />
        )}
      </ScrollView>

      <View style={styles.viewToggle}>
        <Chip label="List" active={view === 'list'} onPress={() => setView('list')} />
        <Chip label="Board" active={view === 'board'} onPress={() => setView('board')} />
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {view === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              projectName={item.project_id ? projectNameById[item.project_id] : undefined}
              assigneeEmail={item.assignee_id ? assigneeEmailById[item.assignee_id] : undefined}
              onPress={() => nav.navigate('TaskDetail', { id: item.id })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={tasksQuery.isRefetching}
              onRefresh={() => tasksQuery.refetch()}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tasksQuery.isLoading ? 'Loading…' : 'No tasks match. Add one from the New tab.'}
            </Text>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {header}
          <BoardView tasks={filtered} onPick={(id) => nav.navigate('TaskDetail', { id })} />
        </ScrollView>
      )}

      <AppModal visible={showNewProject} onClose={() => setShowNewProject(false)} title="New project">
        <Field
          label="Name"
          value={newProjectName}
          onChangeText={setNewProjectName}
          placeholder="e.g. Website redesign"
          autoFocus
        />
        <AppButton title="Create project" onPress={submitNewProject} loading={createProject.isPending} />
      </AppModal>

      <GithubImportModal
        visible={showImport}
        onClose={() => setShowImport(false)}
        existingNames={new Set((projects ?? []).map((p: Project) => p.name.toLowerCase()))}
      />
    </View>
  );
}

function TaskCard({
  task,
  projectName,
  assigneeEmail,
  onPress,
}: {
  task: Task;
  projectName?: string;
  assigneeEmail?: string;
  onPress: () => void;
}) {
  const update = useUpdateTask();
  const snooze = useSnooze();
  const [showPicker, setShowPicker] = useState(false);
  const next = NEXT_STATUS[task.status];
  const stuck = task.snooze_count >= 3 && !isCompleted(task.status);

  const scheduleAt = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(17, 0, 0, 0);
    update.mutate({ id: task.id, input: { due_date: nd.toISOString() } });
  };

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.cardTitle}>{task.title}</Text>
      <View style={styles.badgeRow}>
        <Badge label={STATUS_LABEL[task.status]} color={STATUS_COLOR[task.status]} />
        <Badge label={task.priority} color={priorityColor[task.priority]} />
        {projectName && <Badge label={projectName} color={colors.primary} />}
        {assigneeEmail && <Badge label={`@ ${assigneeEmail}`} color={colors.success} />}
        {task.due_date && <Badge label={`due ${formatDate(task.due_date)}`} color={colors.muted} />}
        {task.estimated_minutes != null && (
          <Badge label={`~${task.estimated_minutes}m`} color={colors.faint} />
        )}
        {stuck && <Badge label={`snoozed ${task.snooze_count}×`} color={colors.warnText} />}
      </View>

      {!isCompleted(task.status) && (
        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleLabel}>{task.due_date ? 'Reschedule:' : '📅 Schedule:'}</Text>
          {(
            [
              { label: 'Today', value: 'today' },
              { label: 'Tomorrow', value: 'tomorrow' },
              { label: 'Next week', value: 'week' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => update.mutate({ id: task.id, input: { due_date: dueToIso(opt.value) } })}
              hitSlop={4}
            >
              <Text style={styles.scheduleLink}>{opt.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowPicker(true)} hitSlop={4}>
            <Text style={styles.scheduleLink}>Pick…</Text>
          </Pressable>
        </View>
      )}

      {showPicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          onChange={(e, d) => {
            setShowPicker(false);
            if (e.type === 'set' && d) scheduleAt(d);
          }}
        />
      )}

      {!isCompleted(task.status) && (
        <View style={styles.actions}>
          {next && (
            <View style={styles.actionBtn}>
              <AppButton
                title={`→ ${STATUS_LABEL[next]}`}
                variant="secondary"
                loading={update.isPending}
                onPress={() => update.mutate({ id: task.id, input: { status: next } })}
              />
            </View>
          )}
          <View style={styles.actionBtn}>
            <AppButton
              title="Snooze"
              variant="secondary"
              loading={snooze.isPending}
              onPress={() => snooze.mutate(task.id)}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { gap: 10, paddingBottom: 6 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  chipTextActive: { color: colors.primaryText },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  viewToggle: { flexDirection: 'row', gap: 8 },
  listContent: { padding: spacing, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scheduleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  scheduleLabel: { fontSize: 12, color: colors.faint },
  scheduleLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, fontSize: 14 },
});
