// Shared helpers for the one-tap "Schedule" shortcuts on task cards.

/** ISO for `daysAhead` days from now at 17:00 local. */
export function scheduleIso(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

/** ISO (17:00 local) for a picked YYYY-MM-DD from a date input. */
export function dateStrToIso(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d, 17, 0, 0, 0).toISOString();
}
