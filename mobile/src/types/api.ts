// Ported from the web frontend — the backend contract is identical.
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'closed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskEnergy = 'low' | 'medium' | 'high';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  is_personal: boolean;
  role: WorkspaceRole;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Member {
  user_id: string;
  email: string;
  role: WorkspaceRole;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  author_email: string;
  body: string;
  created_at: string;
}

export interface ProjectCreateInput {
  name: string;
  color?: string | null;
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
  project_id: string | null;
  assignee_id: string | null;
  snooze_count: number;
  github_issue_url: string | null;
  github_issue_number: number | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface CalendarSubscription {
  url: string;
  token: string;
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
  project_id?: string | null;
  assignee_id?: string | null;
}

export type TaskUpdateInput = Partial<TaskCreateInput>;

export interface TaskListFilters {
  workspace_id?: string;
  status?: TaskStatus;
  project_id?: string;
  search?: string;
  page?: number;
  limit?: number;
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
