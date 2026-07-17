// Maps a quick-pick due choice to an ISO datetime (or null for "no due date").
// Callers handle the "keep" choice (leave unchanged) before calling this.
export function dueToIso(choice: string): string | null {
  if (choice === 'none') return null;
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  if (choice === 'tomorrow') d.setDate(d.getDate() + 1);
  if (choice === 'week') d.setDate(d.getDate() + 7);
  return d.toISOString();
}
