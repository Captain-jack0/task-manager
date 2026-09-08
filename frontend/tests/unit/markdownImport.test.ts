import { describe, it, expect } from 'vitest';
import { parseTaskMarkdown, TASK_TEMPLATE } from '@/features/tasks/markdownImport';

const SAMPLE = `# Refactor Görevleri

> Intro prose with **bold** but no fields.

## FAZ 0 · Dokümantasyon

### P01 · BRD
**Title:** BRD hazırla
**Description:** Amaç: Ürünün neden yapıldığı yazılı değil.
Kabul: Her hedefin ölçülebilir metriği var.

**Status:** To do · **Priority:** High · **Due date:** 09.09.2026
**Project:** DraftMarkt · **Assignee:** Unassigned · **Energy:** Medium · **Est. minutes:** 240
**Tags:** orta, product, #docs, Orta

### P02 · PRD
**Title:** PRD hazırla
**Status:** In progress · **Priority:** Low · **Due date:** -
**Project:** - · **Assignee:** ali@example.com · **Energy:** - · **Est. minutes:** 2h
`;

describe('parseTaskMarkdown', () => {
  it('parses every field of a task block', () => {
    const { tasks, errors } = parseTaskMarkdown(SAMPLE);
    expect(errors).toEqual([]);
    expect(tasks).toHaveLength(2);

    const [p1, p2] = tasks;
    expect(p1.title).toBe('P01 · BRD hazırla');
    expect(p1.description).toBe(
      'Amaç: Ürünün neden yapıldığı yazılı değil.\nKabul: Her hedefin ölçülebilir metriği var.',
    );
    expect(p1.status).toBe('todo');
    expect(p1.priority).toBe('high');
    expect(p1.due_date).toBe(new Date(2026, 8, 9).toISOString());
    expect(p1.projectName).toBe('DraftMarkt');
    expect(p1.assignee).toBeNull();
    expect(p1.energy).toBe('medium');
    expect(p1.estimated_minutes).toBe(240);
    expect(p1.tagNames).toEqual(['orta', 'product', 'docs']);
    expect(p1.warnings).toEqual([]);

    expect(p2.title).toBe('P02 · PRD hazırla');
    expect(p2.description).toBeNull();
    expect(p2.status).toBe('in_progress');
    expect(p2.priority).toBe('low');
    expect(p2.due_date).toBeNull();
    expect(p2.projectName).toBeNull();
    expect(p2.assignee).toBe('ali@example.com');
    expect(p2.energy).toBeNull();
    expect(p2.estimated_minutes).toBe(120);
  });

  it('accepts Turkish field names and ISO dates, defaults the rest', () => {
    const { tasks } = parseTaskMarkdown(
      '**Başlık:** Türkçe görev\n**Durum:** Bitti · **Öncelik:** Yüksek · **Bitiş:** 2026-12-31 · **Sprint:** S1\n**Etiketler:** a; b',
    );
    expect(tasks).toHaveLength(1);
    const [t] = tasks;
    expect(t.title).toBe('Türkçe görev');
    expect(t.status).toBe('done');
    expect(t.priority).toBe('high');
    expect(t.due_date).toBe(new Date(2026, 11, 31).toISOString());
    expect(t.energy).toBeNull();
    expect(t.sprintName).toBe('S1');
    expect(t.tagNames).toEqual(['a', 'b']);
  });

  it('warns on unknown values instead of dropping the task', () => {
    const { tasks, errors } = parseTaskMarkdown(
      '**Title:** X\n**Status:** Weird · **Due date:** 99.99.2026 · **Est. minutes:** soon',
    );
    expect(errors).toEqual([]);
    expect(tasks[0].status).toBe('todo');
    expect(tasks[0].due_date).toBeNull();
    expect(tasks[0].estimated_minutes).toBeNull();
    expect(tasks[0].warnings).toHaveLength(3);
  });

  it('reports blocks without a title and keeps the rest', () => {
    const { tasks, errors } = parseTaskMarkdown(
      '**Priority:** High\n\n### T01 · ok\n**Title:** ok\n\n**Title:** second\n**Title:** third',
    );
    expect(tasks.map((t) => t.title)).toEqual(['T01 · ok', 'second', 'third']);
    expect(errors).toEqual(['Line 1: block has no Title, skipped']);
  });

  it('uses the heading as title when the Title field is missing', () => {
    const { tasks } = parseTaskMarkdown('### T03 · Sadece başlık\n**Priority:** High');
    expect(tasks[0].title).toBe('T03 · Sadece başlık');
  });

  it('only lifts short codes out of headings, never ordinary words', () => {
    const { tasks } = parseTaskMarkdown(
      '### Sprint 3 - Backend tasks\n**Title:** Add pagination\n\n### F-09 - Flutter\n**Title:** Set up CI',
    );
    expect(tasks.map((t) => t.title)).toEqual(['Add pagination', 'F-09 · Set up CI']);
  });

  it('ignores headings and prose that carry no fields', () => {
    const { tasks, errors } = parseTaskMarkdown(
      '## Notes\nsome prose\n### Sub\nmore prose\n### T01 · A\n**Title:** A',
    );
    expect(errors).toEqual([]);
    expect(tasks.map((t) => t.title)).toEqual(['T01 · A']);
  });

  it('round-trips the built-in template', () => {
    const { tasks, errors } = parseTaskMarkdown(TASK_TEMPLATE);
    expect(errors).toEqual([]);
    expect(tasks).toHaveLength(2);
    expect(tasks[1].assignee).toBe('ornek@mail.com');
    expect(tasks[1].projectName).toBeNull();
    expect(tasks[0].sprintName).toBe('Sprint 1');
    expect(tasks[1].sprintName).toBeNull();
  });
});
