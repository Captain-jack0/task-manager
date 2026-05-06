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
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
    selected
      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-700/20 dark:text-brand-100'
      : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  );
  const style = tag.color ? { borderColor: tag.color, color: tag.color } : undefined;

  const inner = (
    <>
      <span aria-hidden>{tag.color ? '●' : '#'}</span>
      <span>{tag.name}</span>
    </>
  );

  // When a remove control is needed, render as a wrapper span with two
  // independent buttons inside to avoid invalid nested-button DOM.
  if (onRemove) {
    return (
      <span className={cn(baseClass, 'pr-1.5')} style={style} data-testid="tag-badge">
        {onClick ? (
          <button type="button" onClick={onClick} className="flex items-center gap-1">
            {inner}
          </button>
        ) : (
          <span className="flex items-center gap-1">{inner}</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 text-slate-500 hover:text-red-600"
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
        style={style}
        data-testid="tag-badge"
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={baseClass} style={style} data-testid="tag-badge">
      {inner}
    </span>
  );
}
