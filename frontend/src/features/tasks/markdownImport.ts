import type { TaskEnergy, TaskPriority, TaskStatus } from '@/types/api';
import { ENERGY, PRIORITY } from './quickParse';

/**
 * Bulk-import format: one block per task, fields as `**Key:** value`, several
 * per line separated by ` · `. Mirrors the task form field by field, so a
 * document written for humans can be pasted in as-is.
 */
export const TASK_TEMPLATE = `### T01 · Kısa ad
**Title:** Görev başlığı
**Description:** Ne yapılacak, kabul kriteri ne. Bir sonraki satır da açıklamaya eklenir.
**Status:** To do · **Priority:** Medium · **Due date:** 31.12.2026
**Project:** Proje adı · **Sprint:** Sprint 1 · **Assignee:** Unassigned · **Energy:** Medium · **Est. minutes:** 60
**Tags:** etiket1, etiket2

### T02 · İkinci görev
**Title:** İkinci görevin başlığı
**Description:** "-" bırakılan alanlar boş kalır; Status ve Priority yazılmazsa To do / Medium olur.
**Status:** To do · **Priority:** High · **Due date:** -
**Project:** - · **Sprint:** - · **Assignee:** ornek@mail.com · **Energy:** - · **Est. minutes:** 30
**Tags:** etiket1
`;

export interface ParsedTask {
  line: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  projectName: string | null;
  sprintName: string | null;
  assignee: string | null;
  energy: TaskEnergy | null;
  estimated_minutes: number | null;
  tagNames: string[];
  warnings: string[];
}

export interface ParseResult {
  tasks: ParsedTask[];
  errors: string[];
}

type FieldKey =
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'due_date'
  | 'project'
  | 'sprint'
  | 'assignee'
  | 'energy'
  | 'estimated_minutes'
  | 'tags';

const KEYS: Record<string, FieldKey> = {
  title: 'title',
  başlık: 'title',
  baslik: 'title',
  description: 'description',
  açıklama: 'description',
  aciklama: 'description',
  status: 'status',
  durum: 'status',
  priority: 'priority',
  öncelik: 'priority',
  oncelik: 'priority',
  'due date': 'due_date',
  due: 'due_date',
  deadline: 'due_date',
  bitiş: 'due_date',
  bitis: 'due_date',
  'bitiş tarihi': 'due_date',
  tarih: 'due_date',
  project: 'project',
  proje: 'project',
  sprint: 'sprint',
  'sprint adı': 'sprint',
  assignee: 'assignee',
  atanan: 'assignee',
  sorumlu: 'assignee',
  energy: 'energy',
  enerji: 'energy',
  'est. minutes': 'estimated_minutes',
  'est minutes': 'estimated_minutes',
  estimate: 'estimated_minutes',
  minutes: 'estimated_minutes',
  süre: 'estimated_minutes',
  sure: 'estimated_minutes',
  dakika: 'estimated_minutes',
  tags: 'tags',
  tag: 'tags',
  etiketler: 'tags',
  etiket: 'tags',
};

const STATUS: Record<string, TaskStatus> = {
  'to do': 'todo',
  todo: 'todo',
  open: 'todo',
  yapılacak: 'todo',
  yapilacak: 'todo',
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  doing: 'in_progress',
  'devam ediyor': 'in_progress',
  devam: 'in_progress',
  blocked: 'blocked',
  engelli: 'blocked',
  engel: 'blocked',
  bloke: 'blocked',
  done: 'done',
  'done (test)': 'done',
  test: 'done',
  bitti: 'done',
  tamam: 'done',
  tamamlandı: 'done',
  tamamlandi: 'done',
  closed: 'closed',
  kapalı: 'closed',
  kapali: 'closed',
  kapandı: 'closed',
};

/** Values that mean "leave this field empty". */
const EMPTY = new Set(['', '-', '—', 'none', 'yok', 'unassigned', 'atanmamış', 'atanmamis', 'n/a']);

// `**Key:** value` — value runs until the next ` · **Key:**` or end of line.
const PAIR_RE = /\*\*([^*]+?):\*\*\s*(.*?)(?=\s*[·•|]\s*\*\*[^*]+?:\*\*|$)/g;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

function isEmpty(value: string): boolean {
  return EMPTY.has(value.trim().toLowerCase());
}

function toIso(y: number, mo: number, d: number): string | undefined {
  const date = new Date(y, mo - 1, d);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  return valid ? date.toISOString() : undefined;
}

/** DD.MM.YYYY, DD/MM/YYYY or YYYY-MM-DD → ISO at local midnight; undefined if unparseable. */
function parseDate(value: string): string | undefined {
  const v = value.trim();
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(v);
  if (dmy) return toIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (ymd) return toIso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  return undefined;
}

/** "240", "90m", "2h", "2 saat" → minutes; undefined if unparseable. */
function parseMinutes(value: string): number | undefined {
  const m = /^(\d+)\s*(h|hr|hrs|sa|saat|m|min|mins|dk|dak|dakika)?$/i.exec(value.trim());
  if (!m) return undefined;
  const hours = ['h', 'hr', 'hrs', 'sa', 'saat'].includes((m[2] ?? '').toLowerCase());
  return hours ? Number(m[1]) * 60 : Number(m[1]);
}

interface Draft extends ParsedTask {
  ref: string | null;
  headingTitle: string;
  fieldCount: number;
}

// Short reference codes like P01, T19, F-09 — only these are lifted out of a heading.
const REF_RE = /^[A-Za-z]{1,4}-?\d{1,4}$/;

function newDraft(line: number, heading: string | null): Draft {
  // "### P01 · Short name" → ref "P01", headingTitle "Short name";
  // "### Sprint 3 - Backend" has no code, so the whole heading is the title.
  const parts = heading ? heading.split(/\s+[·•|-]\s+/) : [];
  const ref = parts.length > 1 && REF_RE.test(parts[0].trim()) ? parts[0].trim() : null;
  return {
    line,
    ref,
    headingTitle: (ref ? parts.slice(1).join(' ') : (heading ?? '')).trim(),
    fieldCount: 0,
    title: '',
    description: null,
    status: 'todo',
    priority: 'medium',
    due_date: null,
    projectName: null,
    sprintName: null,
    assignee: null,
    energy: null,
    estimated_minutes: null,
    tagNames: [],
    warnings: [],
  };
}

function applyField(draft: Draft, key: FieldKey, value: string, line: number): void {
  const warn = (msg: string) => draft.warnings.push(`Line ${line}: ${msg}`);
  const lower = value.toLowerCase();
  switch (key) {
    case 'title':
      draft.title = value;
      break;
    case 'description':
      draft.description = value;
      break;
    case 'status': {
      const s = STATUS[lower];
      if (s) draft.status = s;
      else warn(`unknown status "${value}", using To do`);
      break;
    }
    case 'priority': {
      const p = PRIORITY[lower];
      if (p) draft.priority = p;
      else warn(`unknown priority "${value}", using Medium`);
      break;
    }
    case 'energy': {
      if (isEmpty(value)) break;
      const e = ENERGY[lower];
      if (e) draft.energy = e;
      else warn(`unknown energy "${value}", left empty`);
      break;
    }
    case 'due_date': {
      if (isEmpty(value)) break;
      const iso = parseDate(value);
      if (iso) draft.due_date = iso;
      else warn(`unreadable due date "${value}" (use DD.MM.YYYY), left empty`);
      break;
    }
    case 'estimated_minutes': {
      if (isEmpty(value)) break;
      const minutes = parseMinutes(value);
      if (minutes !== undefined) draft.estimated_minutes = minutes;
      else warn(`unreadable estimate "${value}", left empty`);
      break;
    }
    case 'project':
      draft.projectName = isEmpty(value) ? null : value;
      break;
    case 'sprint':
      draft.sprintName = isEmpty(value) ? null : value;
      break;
    case 'assignee':
      draft.assignee = isEmpty(value) ? null : value;
      break;
    case 'tags':
      draft.tagNames = value
        .split(/[,;]/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t, i, all) => t && all.findIndex((o) => o.toLowerCase() === t.toLowerCase()) === i);
      break;
  }
}

function finalize(draft: Draft): ParsedTask {
  const { ref, headingTitle, fieldCount: _count, ...task } = draft;
  const base = task.title || headingTitle;
  // Keep the document's own reference (P01, T19 …) visible on the card.
  const title = ref && !base.startsWith(ref) ? `${ref} · ${base}` : base;
  if (title.length > 200) task.warnings.push(`Line ${task.line}: title longer than 200 characters`);
  return { ...task, title };
}

export function parseTaskMarkdown(input: string): ParseResult {
  const tasks: ParsedTask[] = [];
  const errors: string[] = [];
  let current: Draft | null = null;
  let lastKey: FieldKey | null = null;

  const flush = () => {
    if (current && current.fieldCount > 0) {
      if (current.title || current.headingTitle) tasks.push(finalize(current));
      else errors.push(`Line ${current.line}: block has no Title, skipped`);
    }
    current = null;
    lastKey = null;
  };

  input.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const lineNo = i + 1;

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      // ### and deeper start a task block; # / ## are document sections.
      if (heading[1].length >= 3) current = newDraft(lineNo, heading[2]);
      return;
    }

    const pairs = [...line.matchAll(PAIR_RE)];
    if (pairs.length === 0) {
      // Unlabelled lines continue a multi-line description; a blank line ends it.
      if (current && lastKey === 'description' && line) {
        current.description = `${current.description ?? ''}\n${line}`.trim();
      } else {
        lastKey = null;
      }
      return;
    }

    for (const [, rawKey, rawValue] of pairs) {
      const key = KEYS[rawKey.trim().toLowerCase()];
      if (!key) {
        current?.warnings.push(`Line ${lineNo}: unknown field "${rawKey.trim()}" ignored`);
        continue;
      }
      // A second Title without a heading in between starts a new block.
      if (key === 'title' && current?.title) flush();
      if (!current) current = newDraft(lineNo, null);
      applyField(current, key, rawValue.trim(), lineNo);
      current.fieldCount += 1;
      lastKey = key;
    }
  });
  flush();

  return { tasks, errors };
}
