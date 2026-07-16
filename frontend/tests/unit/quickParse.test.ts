import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '@/features/tasks/quickParse';

const NOW = new Date(2026, 6, 16, 10, 0, 0); // Thu 16 Jul 2026, 10:00 local

describe('parseQuickAdd', () => {
  it('keeps a plain title untouched', () => {
    const r = parseQuickAdd('Call the dentist', NOW);
    expect(r.title).toBe('Call the dentist');
    expect(r.priority).toBeUndefined();
    expect(r.tagNames).toEqual([]);
    expect(r.due_date).toBeUndefined();
  });

  it('extracts priority (en + tr) and strips it from the title', () => {
    expect(parseQuickAdd('Fix bug !high', NOW).priority).toBe('high');
    const r = parseQuickAdd('Doktoru ara !yüksek', NOW);
    expect(r.priority).toBe('high');
    expect(r.title).toBe('Doktoru ara');
  });

  it('extracts tags and energy', () => {
    const r = parseQuickAdd('Buy milk #home #shopping ^low', NOW);
    expect(r.tagNames).toEqual(['home', 'shopping']);
    expect(r.energy).toBe('low');
    expect(r.title).toBe('Buy milk');
  });

  it('parses duration in minutes and hours', () => {
    expect(parseQuickAdd('Write report ~30m', NOW).estimated_minutes).toBe(30);
    expect(parseQuickAdd('Deep work ~2h', NOW).estimated_minutes).toBe(120);
    expect(parseQuickAdd('Quick task ~45', NOW).estimated_minutes).toBe(45);
  });

  it('parses tomorrow + time (tr) into a due date', () => {
    const r = parseQuickAdd('Doktoru ara yarın 15:00', NOW);
    expect(r.title).toBe('Doktoru ara');
    const due = new Date(r.due_date as string);
    expect(due.getDate()).toBe(17);
    expect(due.getHours()).toBe(15);
    expect(due.getMinutes()).toBe(0);
  });

  it('parses an ISO date', () => {
    const r = parseQuickAdd('Ship release 2026-08-01', NOW);
    const due = new Date(r.due_date as string);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7); // August
    expect(due.getDate()).toBe(1);
    expect(r.title).toBe('Ship release');
  });

  it('handles a fully-loaded input', () => {
    const r = parseQuickAdd('Call doctor yarın 15:00 #health !high ~30m', NOW);
    expect(r.title).toBe('Call doctor');
    expect(r.priority).toBe('high');
    expect(r.estimated_minutes).toBe(30);
    expect(r.tagNames).toEqual(['health']);
    expect(new Date(r.due_date as string).getHours()).toBe(15);
  });
});
