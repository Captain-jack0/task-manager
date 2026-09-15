import { Button } from '@/components/Button';
import { displayName } from '@/lib/people';
import type { Member, Project, Sprint, Tag, TaskBulkChanges, TaskPriority, TaskStatus } from '@/types/api';
import { STATUS_LABEL, STATUS_ORDER } from './status';

interface Props {
  count: number;
  sprints: Sprint[];
  projects: Project[];
  members: Member[];
  tags: Tag[];
  pending: boolean;
  onApply: (changes: TaskBulkChanges) => void;
  onDelete: () => void;
  onClear: () => void;
}

const SELECT =
  'cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs text-slate-700 transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-600 dark:focus:ring-white/10';

/** Floating bar shown while cards are selected; each select applies straight away. */
export function BulkActionBar({ count, sprints, projects, members, tags, pending, onApply, onDelete, onClear }: Props) {
  // Every select is "reset" (value "") so the same action can be picked twice.
  const pick = (e: React.ChangeEvent<HTMLSelectElement>, build: (v: string) => TaskBulkChanges) => {
    const v = e.target.value;
    if (!v) return;
    onApply(build(v));
    e.target.value = '';
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <span className="mr-1 text-sm font-medium text-slate-900 dark:text-white">
        {count} selected
      </span>

      <select aria-label="Set status" className={SELECT} value="" disabled={pending} onChange={(e) => pick(e, (v) => ({ status: v as TaskStatus }))}>
        <option value="">Status…</option>
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <select aria-label="Set priority" className={SELECT} value="" disabled={pending} onChange={(e) => pick(e, (v) => ({ priority: v as TaskPriority }))}>
        <option value="">Priority…</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select
        aria-label="Move to sprint"
        className={SELECT}
        value=""
        disabled={pending}
        onChange={(e) => pick(e, (v) => ({ sprint_id: v === 'backlog' ? null : v }))}
      >
        <option value="">Sprint…</option>
        <option value="backlog">Backlog</option>
        {sprints
          .filter((s) => s.closed_at === null)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>

      <select
        aria-label="Set project"
        className={SELECT}
        value=""
        disabled={pending}
        onChange={(e) => pick(e, (v) => ({ project_id: v === 'none' ? null : v }))}
      >
        <option value="">Project…</option>
        <option value="none">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Assign to"
        className={SELECT}
        value=""
        disabled={pending}
        onChange={(e) => pick(e, (v) => ({ assignee_id: v === 'none' ? null : v }))}
      >
        <option value="">Assign…</option>
        <option value="none">Unassigned</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {displayName(m)}
          </option>
        ))}
      </select>

      {tags.length > 0 && (
        <select aria-label="Add tag" className={SELECT} value="" disabled={pending} onChange={(e) => pick(e, (v) => ({ add_tag_ids: [v] }))}>
          <option value="">Add tag…</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.name}
            </option>
          ))}
        </select>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="danger" size="sm" onClick={onDelete} disabled={pending}>
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={pending}>
          Clear
        </Button>
      </div>
    </div>
  );
}
