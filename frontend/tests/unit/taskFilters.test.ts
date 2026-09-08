import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_FILTERS,
  hasActiveFilters,
  toQuery,
} from '@/features/tasks/taskFilters';

const NOW = new Date(2026, 8, 8, 15, 30); // Tue 8 Sep 2026, 15:30 local

describe('toQuery', () => {
  it('sends only sort/order by default', () => {
    const q = toQuery(DEFAULT_TASK_FILTERS, NOW);
    expect(Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined))).toEqual({
      sort: 'created_at',
      order: 'desc',
    });
    expect(hasActiveFilters(DEFAULT_TASK_FILTERS)).toBe(false);
  });

  it('maps field filters to API params', () => {
    const q = toQuery(
      { ...DEFAULT_TASK_FILTERS, priority: 'high', energy: 'low', assignee: 'u1', maxMinutes: '30' },
      NOW,
    );
    expect(q.priority).toBe('high');
    expect(q.energy).toBe('low');
    expect(q.assignee_id).toBe('u1');
    expect(q.unassigned).toBeUndefined();
    expect(q.max_minutes).toBe(30);
  });

  it('maps "unassigned" to the boolean flag, not an id', () => {
    const q = toQuery({ ...DEFAULT_TASK_FILTERS, assignee: 'none' }, NOW);
    expect(q.assignee_id).toBeUndefined();
    expect(q.unassigned).toBe(true);
  });

  it('turns due presets into date ranges', () => {
    expect(toQuery({ ...DEFAULT_TASK_FILTERS, due: 'overdue' }, NOW).due_before).toBe(
      NOW.toISOString(),
    );
    const today = toQuery({ ...DEFAULT_TASK_FILTERS, due: 'today' }, NOW);
    expect(today.due_after).toBe(new Date(2026, 8, 8).toISOString());
    expect(today.due_before).toBe(new Date(2026, 8, 9).toISOString());
    const week = toQuery({ ...DEFAULT_TASK_FILTERS, due: 'week' }, NOW);
    expect(week.due_before).toBe(new Date(2026, 8, 15).toISOString());
    expect(toQuery({ ...DEFAULT_TASK_FILTERS, due: 'none' }, NOW)).toMatchObject({
      has_due_date: false,
    });
  });
});
