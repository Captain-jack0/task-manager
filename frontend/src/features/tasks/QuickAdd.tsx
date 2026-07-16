import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { useCreateTag, useTags } from '@/features/tags/useTags';
import { formatDate } from '@/lib/date';
import { parseQuickAdd } from './quickParse';
import { useCreateTask } from './useTasks';

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

function dueLabel(iso: string): string {
  const d = new Date(iso);
  const time =
    d.getHours() || d.getMinutes()
      ? ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      : '';
  return `${formatDate(iso)}${time}`;
}

export function QuickAdd() {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const createTask = useCreateTask();

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const hasMeta =
    !!parsed.priority ||
    !!parsed.energy ||
    parsed.estimated_minutes != null ||
    !!parsed.due_date ||
    parsed.tagNames.length > 0;

  const submit = async () => {
    if (!parsed.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const tagIds: string[] = [];
      for (const name of parsed.tagNames) {
        const existing = (tags ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (existing) tagIds.push(existing.id);
        else {
          const created = await createTag.mutateAsync({ name });
          tagIds.push(created.id);
        }
      }
      await createTask.mutateAsync({
        title: parsed.title,
        priority: parsed.priority,
        energy_level: parsed.energy ?? null,
        estimated_minutes: parsed.estimated_minutes ?? null,
        due_date: parsed.due_date ?? null,
        tag_ids: tagIds,
      });
      toast.success('Task added');
      setText('');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not add task'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          aria-label="Quick add task"
          placeholder="Quick add — e.g. Call doctor tomorrow 15:00 #health !high ~30m"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          className="flex-1"
        />
        <Button onClick={() => void submit()} isLoading={submitting} disabled={!parsed.title.trim()}>
          Add
        </Button>
      </div>
      {text.trim() && hasMeta && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">{parsed.title || '(no title)'}</span>
          {parsed.due_date && <Chip>📅 {dueLabel(parsed.due_date)}</Chip>}
          {parsed.priority && <Chip>! {parsed.priority}</Chip>}
          {parsed.energy && <Chip>^ {parsed.energy} energy</Chip>}
          {parsed.estimated_minutes != null && <Chip>~{parsed.estimated_minutes}m</Chip>}
          {parsed.tagNames.map((t) => (
            <Chip key={t}>#{t}</Chip>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-slate-400">
        Syntax: <span className="font-medium">#tag</span> ·{' '}
        <span className="font-medium">!priority</span> ·{' '}
        <span className="font-medium">^energy</span> · <span className="font-medium">~30m</span> ·{' '}
        <span className="font-medium">tomorrow</span> · <span className="font-medium">15:00</span>
      </p>
    </div>
  );
}
