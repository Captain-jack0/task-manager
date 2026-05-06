import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import type {
  Task,
  TaskCreateInput,
  TaskListFilters,
  TaskListResponse,
  TaskUpdateInput,
} from '@/types/api';

export const TASKS_KEY = ['tasks'] as const;

export function useTasks(filters: TaskListFilters = {}) {
  return useQuery({
    queryKey: [...TASKS_KEY, filters],
    queryFn: () => tasksApi.list(filters),
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
    mutationFn: (input: TaskCreateInput) => tasksApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
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
      qc.setQueriesData<TaskListResponse>({ queryKey: TASKS_KEY }, (data) =>
        data
          ? {
              ...data,
              data: data.data.map((t) =>
                t.id === id ? { ...t, ...input, tags: t.tags } : t,
              ) as Task[],
            }
          : data,
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
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
        data
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
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
