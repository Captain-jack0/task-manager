import type { TaskEnergy, TaskPriority } from '@/types/api';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  priority?: TaskPriority;
  energy?: TaskEnergy;
  estimated_minutes?: number;
  builtIn?: boolean;
}

export const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  {
    id: 'bug',
    name: 'Bug',
    priority: 'high',
    description: `## Steps to reproduce
1.
2.

## Expected


## Actual


## Checklist
- [ ] Reproduced locally
- [ ] Root cause found
- [ ] Fix + test
- [ ] Verified on dev`,
    builtIn: true,
  },
  {
    id: 'feature',
    name: 'Feature',
    description: `## Goal
Why are we doing this?

## Scope
-

## Acceptance criteria
- [ ]
- [ ]

## Out of scope
- `,
    builtIn: true,
  },
  {
    id: 'chore',
    name: 'Chore',
    priority: 'low',
    energy: 'low',
    estimated_minutes: 30,
    description: `## What


## Checklist
- [ ]
- [ ] `,
    builtIn: true,
  },
  {
    id: 'meeting',
    name: 'Meeting',
    energy: 'medium',
    estimated_minutes: 60,
    description: `## Agenda
1.
2.

## Attendees
-

## Notes


## Action items
- [ ] `,
    builtIn: true,
  },
  {
    id: 'research',
    name: 'Research / spike',
    energy: 'high',
    description: `## Question


## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
|  |  |  |

## Recommendation


- [ ] Write-up shared`,
    builtIn: true,
  },
];

const storageKey = (workspaceId: string | undefined) => `task-templates:${workspaceId ?? 'personal'}`;

/** User-saved templates for a workspace (browser-local). Never throws — storage may be unavailable. */
export function loadCustomTemplates(workspaceId: string | undefined): TaskTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (t): t is TaskTemplate =>
            typeof t === 'object' && t !== null && typeof (t as TaskTemplate).id === 'string' && typeof (t as TaskTemplate).name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function persist(workspaceId: string | undefined, templates: TaskTemplate[]): TaskTemplate[] {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(templates));
  } catch {
    // Storage unavailable (private mode / quota): the template lives for this session only.
  }
  return templates;
}

export function saveCustomTemplate(workspaceId: string | undefined, template: Omit<TaskTemplate, 'id' | 'builtIn'>): TaskTemplate[] {
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = loadCustomTemplates(workspaceId).filter((t) => t.name !== template.name);
  return persist(workspaceId, [...existing, { ...template, id }]);
}

export function deleteCustomTemplate(workspaceId: string | undefined, id: string): TaskTemplate[] {
  return persist(workspaceId, loadCustomTemplates(workspaceId).filter((t) => t.id !== id));
}

export function allTemplates(workspaceId: string | undefined): TaskTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates(workspaceId)];
}

export interface TemplateValues {
  description: string;
  priority?: TaskPriority;
  energy_level?: TaskEnergy;
  estimated_minutes?: string;
}

/** Form values a template sets. Presets only fill fields the user has not touched yet. */
export function templateToValues(
  tpl: TaskTemplate,
  current: { priority: TaskPriority; energy_level: TaskEnergy | ''; estimated_minutes: string },
): TemplateValues {
  return {
    description: tpl.description,
    ...(tpl.priority && current.priority === 'medium' ? { priority: tpl.priority } : {}),
    ...(tpl.energy && !current.energy_level ? { energy_level: tpl.energy } : {}),
    ...(tpl.estimated_minutes != null && !current.estimated_minutes
      ? { estimated_minutes: String(tpl.estimated_minutes) }
      : {}),
  };
}
