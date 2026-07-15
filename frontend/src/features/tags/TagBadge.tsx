import type { Tag } from '@/types/api';
import { cn } from '@/lib/cn';

interface Props {
  tag: Tag;
  onRemove?: () => void;
  selected?: boolean;
  onClick?: () => void;
}

export function TagBadge({ tag, onRemove, selected, onClick }: Props) {
  const baseClass = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
    selected
      ? 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
  );

  const inner = (
    <>
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color ?? '#94a3b8' }}
      />
      <span>{tag.name}</span>
    </>
  );

  // When a remove control is needed, render as a wrapper span with two
  // independent buttons inside to avoid invalid nested-button DOM.
  if (onRemove) {
    return (
      <span className={cn(baseClass, 'pr-1.5')} data-testid="tag-badge">
        {onClick ? (
          <button type="button" onClick={onClick} className="flex items-center gap-1.5">
            {inner}
          </button>
        ) : (
          <span className="flex items-center gap-1.5">{inner}</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
          aria-label={`Remove ${tag.name}`}
        >
          ×
        </button>
      </span>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClass, 'cursor-pointer')}
        data-testid="tag-badge"
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={baseClass} data-testid="tag-badge">
      {inner}
    </span>
  );
}
