import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attachmentsApi } from '@/api/attachments';
import { extractErrorMessage } from '@/api/client';
import { formatDate } from '@/lib/date';
import type { Attachment, Task } from '@/types/api';

const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.round((size / (1024 * 1024 * 1024)) * 100) / 100} GB`;
}

const uploaderLabel = (a: Attachment) => a.uploader_name?.trim() || a.uploader_email || 'someone';

/** Files on a task: upload (cap from the server), download through the API, delete. */
export function AttachmentsSection({ task }: { task: Task }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const key = ['tasks', 'attachments', task.id];
  const list = useQuery({ queryKey: key, queryFn: () => attachmentsApi.list(task.id) });
  const config = useQuery({ queryKey: ['attachments', 'config'], queryFn: attachmentsApi.config });
  const maxBytes = config.data?.max_bytes ?? DEFAULT_MAX_BYTES;
  const quota = config.data?.quota_bytes ?? 0;
  const used = config.data?.used_bytes ?? 0;
  const quotaLabel = quota > 0 ? ` · ${formatBytes(used)} of ${formatBytes(quota)} used` : '';

  const upload = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(task.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['tasks', 'activity', task.id] });
      qc.invalidateQueries({ queryKey: ['attachments', 'config'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Upload failed')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => attachmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['tasks', 'activity', task.id] });
      qc.invalidateQueries({ queryKey: ['attachments', 'config'] });
      toast.success('Attachment removed');
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Could not remove attachment')),
  });

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        toast.error(`${file.name} is larger than ${formatBytes(maxBytes)}`);
        continue;
      }
      upload.mutate(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const download = async (a: Attachment) => {
    setDownloading(a.id);
    try {
      const blob = await attachmentsApi.download(a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const items = list.data ?? [];

  return (
    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Attachments{items.length > 0 && <span className="ml-2 normal-case tracking-normal">{items.length}</span>}
        </h2>
        <label className="cursor-pointer text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          {upload.isPending ? 'Uploading…' : 'Add file'}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            disabled={upload.isPending}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No files yet. Up to {formatBytes(maxBytes)} each{quotaLabel}.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((a) => (
            <li key={a.id} className="group flex items-center gap-2 text-sm">
              <span aria-hidden className="w-5 text-center text-xs">
                {a.content_type.startsWith('image/') ? '🖼' : '📎'}
              </span>
              <button
                type="button"
                onClick={() => void download(a)}
                disabled={downloading === a.id}
                className="min-w-0 truncate text-left text-slate-700 hover:underline disabled:opacity-60 dark:text-slate-300"
                title={`Download ${a.filename}`}
              >
                {a.filename}
              </button>
              <span className="shrink-0 text-xs text-slate-400">
                {formatBytes(a.size)} · {uploaderLabel(a)} · {formatDate(a.created_at)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${a.filename}?`)) remove.mutate(a.id);
                }}
                aria-label={`Remove ${a.filename}`}
                className="ml-auto text-slate-400 opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
