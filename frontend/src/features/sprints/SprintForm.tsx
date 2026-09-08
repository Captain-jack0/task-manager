import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import type { Sprint, SprintCreateInput } from '@/types/api';
import { localToday } from './useSprints';

interface Props {
  initial?: Sprint;
  onSubmit: (values: SprintCreateInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localToday(d);
};

export function SprintForm({ initial, onSubmit, onCancel, isSubmitting }: Props) {
  const today = localToday();
  const [name, setName] = useState(initial?.name ?? '');
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [start, setStart] = useState(initial?.start_date ?? today);
  // Two-week sprints by default.
  const [end, setEnd] = useState(initial?.end_date ?? addDays(today, 13));
  const dateError = end < start ? 'End date must be on or after the start date' : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || dateError) return;
    onSubmit({ name: name.trim(), goal: goal.trim() || null, start_date: start, end_date: end });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <Input
        label="Name"
        name="sprint_name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sprint 1"
        autoFocus
        required
      />
      <Input
        label="Goal"
        name="sprint_goal"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="What should be true when this sprint ends?"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Start"
          name="sprint_start"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
        <Input
          label="End"
          name="sprint_end"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          error={dateError}
          required
        />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={!name.trim() || Boolean(dateError)}>
          {initial ? 'Save' : 'Create sprint'}
        </Button>
      </div>
    </form>
  );
}
