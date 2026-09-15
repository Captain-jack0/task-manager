import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { Notification } from '@/types/api';
import { useMarkAllRead, useMarkRead, useNotifications } from './useNotifications';

const KIND_ICON: Record<Notification['kind'], string> = {
  assigned: '👤',
  comment: '💬',
  mention: '@',
};

/** Header bell with an unread badge and a dropdown of the latest notifications. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const openItem = (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    setOpen(false);
    if (n.task_id) navigate(`/tasks/${n.task_id}`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        🔔
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nothing yet.</li>}
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800',
                      !n.read_at && 'bg-slate-50/70 dark:bg-slate-800/40',
                    )}
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-center text-xs" aria-hidden>
                      {KIND_ICON[n.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block leading-snug', !n.read_at && 'font-medium')}>{n.message}</span>
                      <span className="block text-xs text-slate-400">{formatDate(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
