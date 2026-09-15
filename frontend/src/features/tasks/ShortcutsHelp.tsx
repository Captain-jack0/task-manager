import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { SHORTCUTS } from './useTaskShortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" footer={<Button onClick={onClose}>Close</Button>}>
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between gap-4 py-2">
            <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {s.keys}
            </kbd>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-400">Shortcuts pause while you type in a field or a dialog is open.</p>
    </Modal>
  );
}
