import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '../../api/comments';
import type { Comment } from '../../types/api';

const key = (taskId: string) => ['comments', taskId] as const;

export function useComments(taskId: string) {
  return useQuery<Comment[]>({
    queryKey: key(taskId),
    queryFn: () => commentsApi.list(taskId),
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => commentsApi.create(taskId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.remove(taskId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(taskId) }),
  });
}
