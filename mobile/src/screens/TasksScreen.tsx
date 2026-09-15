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
import { isOpenSprint, useSprints } from '../features/sprints/useSprints';
import { displayName } from '../lib/people';
import { formatDuration } from '../features/time/useTimer';
import { useMembers } from '../features/workspaces/useMembers';
import type { RootStackParamList } from '../navigation';
import { useWorkspaceStore } from '../store/workspaceStore';
import { colors, priorityColor, spacing } from '../theme';
import type { Member, Project, Task, TaskEnergy, TaskPriority, TaskStatus, Workspace } from '../types/api';

const STATUS_FILTERS: { label: string; value: 'all' | TaskStatus }[] = [
  { label: 'All open', value: 'all' },
  { label: 'To do', value: 'todo' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Blocked', value: 'blocked' },
  { label: 'Done', value: 'done' },
  { label: 'Archive', value: 'closed' },
];

type SortKey = 'created_asc' | 'created_desc' | 'due' | 'priority';
const SORTS: { label: string; value: SortKey; sort: 'created_at' | 'due_date' | 'priority'; order: 'asc' | 'desc' }[] = [
  { label: 'Oldest first', value: 'created_asc', sort: 'created_at', order: 'asc' },
  { label: 'Newest first', value: 'created_desc', sort: 'created_at', order: 'desc' },
  { label: 'Due date', value: 'due', sort: 'due_date', order: 'asc' },
  { label: 'Priority', value: 'priority', sort: 'priority', order: 'desc' },
];
const LEVELS: { label: string; value: 'high' | 'medium' | 'low' }[] = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
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
  const { data: sprints } = useSprints(workspaceId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [sprintFilter, setSprintFilter] = useState<'all' | 'backlog' | string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [energyFilter, setEnergyFilter] = useState<'all' | TaskEnergy>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_asc');
  const sortSpec = SORTS.find((s) => s.value === sortKey) ?? SORTS[0];
  const tasksQuery = useTasks({
    workspace_id: workspaceId ?? undefined,
    limit: 200,
    // "All open" hides the archive (closed tasks), like the web app.
    archived: statusFilter === 'all' ? false : undefined,
    sprint_id: sprintFilter !== 'all' && sprintFilter !== 'backlog' ? sprintFilter : undefined,
    backlog: sprintFilter === 'backlog' ? true : undefined,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    energy: energyFilter === 'all' ? undefined : energyFilter,
    sort: sortSpec.sort,
    order: sortSpec.order,
  });
  const tasks = tasksQuery.data?.data ?? [];
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
      map[m.user_id] = displayName(m);
    });
    return map;
  }, [members]);

  const sprintNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (sprints ?? []).forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [sprints]);
  const openSprints = (sprints ?? []).filter(isOpenSprint);

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

      {openSprints.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All sprints" active={sprintFilter === 'all'} onPress={() => setSprintFilter('all')} />
          <Chip label="Backlog" active={sprintFilter === 'backlog'} onPress={() => setSprintFilter('backlog')} />
          {openSprints.map((s) => (
            <Chip
              key={s.id}
              label={`${s.name} ${s.done_count}/${s.task_count}`}
              active={sprintFilter === s.id}
              onPress={() => setSprintFilter(s.id)}
            />
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Any priority" active={priorityFilter === 'all'} onPress={() => setPriorityFilter('all')} />
        {LEVELS.map((l) => (
          <Chip key={`p-${l.value}`} label={`! ${l.label}`} active={priorityFilter === l.value} onPress={() => setPriorityFilter(l.value)} />
        ))}
        <Chip label="Any energy" active={energyFilter === 'all'} onPress={() => setEnergyFilter('all')} />
        {LEVELS.map((l) => (
          <Chip key={`e-${l.value}`} label={`^ ${l.label}`} active={energyFilter === l.value} onPress={() => setEnergyFilter(l.value)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SORTS.map((s) => (
          <Chip key={s.value} label={`↕ ${s.label}`} active={sortKey === s.value} onPress={() => setSortKey(s.value)} />
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
              sprintName={item.sprint_id ? sprintNameById[item.sprint_id] : undefined}
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
  sprintName,
  onPress,
}: {
  task: Task;
  projectName?: string;
  assigneeEmail?: string;
  sprintName?: string;
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
        {sprintName && <Badge label={`⟳ ${sprintName}`} color={colors.primary} />}
        {!isCompleted(task.status) && (task.blocked_by?.length ?? 0) > 0 && (
          <Badge label={`⛔ blocked by ${task.blocked_by?.length}`} color={colors.danger} />
        )}
        {(task.subtask_total ?? 0) > 0 && (
          <Badge label={`⤷ ${task.subtask_done ?? 0}/${task.subtask_total}`} color={colors.muted} />
        )}
        {task.recurrence && <Badge label={`↻ ${task.recurrence}`} color={colors.muted} />}
        {(task.logged_minutes ?? 0) > 0 && (
          <Badge label={`⏱ ${formatDuration(task.logged_minutes ?? 0)}`} color={colors.faint} />
        )}
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
