import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from '../../api/tags';
import type { Tag, TagCreateInput } from '../../types/api';

const TAGS_KEY = ['tags'] as const;

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: TAGS_KEY,
    queryFn: () => tagsApi.list(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TagCreateInput) => tagsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: TAGS_KEY }),
  });
}
