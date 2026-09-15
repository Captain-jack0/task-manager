import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { isTypingTarget, useTaskShortcuts, type ShortcutHandlers } from '@/features/tasks/useTaskShortcuts';

const handlers = (): ShortcutHandlers => ({
  onNew: vi.fn(),
  onSearch: vi.fn(),
  onHelp: vi.fn(),
  onToggleView: vi.fn(),
  onMove: vi.fn(),
  onOpen: vi.fn(),
  onStatus: vi.fn(),
  onToggleSelect: vi.fn(),
  onEscape: vi.fn(),
});

describe('useTaskShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('maps keys to handlers when nothing is focused', () => {
    const h = handlers();
    renderHook(() => useTaskShortcuts(h));
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'k' });
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'x' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.onNew).toHaveBeenCalledTimes(1);
    expect(h.onMove).toHaveBeenNthCalledWith(1, 1);
    expect(h.onMove).toHaveBeenNthCalledWith(2, -1);
    expect(h.onStatus).toHaveBeenCalledWith(2);
    expect(h.onToggleSelect).toHaveBeenCalledTimes(1);
    expect(h.onEscape).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way while typing or holding a modifier', () => {
    const h = handlers();
    renderHook(() => useTaskShortcuts(h));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n' });
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(h.onNew).not.toHaveBeenCalled();
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.body)).toBe(false);
  });

  it('is silent while a dialog is open and leaves Escape to the dialog', () => {
    const h = handlers();
    renderHook(() => useTaskShortcuts(h));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.onNew).not.toHaveBeenCalled();
    expect(h.onEscape).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const h = handlers();
    renderHook(() => useTaskShortcuts(h, false));
    fireEvent.keyDown(window, { key: 'n' });
    expect(h.onNew).not.toHaveBeenCalled();
  });
});
