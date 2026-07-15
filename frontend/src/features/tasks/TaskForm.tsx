import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import type { Task, TaskPriority, TaskStatus } from '@/types/api';
import { TagPicker } from '@/features/tags/TagPicker';
import { taskFormSchema, type TaskFormValues } from './schemas';

interface Props {
  initial?: Task;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function TaskForm({ initial, onSubmit, onCancel, isSubmitting }: Props) {
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
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
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
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-white/10"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Input label="Due date" type="date" {...register('due_date')} />

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
