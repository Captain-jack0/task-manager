/** Checklist helpers mirroring the web app's lib/markdown.ts so both clients
 * agree on which `- [ ]` is "the n-th box". Fenced code is ignored. */

const CHECKBOX_RE = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[( |x|X)\]/gm;

function maskFences(text: string): string {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, (block) => block.replace(/[^\n]/g, ' '));
}

interface CheckboxMatch {
  boxAt: number;
  checked: boolean;
}

function checkboxMatches(text: string): CheckboxMatch[] {
  const masked = maskFences(text);
  const out: CheckboxMatch[] = [];
  for (const m of masked.matchAll(CHECKBOX_RE)) {
    out.push({ boxAt: (m.index ?? 0) + m[1].length, checked: m[2] !== ' ' });
  }
  return out;
}

export function checklistProgress(text: string): { done: number; total: number } {
  const boxes = checkboxMatches(text);
  return { done: boxes.filter((b) => b.checked).length, total: boxes.length };
}

export function toggleNthCheckbox(text: string, n: number, checked: boolean): string {
  const box = checkboxMatches(text)[n];
  if (!box) return text;
  return `${text.slice(0, box.boxAt)}[${checked ? 'x' : ' '}]${text.slice(box.boxAt + 3)}`;
}

/** Bold segments for inline rendering; other markers are stripped. */
export function inlineSegments(line: string): { text: string; bold: boolean }[] {
  const cleaned = line
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  return cleaned
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part.replace(/(\*|_)(.+?)\1/g, '$2'), bold: false },
    );
}
