import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onNew: () => void;
  onSearch: () => void;
  onHelp: () => void;
  onToggleView: () => void;
  /** j / k */
  onMove: (delta: 1 | -1) => void;
  /** Enter on the highlighted card */
  onOpen: () => void;
  /** 1–5 → index into STATUS_ORDER */
  onStatus: (index: number) => void;
  /** x */
  onToggleSelect: () => void;
  /** Esc with no dialog open */
  onEscape: () => void;
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'n', label: 'New task' },
  { keys: '/', label: 'Focus search' },
  { keys: 'v', label: 'Switch list / board' },
  { keys: 'j / k', label: 'Highlight next / previous card' },
  { keys: 'Enter', label: 'Open the highlighted task' },
  { keys: '1 – 5', label: 'Set its status: To do, In progress, Blocked, Done (Test), Closed' },
  { keys: 'x', label: 'Select / deselect it (bulk actions)' },
  { keys: 'Esc', label: 'Clear highlight and selection' },
  { keys: '?', label: 'Show this help' },
];

/** True when the key press belongs to a text field, so shortcuts must stay out of the way. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target.isContentEditable);
}

/** Global single-key shortcuts for the task list. Inactive inside inputs and open dialogs. */
export function useTaskShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  // Handlers change every render; keep the latest without re-registering the listener.
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const dialogOpen = document.querySelector('[role="dialog"]') !== null;
      const h = ref.current;
      if (e.key === 'Escape') {
        // A dialog handles its own Escape; ours only clears the page state.
        if (!dialogOpen && !isTypingTarget(e.target)) h.onEscape();
        return;
      }
      if (dialogOpen || isTypingTarget(e.target)) return;
      switch (e.key) {
        case 'n':
          e.preventDefault();
          h.onNew();
          break;
        case '/':
          e.preventDefault();
          h.onSearch();
          break;
        case '?':
          h.onHelp();
          break;
        case 'v':
          h.onToggleView();
          break;
        case 'j':
          h.onMove(1);
          break;
        case 'k':
          h.onMove(-1);
          break;
        case 'Enter':
          h.onOpen();
          break;
        case 'x':
          h.onToggleSelect();
          break;
        default:
          if (/^[1-5]$/.test(e.key)) h.onStatus(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
