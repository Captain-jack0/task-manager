import { useState } from 'react';
import { Link } from 'react-router-dom';
import { displayName, initial } from '@/lib/people';

interface Props {
  user: { email: string; full_name?: string | null };
  githubConnected: boolean;
  onOpenCalendar: () => void;
  onOpenGithub: () => void;
  onSignOut: () => void;
}

const ITEM =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';

/** Avatar + name in the header. Opens profile settings, the integrations and sign-out,
 *  so the header itself stays to one row. */
export function UserMenu({ user, githubConnected, onOpenCalendar, onOpenGithub, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {initial(user)}
        </span>
        <span data-testid="user-name" className="hidden max-w-[10rem] truncate md:inline">
          {displayName(user)}
        </span>
        <span aria-hidden className="text-[10px] text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{displayName(user)}</p>
              {user.full_name?.trim() && <p className="truncate text-xs text-slate-500">{user.email}</p>}
            </div>
            <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className={ITEM}>
              Profile settings
            </Link>
            <button role="menuitem" type="button" onClick={pick(onOpenCalendar)} className={ITEM}>
              <span aria-hidden>🗓</span> Calendar feed
            </button>
            <button role="menuitem" type="button" onClick={pick(onOpenGithub)} className={ITEM}>
              <span aria-hidden className={githubConnected ? 'text-emerald-500' : 'text-slate-400'}>
                ●
              </span>{' '}
              GitHub integration
            </button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button
              role="menuitem"
              type="button"
              onClick={pick(onSignOut)}
              className={`${ITEM} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
