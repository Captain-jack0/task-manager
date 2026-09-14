import { describe, it, expect } from 'vitest';
import {
  checkboxLines,
  checklistProgress,
  continueList,
  insertBlock,
  prefixLines,
  stripMarkdown,
  TABLE_TEMPLATE,
  toggleNthCheckbox,
  wrapSelection,
} from '@/lib/markdown';

describe('editor toolbar helpers', () => {
  it('wraps the selection and selects the inner text', () => {
    const r = wrapSelection('make this bold', { start: 5, end: 9 }, '**');
    expect(r.text).toBe('make **this** bold');
    expect(r.text.slice(r.start, r.end)).toBe('this');
  });

  it('inserts a selected placeholder when nothing is selected', () => {
    const r = wrapSelection('', { start: 0, end: 0 }, '_');
    expect(r.text).toBe('_text_');
    expect(r.text.slice(r.start, r.end)).toBe('text');
  });

  it('prefixes every line in the selection and toggles it off again', () => {
    const text = 'one\ntwo\nthree';
    const on = prefixLines(text, { start: 1, end: 6 }, '- [ ] ');
    expect(on.text).toBe('- [ ] one\n- [ ] two\nthree');
    const off = prefixLines(on.text, { start: on.start, end: on.end }, '- [ ] ');
    expect(off.text).toBe(text);
  });

  it('numbers lines with a per-line prefix', () => {
    const r = prefixLines('a\nb', { start: 0, end: 3 }, (i) => `${i + 1}. `);
    expect(r.text).toBe('1. a\n2. b');
  });

  it('inserts a table on its own lines and selects it', () => {
    const r = insertBlock('intro', { start: 5, end: 5 }, TABLE_TEMPLATE);
    expect(r.text).toBe(`intro\n\n${TABLE_TEMPLATE}`);
    expect(r.text.slice(r.start, r.end)).toBe(TABLE_TEMPLATE);
  });
});

describe('continueList (Enter inside a list)', () => {
  it('counts numbered lists up and keeps the caret on the new line', () => {
    const text = '1. first';
    const r = continueList(text, text.length);
    expect(r?.text).toBe('1. first\n2. ');
    expect(r?.start).toBe(r?.text.length);
  });

  it('continues bullets and checklists with a fresh empty box, keeping indentation', () => {
    expect(continueList('- a', 3)?.text).toBe('- a\n- ');
    expect(continueList('  - [x] done', 12)?.text).toBe('  - [x] done\n  - [ ] ');
    expect(continueList('3) c', 4)?.text).toBe('3) c\n4) ');
  });

  it('ends the list when Enter is pressed on an empty item', () => {
    const text = '1. a\n2. ';
    const r = continueList(text, text.length);
    expect(r?.text).toBe('1. a\n');
    expect(r?.start).toBe(5);
  });

  it('does nothing outside a list', () => {
    expect(continueList('plain text', 10)).toBeNull();
    expect(continueList('1.no space', 10)).toBeNull();
  });
});

describe('checklists', () => {
  const text = 'Plan\n- [ ] write\n- [x] review\n* [ ] ship\nnot - [ ] a task';

  it('reports the source line of each checkbox, even after a blank line', () => {
    expect(checkboxLines('## Plan\ntext\n\n- [ ] a\n- [x] b')).toEqual([4, 5]);
  });

  it('ignores checkboxes inside fenced code blocks', () => {
    const withCode = 'Steps\n```md\n- [ ] not a task\n```\n- [ ] real\n- [x] also real';
    expect(checklistProgress(withCode)).toEqual({ done: 1, total: 2 });
    expect(checkboxLines(withCode)).toEqual([5, 6]);
    expect(toggleNthCheckbox(withCode, 0, true)).toBe(
      'Steps\n```md\n- [ ] not a task\n```\n- [x] real\n- [x] also real',
    );
  });

  it('counts done/total', () => {
    expect(checklistProgress(text)).toEqual({ done: 1, total: 3 });
    expect(checklistProgress('no boxes')).toEqual({ done: 0, total: 0 });
  });

  it('toggles only the n-th box', () => {
    expect(toggleNthCheckbox(text, 2, true)).toBe(
      'Plan\n- [ ] write\n- [x] review\n* [x] ship\nnot - [ ] a task',
    );
    expect(toggleNthCheckbox(text, 1, false)).toContain('- [ ] review');
  });
});

describe('stripMarkdown', () => {
  it('flattens formatting for a plain excerpt', () => {
    expect(stripMarkdown('## Title\n**bold** and _it_ ~~x~~ `code` [link](http://x)')).toBe(
      'Title\nbold and it x code link',
    );
    expect(stripMarkdown('- [x] done\n- [ ] todo')).toBe('☑ done\n☐ todo');
    expect(stripMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('a · b\n1 · 2');
  });
});
