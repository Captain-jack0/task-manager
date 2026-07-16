export type TaskStatus = 'todo' | 'in_progress' | 'done';
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

export interface WorkspaceCreateInput {
  name: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
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
  snooze_count: number;
  tags: Tag[];
  created_at: string;
  updated_at: string;
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
  tag_ids?: string[];
}

export type TaskUpdateInput = Partial<TaskCreateInput>;

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
  search?: string;
  page?: number;
  limit?: number;
}
