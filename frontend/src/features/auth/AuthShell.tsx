import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Centered card shared by every unauthenticated screen (login, register, reset). */
export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-2 px-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
        <span className="font-semibold tracking-tight">Tasks</span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
