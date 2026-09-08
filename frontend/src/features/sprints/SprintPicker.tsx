import type { Sprint } from '@/types/api';
import { cn } from '@/lib/cn';

interface Props {
  sprints: Sprint[];
  /** Current sprint id, or null for the backlog. */
  value: string | null;
  onChange: (sprintId: string | null) => void;
  className?: string;
}

/** One-click "move to sprint" control for cards — no edit form needed. */
export function SprintPicker({ sprints, value, onChange, className }: Props) {
  if (sprints.length === 0) return null;
  return (
    <select
      aria-label="Move to sprint"
      title="Move to sprint"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        'max-w-[9rem] cursor-pointer truncate rounded border border-slate-200 bg-transparent px-1 py-0.5 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:text-slate-400 dark:focus:ring-white/10',
        className,
      )}
    >
      <option value="">Backlog</option>
      {sprints.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
