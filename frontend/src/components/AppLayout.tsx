import { Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { useAuthStore } from '@/features/auth/authStore';
import { useLogout } from '@/features/auth/useAuth';
import { WorkspaceSwitcher } from '@/features/workspaces/WorkspaceSwitcher';
import { GithubSettings } from '@/features/integrations/GithubSettings';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem('theme') === 'dark',
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/tasks" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
              Tasks
            </Link>
            <Link
              to="/review"
              className="hidden text-sm text-slate-500 transition-colors hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:text-white"
            >
              Review
            </Link>
            <WorkspaceSwitcher />
          </div>
          <div className="flex items-center gap-2">
            <GithubSettings />
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              aria-label="Toggle dark mode"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {dark ? '☀' : '☾'}
            </button>
            {user && (
              <span
                className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400"
                data-testid="user-email"
              >
                {user.email}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
