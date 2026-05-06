import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import type { Tag } from '@/types/api';
import { TagBadge } from './TagBadge';
import { useCreateTag, useTags } from './useTags';

interface Props {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagPicker({ selectedTagIds, onChange }: Props) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  const toggle = (tag: Tag) => {
    if (selectedSet.has(tag.id)) {
      onChange(selectedTagIds.filter((id) => id !== tag.id));
    } else {
      onChange([...selectedTagIds, tag.id]);
    }
  };

  const handleCreate = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    createTag.mutate(
      { name: trimmed, color: newTagColor },
      {
        onSuccess: (created) => {
          onChange([...selectedTagIds, created.id]);
          setNewTagName('');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not create tag')),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            selected={selectedSet.has(tag.id)}
            onClick={() => toggle(tag)}
          />
        ))}
        {tags.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No tags yet. Create your first below.
          </p>
        )}
      </div>
      <div className="flex items-end gap-2">
        <Input
          label="New tag"
          placeholder="e.g. urgent"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          name="new-tag-name"
        />
        <input
          aria-label="New tag color"
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-700"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCreate}
          isLoading={createTag.isPending}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
