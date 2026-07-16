import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../api/tasks';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type {
  SuggestParams,
  TaskCreateInput,
  TaskListFilters,
  TaskUpdateInput,
} from '../../types/api';

export const TASKS_KEY = 'tasks';

export function useTasks(filters: TaskListFilters = {}) {
  return useQuery({
    queryKey: [TASKS_KEY, filters],
    queryFn: () => tasksApi.list(filters),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: [TASKS_KEY, 'detail', id],
    queryFn: () => tasksApi.get(id),
  });
}

export function useSuggest(params: SuggestParams, enabled: boolean) {
  return useQuery({
    queryKey: ['suggest', params],
    queryFn: () => tasksApi.suggest(params),
    enabled,
  });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [TASKS_KEY] });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: (input: TaskCreateInput) => tasksApi.create(input, workspaceId),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskUpdateInput }) =>
      tasksApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useSnooze() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.snooze(id),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: invalidate,
  });
}
