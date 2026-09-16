export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'closed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskEnergy = 'low' | 'medium' | 'high';
export type TaskRecurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';
export type TaskSortField =
  | 'created_at'
  | 'updated_at'
  | 'due_date'
  | 'priority'
  | 'energy'
  | 'status'
  | 'title'
  | 'estimated_minutes';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  is_personal: boolean;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceCreateInput {
  name: string;
}

export interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: WorkspaceRole;
}

export interface AddMemberInput {
  email: string;
  role?: WorkspaceRole;
}

export interface Capacity {
  user_id: string;
  email: string;
  full_name: string | null;
  role: WorkspaceRole;
  open_task_count: number;
  estimated_minutes: number;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  author_email: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface ProjectCreateInput {
  name: string;
  color?: string | null;
}

export interface Sprint {
  id: string;
  workspace_id: string;
  name: string;
  goal: string | null;
  /** YYYY-MM-DD */
  start_date: string;
  end_date: string;
  /** ISO datetime once the sprint was completed; null while open. */
  closed_at: string | null;
  /** Unfinished tasks moved out when the sprint was completed. */
  carried_over: number;
  task_count: number;
  done_count: number;
  created_at: string;
}

export interface SprintCloseResult {
  sprint: Sprint;
  moved: number;
  kept: number;
}

export interface BurndownPoint {
  day: string;
  remaining: number | null;
  ideal: number;
}

export interface SprintReport {
  sprint: Sprint;
  by_status: Partial<Record<TaskStatus, number>>;
  total: number;
  finished: number;
  estimated_minutes: number;
  estimated_minutes_finished: number;
  burndown: BurndownPoint[];
}

export interface SprintCreateInput {
  name: string;
  goal?: string | null;
  start_date: string;
  end_date: string;
}

export type SprintUpdateInput = Partial<SprintCreateInput>;

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

/** The other end of a task link. */
export interface TaskRef {
  link_id: string;
  id: string;
  title: string;
  status: TaskStatus;
}

export type TaskLinkKind = 'blocks' | 'blocked_by' | 'relates';

export interface TaskParentRef {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskLinkInput {
  target_id: string;
  kind: TaskLinkKind;
}

export interface Task {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_minutes: number | null;
  energy_level: TaskEnergy | null;
  recurrence: TaskRecurrence | null;
  project_id: string | null;
  assignee_id: string | null;
  sprint_id: string | null;
  snooze_count: number;
  github_issue_url: string | null;
  github_issue_number: number | null;
  tags: Tag[];
  blocked_by: TaskRef[];
  blocks: TaskRef[];
  related: TaskRef[];
  parent_id: string | null;
  parent: TaskParentRef | null;
  subtask_total: number;
  subtask_done: number;
  logged_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface GithubStatus {
  connected: boolean;
  repo: string | null;
}

export interface GithubRepo {
  name: string;
  full_name: string;
}

export interface CalendarSubscription {
  url: string;
  token: string;
}

export interface GithubConnectInput {
  token: string;
  repo: string;
}

export interface ProfileUpdateInput {
  full_name: string | null;
}

export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  started_at: string;
  ended_at: string | null;
  minutes: number;
  note: string | null;
}

export interface TimeEntryCreateInput {
  started_at: string;
  ended_at: string;
  note?: string | null;
}

export interface TaskTime {
  entries: TimeEntry[];
  total_minutes: number;
  running: TimeEntry | null;
}

export interface RunningTimer {
  entry: TimeEntry;
  task_title: string;
}

export interface TimeReportRow {
  task_id: string;
  task_title: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  minutes: number;
}

export interface TimeReport {
  start_at: string;
  end_at: string;
  rows: TimeReportRow[];
  total_minutes: number;
}

export interface DashboardDay {
  day: string;
  completed: number;
  created: number;
}

export interface DashboardPerson {
  user_id: string;
  email: string;
  full_name: string | null;
  open: number;
  overdue: number;
  completed: number;
  estimated_open_minutes: number;
  logged_minutes: number;
}

export interface Dashboard {
  days: number;
  open: number;
  overdue: number;
  completed: number;
  created: number;
  by_status: Partial<Record<TaskStatus, number>>;
  per_day: DashboardDay[];
  people: DashboardPerson[];
  active_sprint: { id: string; name: string; end_date: string; total: number; finished: number } | null;
}

export interface AttachmentConfig {
  max_bytes: number;
}

export interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  content_type: string;
  size: number;
  uploader_id: string | null;
  uploader_email: string | null;
  uploader_name: string | null;
  created_at: string;
}

export interface TaskEvent {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor: { id: string; email: string; full_name: string | null } | null;
  created_at: string;
}

export type NotificationKind = 'assigned' | 'comment' | 'mention';

export interface Notification {
  id: string;
  kind: NotificationKind;
  message: string;
  task_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TaskListResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  energy_level?: TaskEnergy | null;
  recurrence?: TaskRecurrence | null;
  project_id?: string | null;
  assignee_id?: string | null;
  sprint_id?: string | null;
  parent_id?: string | null;
  tag_ids?: string[];
}

export type TaskUpdateInput = Partial<TaskCreateInput>;

/** One change applied to many tasks. `sprint_id: null` = backlog. */
export interface TaskBulkChanges {
  status?: TaskStatus;
  priority?: TaskPriority;
  sprint_id?: string | null;
  project_id?: string | null;
  assignee_id?: string | null;
  add_tag_ids?: string[];
}

export interface BulkResult {
  count: number;
}

export interface TaskSuggestion {
  task: Task;
  score: number;
  reason: string;
}

export interface SuggestResponse {
  suggestions: TaskSuggestion[];
}

export interface SuggestParams {
  workspace_id?: string;
  minutes?: number;
  energy?: TaskEnergy;
  limit?: number;
}

export interface TagCreateInput {
  name: string;
  color?: string | null;
}

export type TagUpdateInput = Partial<TagCreateInput>;

export interface TaskListFilters {
  workspace_id?: string;
  status?: TaskStatus;
  tag_id?: string;
  project_id?: string;
  assignee_id?: string;
  unassigned?: boolean;
  sprint_id?: string;
  backlog?: boolean;
  /** false = hide closed tasks (the archive), true = only closed. */
  archived?: boolean;
  parent_id?: string;
  priority?: TaskPriority;
  energy?: TaskEnergy;
  due_before?: string;
  due_after?: string;
  has_due_date?: boolean;
  max_minutes?: number;
  search?: string;
  sort?: TaskSortField;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
