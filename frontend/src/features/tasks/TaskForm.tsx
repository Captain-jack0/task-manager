import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import type { Task, TaskPriority } from '@/types/api';
import { TagPicker } from '@/features/tags/TagPicker';
import { useProjects } from '@/features/projects/useProjects';
import { useSprints } from '@/features/sprints/useSprints';
import { useMembers } from '@/features/workspaces/useMembers';
import { displayName } from '@/lib/people';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { taskFormSchema, type TaskFormValues } from './schemas';
import {
  allTemplates,
  deleteCustomTemplate,
  saveCustomTemplate,
  templateToValues,
  type TaskTemplate,
} from './taskTemplates';
import { TemplatePicker } from './TemplatePicker';
import { STATUS_LABEL, STATUS_ORDER } from './status';

interface Props {
  initial?: Task;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const STATUSES = STATUS_ORDER.map((value) => ({ value, label: STATUS_LABEL[value] }));
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function TaskForm({ initial, onSubmit, onCancel, isSubmitting }: Props) {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const { data: projects } = useProjects(workspaceId);
  const { data: sprints } = useSprints(workspaceId);
  const { data: members } = useMembers(workspaceId);
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      status: initial?.status ?? 'todo',
      priority: initial?.priority ?? 'medium',
      due_date: initial?.due_date ? initial.due_date.slice(0, 10) : '',
      project_id: initial?.project_id ?? '',
      sprint_id: initial?.sprint_id ?? '',
      assignee_id: initial?.assignee_id ?? '',
      energy_level: initial?.energy_level ?? '',
      estimated_minutes:
        initial?.estimated_minutes != null ? String(initial.estimated_minutes) : '',
      tag_ids: initial?.tags.map((t) => t.id) ?? [],
    },
  });

  const [templates, setTemplates] = useState<TaskTemplate[]>(() => allTemplates(workspaceId));
  const description = watch('description') ?? '';

  const applyTemplate = (tpl: TaskTemplate) => {
    if (description.trim() && !window.confirm(`Replace the current description with the "${tpl.name}" template?`)) return;
    const values = templateToValues(tpl, {
      priority: getValues('priority'),
      energy_level: getValues('energy_level') ?? '',
      estimated_minutes: getValues('estimated_minutes') ?? '',
    });
    setValue('description', values.description, { shouldDirty: true });
    if (values.priority) setValue('priority', values.priority);
    if (values.energy_level) setValue('energy_level', values.energy_level);
    if (values.estimated_minutes) setValue('estimated_minutes', values.estimated_minutes);
  };

  const saveTemplate = () => {
    const name = window.prompt('Template name')?.trim();
    if (!name) return;
    const minutes = getValues('estimated_minutes');
    setTemplates(
      allTemplates(workspaceId).filter((t) => t.builtIn).concat(
        saveCustomTemplate(workspaceId, {
          name,
          description,
          priority: getValues('priority'),
          energy: getValues('energy_level') || undefined,
          estimated_minutes: minutes ? Number(minutes) : undefined,
        }),
      ),
    );
    toast.success(`Template "${name}" saved`);
  };

  const removeTemplate = (id: string) => {
    setTemplates(allTemplates(workspaceId).filter((t) => t.builtIn).concat(deleteCustomTemplate(workspaceId, id)));
    toast.success('Template removed');
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Title" error={errors.title?.message} {...register('title')} />

      {!initial && (
        <TemplatePicker
          templates={templates}
          onPick={applyTemplate}
          onSaveCurrent={saveTemplate}
          onDelete={removeTemplate}
          canSave={description.trim().length > 0}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Description
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              id="description"
              value={field.value ?? ''}
              onChange={field.onChange}
              rows={4}
              placeholder="What needs to happen? Markdown works: lists, checklists, tables…"
              error={errors.description?.message}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-slate-600 dark:text-slate-300">Status</label>
          <select
            id="status"
            {...register('status')}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="priority" className="text-sm font-medium text-slate-600 dark:text-slate-300">Priority</label>
          <select
            id="priority"
            {...register('priority')}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Input label="Due date" type="date" {...register('due_date')} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="project_id" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Project
        </label>
        <select
          id="project_id"
          {...register('project_id')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
        >
          <option value="">No project</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sprint_id" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Sprint
        </label>
        <select
          id="sprint_id"
          {...register('sprint_id')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
        >
          <option value="">Backlog (no sprint)</option>
          {(sprints ?? [])
            .filter((s) => s.closed_at === null || s.id === initial?.sprint_id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.start_date} → {s.end_date}
                {s.closed_at ? ' (closed)' : ''}
              </option>
            ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="assignee_id" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Assignee
        </label>
        <select
          id="assignee_id"
          {...register('assignee_id')}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
        >
          <option value="">Unassigned</option>
          {(members ?? []).map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {displayName(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="energy_level" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Energy
          </label>
          <select
            id="energy_level"
            {...register('energy_level')}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
          >
            <option value="">—</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <Input
          label="Est. minutes"
          type="number"
          min={1}
          placeholder="e.g. 30"
          error={errors.estimated_minutes?.message}
          {...register('estimated_minutes')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Tags</span>
        <Controller
          name="tag_ids"
          control={control}
          render={({ field }) => (
            <TagPicker selectedTagIds={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initial ? 'Save changes' : 'Create task'}
        </Button>
      </div>
    </form>
  );
}
