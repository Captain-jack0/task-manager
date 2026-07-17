import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          className={cn(
            'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:border-slate-600 dark:focus:ring-white/10',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-500/10',
            className,
          )}
        />
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : (
          hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
