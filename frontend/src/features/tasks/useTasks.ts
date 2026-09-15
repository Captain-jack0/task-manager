import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import type {
  SuggestParams,
  Task,
  TaskBulkChanges,
  TaskCreateInput,
  TaskLinkInput,
  TaskListFilters,
  TaskListResponse,
  TaskUpdateInput,
} from '@/types/api';

export const TASKS_KEY = ['tasks'] as const;

export function useSuggest() {
  return useMutation({
    mutationFn: (params: SuggestParams) => tasksApi.suggest(params),
  });
}

export function useSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.snooze(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useCreateGithubIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.createGithubIssue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useSyncGithubIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.syncGithubIssue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

const invalidateAfterBulk = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: TASKS_KEY });
  qc.invalidateQueries({ queryKey: ['sprints'] });
};

export function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, changes }: { ids: string[]; changes: TaskBulkChanges }) =>
      tasksApi.bulkUpdate(ids, changes),
    onSuccess: () => invalidateAfterBulk(qc),
  });
}

export function useBulkDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => tasksApi.bulkDelete(ids),
    onSuccess: () => invalidateAfterBulk(qc),
  });
}

export function useAddTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskLinkInput }) => tasksApi.addLink(id, input),
    // Linking can change the other task's status too, so refresh every task query.
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useRemoveTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, linkId }: { id: string; linkId: string }) => tasksApi.removeLink(id, linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useResetSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.resetSnooze(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useTasks(filters: TaskListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [...TASKS_KEY, filters],
    queryFn: () => tasksApi.list(filters),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'detail', id],
    queryFn: () => tasksApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateInput) =>
      tasksApi.create(input, useWorkspaceStore.getState().currentWorkspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      // Sprint progress counts live on the sprint list.
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskUpdateInput }) =>
      tasksApi.update(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const snapshot = qc.getQueriesData<TaskListResponse>({ queryKey: TASKS_KEY });
      // TASKS_KEY matches both list queries (data: Task[]) and the single-task
      // detail query (a Task). Patch both optimistically so a follow-up edit
      // (e.g. ticking two checklist boxes quickly) builds on the latest text.
      qc.setQueriesData<TaskListResponse | Task>({ queryKey: TASKS_KEY }, (data) => {
        if (!data) return data;
        if ('data' in data && Array.isArray(data.data)) {
          return {
            ...data,
            data: data.data.map((t) => (t.id === id ? { ...t, ...input, tags: t.tags } : t)) as Task[],
          };
        }
        if ('id' in data && data.id === id) return { ...data, ...input, tags: data.tags } as Task;
        return data;
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const snapshot = qc.getQueriesData<TaskListResponse>({ queryKey: TASKS_KEY });
      qc.setQueriesData<TaskListResponse>({ queryKey: TASKS_KEY }, (data) =>
        data && Array.isArray(data.data)
          ? {
              ...data,
              data: data.data.filter((t) => t.id !== id),
              total: Math.max(0, data.total - 1),
            }
          : data,
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}
