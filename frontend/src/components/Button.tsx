import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  // Monochrome primary — the minimalist accent is contrast, not colour.
  primary:
    'bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-400 disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400 disabled:opacity-40',
  ghost:
    'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300 dark:text-slate-300 dark:hover:bg-slate-800',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed dark:focus-visible:ring-offset-slate-950',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {isLoading ? 'Loading…' : children}
    </button>
  );
}
