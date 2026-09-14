/** Pure text helpers behind the Markdown editor toolbar and the checklist UI. */

export interface Selection {
  start: number;
  end: number;
}

export interface EditResult {
  text: string;
  start: number;
  end: number;
}

/** Wrap the selection in `marker` (e.g. `**`). With nothing selected, insert a selected placeholder. */
export function wrapSelection(
  text: string,
  { start, end }: Selection,
  marker: string,
  placeholder = 'text',
): EditResult {
  const selected = text.slice(start, end) || placeholder;
  const before = text.slice(0, start);
  const after = text.slice(end);
  return {
    text: `${before}${marker}${selected}${marker}${after}`,
    start: start + marker.length,
    end: start + marker.length + selected.length,
  };
}

/**
 * Prefix every line touched by the selection (`- `, `1. `, `- [ ] `…). If every
 * line already carries the prefix, remove it instead, so the button toggles.
 */
export function prefixLines(
  text: string,
  { start, end }: Selection,
  prefix: string | ((lineIndex: number) => string),
): EditResult {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const prefixFor = (i: number) => (typeof prefix === 'string' ? prefix : prefix(i));
  const allPrefixed = lines.every((l, i) => l.startsWith(prefixFor(i)));
  const changed = lines.map((l, i) =>
    allPrefixed ? l.slice(prefixFor(i).length) : `${prefixFor(i)}${l}`,
  );
  const block = changed.join('\n');
  return {
    text: `${text.slice(0, lineStart)}${block}${text.slice(lineEnd)}`,
    start: lineStart,
    end: lineStart + block.length,
  };
}

/** Insert a block (table, etc.) on its own lines at the caret and select it. */
export function insertBlock(text: string, { start, end }: Selection, block: string): EditResult {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !before.endsWith('\n') ? (before.endsWith('\n\n') ? '' : '\n\n') : '';
  const trail = after && !after.startsWith('\n') ? '\n\n' : '';
  const inserted = `${lead}${block}${trail}`;
  return {
    text: `${before}${inserted}${after}`,
    start: start + lead.length,
    end: start + lead.length + block.length,
  };
}

const LIST_LINE_RE = /^([ \t]*)(- \[[ xX]\] |[-*+] |(\d+)([.)]) )(.*)$/;

/**
 * Enter inside a list item: continue the list on the next line (numbered
 * lists count up, checklists get an empty box). Enter on an *empty* item ends
 * the list by clearing the marker. Returns null when the caret isn't in a list.
 */
export function continueList(text: string, caret: number): EditResult | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  const m = LIST_LINE_RE.exec(line);
  if (!m) return null;
  const [, indent, marker, number, delimiter, content] = m;
  if (!content.trim()) {
    // Empty item → leave the list.
    const before = text.slice(0, lineStart) + indent;
    return { text: before + text.slice(caret), start: before.length, end: before.length };
  }
  const next = number
    ? `${Number(number) + 1}${delimiter} `
    : marker.startsWith('- [')
      ? '- [ ] '
      : marker;
  const inserted = `\n${indent}${next}`;
  const pos = caret + inserted.length;
  return { text: text.slice(0, caret) + inserted + text.slice(caret), start: pos, end: pos };
}

export const TABLE_TEMPLATE = `| Column 1 | Column 2 |
| --- | --- |
| Cell | Cell |`;

// `[ \t]*`, not `\s*`: in multiline mode `\s*` would swallow the newline of a
// preceding blank line and report the match one line early.
const CHECKBOX_RE = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[( |x|X)\]/gm;

interface CheckboxMatch {
  /** Offset of the `[ ]`/`[x]` box in the original text. */
  boxAt: number;
  checked: boolean;
  /** 1-based source line. */
  line: number;
}

/** Blank out fenced code blocks (same length, newlines kept) so a `- [ ]` inside code is ignored. */
function maskFences(text: string): string {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, (block) =>
    block.replace(/[^\n]/g, ' '),
  );
}

/** Every real checklist box in document order — what remark will actually render. */
function checkboxMatches(text: string): CheckboxMatch[] {
  const masked = maskFences(text);
  const out: CheckboxMatch[] = [];
  for (const m of masked.matchAll(CHECKBOX_RE)) {
    const start = m.index ?? 0;
    out.push({
      boxAt: start + m[1].length,
      checked: m[2] !== ' ',
      line: (masked.slice(0, start).match(/\n/g)?.length ?? 0) + 1,
    });
  }
  return out;
}

/** How many `- [ ]` items exist and how many are ticked. */
export function checklistProgress(text: string): { done: number; total: number } {
  const boxes = checkboxMatches(text);
  return { done: boxes.filter((b) => b.checked).length, total: boxes.length };
}

/** 1-based source line of every checkbox, in document order (index n ↔ n-th checkbox). */
export function checkboxLines(text: string): number[] {
  return checkboxMatches(text).map((b) => b.line);
}

/** "☑ 1/3" for card chips, or null when the text has no checklist. */
export function checklistLabel(text: string | null | undefined): string | null {
  const { done, total } = checklistProgress(text ?? '');
  return total > 0 ? `☑ ${done}/${total}` : null;
}

/** Tick or untick the n-th checkbox (document order) in the source text. */
export function toggleNthCheckbox(text: string, n: number, checked: boolean): string {
  const box = checkboxMatches(text)[n];
  if (!box) return text;
  return `${text.slice(0, box.boxAt)}[${checked ? 'x' : ' '}]${text.slice(box.boxAt + 3)}`;
}

/** Plain-text preview of Markdown for card excerpts. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm, '') // table separator rows
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[x\][ \t]*/gim, '☑ ')
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[ \][ \t]*/gm, '☐ ')
    .replace(/^ {0,3}#{1,6}[ \t]+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/\s*\|\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
