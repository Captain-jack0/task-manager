import { Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { useAuthStore } from '@/features/auth/authStore';
import { useLogout } from '@/features/auth/useAuth';

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
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/tasks" className="text-lg font-bold">
            Task Manager
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              aria-label="Toggle dark mode"
              className="rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {user && (
              <span className="hidden text-sm text-slate-500 sm:inline" data-testid="user-email">
                {user.email}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
