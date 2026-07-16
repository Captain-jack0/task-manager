import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { extractErrorMessage } from '@/api/client';
import { useCalendarSubscription, useRotateCalendarToken } from './useCalendar';

export function CalendarSubscribe() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useCalendarSubscription(open);
  const rotate = useRotateCalendarToken();
  const url = data?.url ?? '';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Feed URL copied');
    } catch {
      toast.error('Could not copy — select and copy the URL manually');
    }
  };

  const handleRotate = () => {
    if (!window.confirm('Generate a new link? Your current calendar subscription will stop updating.'))
      return;
    rotate.mutate(undefined, {
      onSuccess: () => toast.success('New calendar link generated'),
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not regenerate link')),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Calendar subscription"
        className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 sm:inline-flex sm:items-center sm:gap-1.5 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span aria-hidden>🗓</span>
        Calendar
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Calendar subscription">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Subscribe to this feed to see every task with a due date in Google Calendar, Apple
            Calendar or Outlook. It updates automatically — your calendar app refreshes it
            periodically.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Feed URL
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={isLoading ? 'Loading…' : url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              />
              <Button variant="secondary" size="sm" onClick={copy} disabled={!url}>
                Copy
              </Button>
            </div>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-500 dark:text-slate-400">
            <li>Open Google Calendar → Other calendars → “From URL”.</li>
            <li>Paste the feed URL above and add the calendar.</li>
          </ol>

          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Anyone with this link can see your task titles and due dates. Keep it private — if it
            leaks, regenerate it below.
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs text-slate-400">Link compromised?</span>
            <Button variant="danger" size="sm" onClick={handleRotate} isLoading={rotate.isPending}>
              Regenerate link
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
