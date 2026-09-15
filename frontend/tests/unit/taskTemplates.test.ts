import { describe, it, expect } from 'vitest';
import {
  allTemplates,
  BUILT_IN_TEMPLATES,
  deleteCustomTemplate,
  loadCustomTemplates,
  saveCustomTemplate,
  templateToValues,
} from '@/features/tasks/taskTemplates';

describe('task templates', () => {
  it('ships built-ins with checklists that the description parser understands', () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.id)).toEqual(['bug', 'feature', 'chore', 'meeting', 'research']);
    expect(BUILT_IN_TEMPLATES.every((t) => t.description.includes('- [ ]'))).toBe(true);
  });

  it('saves, lists and deletes custom templates per workspace', () => {
    const ws = 'ws-1';
    expect(loadCustomTemplates(ws)).toEqual([]);
    saveCustomTemplate(ws, { name: 'Release', description: '- [ ] tag\n- [ ] deploy', priority: 'high' });
    const [saved] = loadCustomTemplates(ws);
    expect(saved.name).toBe('Release');
    expect(saved.priority).toBe('high');
    expect(loadCustomTemplates('ws-2')).toEqual([]);
    expect(allTemplates(ws)).toHaveLength(BUILT_IN_TEMPLATES.length + 1);

    // Saving under the same name replaces the earlier one.
    saveCustomTemplate(ws, { name: 'Release', description: 'v2' });
    expect(loadCustomTemplates(ws).map((t) => t.description)).toEqual(['v2']);

    deleteCustomTemplate(ws, loadCustomTemplates(ws)[0].id);
    expect(loadCustomTemplates(ws)).toEqual([]);
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem('task-templates:bad', '{not json');
    expect(loadCustomTemplates('bad')).toEqual([]);
    localStorage.setItem('task-templates:bad', JSON.stringify([{ nope: 1 }, { id: 'x', name: 'ok', description: '' }]));
    expect(loadCustomTemplates('bad').map((t) => t.id)).toEqual(['x']);
  });

  it('only fills presets the user has not set', () => {
    const chore = BUILT_IN_TEMPLATES.find((t) => t.id === 'chore')!;
    expect(templateToValues(chore, { priority: 'medium', energy_level: '', estimated_minutes: '' })).toEqual({
      description: chore.description,
      priority: 'low',
      energy_level: 'low',
      estimated_minutes: '30',
    });
    expect(templateToValues(chore, { priority: 'high', energy_level: 'high', estimated_minutes: '90' })).toEqual({
      description: chore.description,
    });
  });
});
