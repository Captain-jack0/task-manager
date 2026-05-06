import { describe, it, expect } from 'vitest';
import { formatDate, isOverdue } from '@/lib/date';

describe('formatDate', () => {
  it('returns empty for null/undefined', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
  it('returns empty for invalid date string', () => {
    expect(formatDate('not a date')).toBe('');
  });
  it('formats a valid ISO string', () => {
    expect(formatDate('2026-01-15T00:00:00Z')).not.toBe('');
  });
});

describe('isOverdue', () => {
  it('returns false for null/empty', () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue('')).toBe(false);
  });
  it('returns true for past dates', () => {
    expect(isOverdue('2000-01-01T00:00:00Z')).toBe(true);
  });
  it('returns false for future dates', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isOverdue(future)).toBe(false);
  });
});
