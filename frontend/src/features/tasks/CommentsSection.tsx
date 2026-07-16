import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from '@/features/auth/authStore';
import { formatDate } from '@/lib/date';
import type { Member } from '@/types/api';
import { useComments, useCreateComment, useDeleteComment } from './useComments';

function renderBody(body: string): ReactNode[] {
  // Highlight @mentions (@ followed by non-space characters).
  return body.split(/(@[^\s]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium text-slate-900 dark:text-white">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface Props {
  taskId: string;
  members: Member[];
}

export function CommentsSection({ taskId, members }: Props) {
  const [body, setBody] = useState('');
  const currentUser = useAuthStore((s) => s.user);
  const { data: comments } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const submit = () => {
    if (!body.trim()) return;
    createComment.mutate(body.trim(), {
      onSuccess: () => setBody(''),
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not post comment')),
    });
  };

  const insertMention = (email: string) =>
    setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}@${email} `);

  return (
    <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">Comments</h2>

      <div className="space-y-3">
        {(comments ?? []).map((c) => (
          <div key={c.id} className="group flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {c.author_email[0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {c.author_email}
                </span>
                <span>{formatDate(c.created_at)}</span>
                {currentUser?.id === c.author_id && (
                  <button
                    type="button"
                    onClick={() => deleteComment.mutate(c.id)}
                    className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
                  >
                    delete
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">
                {renderBody(c.body)}
              </p>
            </div>
          </div>
        ))}
        {(comments ?? []).length === 0 && (
          <p className="text-sm text-slate-400">No comments yet.</p>
        )}
      </div>

      <div className="mt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Write a comment… use @ to mention"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
        />
        {members.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {members.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => insertMention(m.email)}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                @{m.email}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submit} isLoading={createComment.isPending} disabled={!body.trim()}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
