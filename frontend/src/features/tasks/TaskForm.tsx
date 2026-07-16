import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import type { Task, TaskPriority } from '@/types/api';
import { TagPicker } from '@/features/tags/TagPicker';
import { useProjects } from '@/features/projects/useProjects';
import { useMembers } from '@/features/workspaces/useMembers';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { taskFormSchema, type TaskFormValues } from './schemas';
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
  const { data: members } = useMembers(workspaceId);
  const {
    register,
    handleSubmit,
    control,
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
      assignee_id: initial?.assignee_id ?? '',
      energy_level: initial?.energy_level ?? '',
      estimated_minutes:
        initial?.estimated_minutes != null ? String(initial.estimated_minutes) : '',
      tag_ids: initial?.tags.map((t) => t.id) ?? [],
    },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Title" error={errors.title?.message} {...register('title')} />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
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
              {m.email}
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
