import type { TaskEnergy, TaskPriority } from '../../types/api';

export interface ParsedQuickAdd {
  title: string;
  priority?: TaskPriority;
  energy?: TaskEnergy;
  estimated_minutes?: number;
  tagNames: string[];
  due_date?: string; // ISO
}

const PRIORITY: Record<string, TaskPriority> = {
  high: 'high',
  yüksek: 'high',
  yuksek: 'high',
  medium: 'medium',
  med: 'medium',
  orta: 'medium',
  low: 'low',
  düşük: 'low',
  dusuk: 'low',
};

const ENERGY: Record<string, TaskEnergy> = {
  high: 'high',
  yüksek: 'high',
  yuksek: 'high',
  medium: 'medium',
  med: 'medium',
  orta: 'medium',
  low: 'low',
  düşük: 'low',
  dusuk: 'low',
};

const WORD = '[A-Za-z0-9çğıöşüÇĞİÖŞÜ.+_-]+';

/**
 * Parse a natural-language quick-add string into task fields. Recognised
 * tokens: #tag, !priority, ^energy, ~duration (30 / 30m / 2h), today/tomorrow
 * (+ Turkish bugün/yarın), an ISO date (YYYY-MM-DD), and a HH:MM time. What's
 * left is the title. (Ported verbatim from the web app.)
 */
export function parseQuickAdd(input: string, now: Date = new Date()): ParsedQuickAdd {
  let text = ` ${input} `;
  const tagNames: string[] = [];
  let priority: TaskPriority | undefined;
  let energy: TaskEnergy | undefined;
  let estimated_minutes: number | undefined;

  // #tags (all)
  text = text.replace(new RegExp(`#(${WORD})`, 'gi'), (_m, name: string) => {
    if (!tagNames.some((t) => t.toLowerCase() === name.toLowerCase())) tagNames.push(name);
    return ' ';
  });

  // !priority (first valid)
  text = text.replace(new RegExp(`!(${WORD})`, 'gi'), (m, word: string) => {
    const p = PRIORITY[word.toLowerCase()];
    if (p && !priority) {
      priority = p;
      return ' ';
    }
    return m;
  });

  // ^energy (first valid)
  text = text.replace(new RegExp(`\\^(${WORD})`, 'gi'), (m, word: string) => {
    const e = ENERGY[word.toLowerCase()];
    if (e && !energy) {
      energy = e;
      return ' ';
    }
    return m;
  });

  // ~duration
  text = text.replace(
    /~(\d+)\s*(dakika|dak|dk|mins?|min|m|saat|sa|hrs?|hr|h)?/i,
    (_m, n: string, unit?: string) => {
      const value = Number(n);
      const u = (unit ?? '').toLowerCase();
      const hours = ['saat', 'sa', 'hrs', 'hr', 'h'].includes(u);
      estimated_minutes = hours ? value * 60 : value;
      return ' ';
    },
  );

  // date + time
  let dueDay: Date | undefined;
  let hh: number | undefined;
  let mm: number | undefined;

  text = text.replace(/\b(today|bug[üu]n)\b/i, () => {
    dueDay = new Date(now);
    return ' ';
  });
  text = text.replace(/\b(tomorrow|yar[ıi]n)\b/i, () => {
    dueDay = new Date(now);
    dueDay.setDate(dueDay.getDate() + 1);
    return ' ';
  });
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/, (_m, y: string, mo: string, d: string) => {
    dueDay = new Date(Number(y), Number(mo) - 1, Number(d));
    return ' ';
  });
  text = text.replace(/\b(\d{1,2}):(\d{2})\b/, (_m, h: string, min: string) => {
    const H = Number(h);
    const M = Number(min);
    if (H < 24 && M < 60) {
      hh = H;
      mm = M;
      return ' ';
    }
    return _m;
  });

  let due_date: string | undefined;
  if (dueDay || hh !== undefined) {
    const d = dueDay ? new Date(dueDay) : new Date(now);
    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
    due_date = d.toISOString();
  }

  const title = text.replace(/\s+/g, ' ').trim();

  return { title, priority, energy, estimated_minutes, tagNames, due_date };
}
