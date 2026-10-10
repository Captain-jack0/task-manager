import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useLogout } from '@/features/auth/useAuth';
import { CalendarSubscribe } from '@/features/calendar/CalendarSubscribe';
import { GithubSettings } from '@/features/integrations/GithubSettings';
import { useGithubStatus } from '@/features/integrations/useGithub';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { RunningTimerIndicator } from '@/features/time/RunningTimerIndicator';
import { WorkspaceSwitcher } from '@/features/workspaces/WorkspaceSwitcher';
import { UserMenu } from './UserMenu';

const NAV = [
  ['/review', 'Review'],
  ['/time', 'Time'],
  ['/dashboard', 'Dashboard'],
] as const;

const NAV_LINK =
  'text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: github } = useGithubStatus();
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/tasks" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
              Tasks
            </Link>
            <nav aria-label="Main" className="hidden items-center gap-3 md:flex">
              {NAV.map(([to, label]) => (
                <Link key={to} to={to} className={NAV_LINK}>
                  {label}
                </Link>
              ))}
            </nav>
            <WorkspaceSwitcher />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <RunningTimerIndicator />
            <NotificationBell />
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              aria-label="Toggle dark mode"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {dark ? '☀' : '☾'}
            </button>
            {user && (
              <UserMenu
                user={user}
                githubConnected={github?.connected ?? false}
                onOpenCalendar={() => setCalendarOpen(true)}
                onOpenGithub={() => setGithubOpen(true)}
                onSignOut={logout}
              />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <CalendarSubscribe open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <GithubSettings open={githubOpen} onClose={() => setGithubOpen(false)} />
    </div>
  );
}
