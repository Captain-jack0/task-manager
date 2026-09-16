import { describe, it, expect } from 'vitest';
import { formatClock, formatDuration } from '@/features/time/useTime';
import { weekStart } from '@/features/time/TimeReportPage';

describe('time formatting', () => {
  it('formats durations in minutes and hours', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(135)).toBe('2h 15m');
  });

  it('formats a running clock', () => {
    expect(formatClock(5)).toBe('00:05');
    expect(formatClock(754)).toBe('12:34');
    expect(formatClock(3661)).toBe('1:01:01');
  });
});

describe('weekStart', () => {
  it('returns the Monday of the week, with offsets', () => {
    const wed = new Date(2026, 8, 16, 15, 0); // Wed 16 Sep 2026
    expect(weekStart(wed).toDateString()).toBe(new Date(2026, 8, 14).toDateString());
    const sun = new Date(2026, 8, 20);
    expect(weekStart(sun).toDateString()).toBe(new Date(2026, 8, 14).toDateString());
    expect(weekStart(wed, -1).toDateString()).toBe(new Date(2026, 8, 7).toDateString());
  });
});
