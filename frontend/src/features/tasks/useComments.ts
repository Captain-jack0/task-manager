import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/api/comments';

const commentsKey = (taskId: string) => ['tasks', taskId, 'comments'];

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentsKey(taskId),
    queryFn: () => commentsApi.list(taskId),
    enabled: Boolean(taskId),
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => commentsApi.create(taskId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.remove(taskId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}
