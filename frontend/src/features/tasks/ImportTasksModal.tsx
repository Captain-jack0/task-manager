import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { extractErrorMessage } from '@/api/client';
import { projectsApi } from '@/api/projects';
import { tagsApi } from '@/api/tags';
import { tasksApi } from '@/api/tasks';
import { PROJECTS_KEY, useProjects } from '@/features/projects/useProjects';
import { useTags } from '@/features/tags/useTags';
import { useMembers } from '@/features/workspaces/useMembers';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { parseTaskMarkdown, TASK_TEMPLATE } from './markdownImport';
import { TASKS_KEY } from './useTasks';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TEMPLATE_HREF = `data:text/markdown;charset=utf-8,${encodeURIComponent(TASK_TEMPLATE)}`;
const MAX_LISTED_WARNINGS = 8;

const norm = (s: string) => s.trim().toLowerCase();

/** Look a name up in the cache, creating it (once) when missing. */
async function resolveId(
  cache: Map<string, string>,
  name: string | null,
  create: (name: string) => Promise<string>,
): Promise<string | null> {
  if (!name) return null;
  const hit = cache.get(norm(name));
  if (hit) return hit;
  const id = await create(name.trim());
  cache.set(norm(name), id);
  return id;
}

export function ImportTasksModal({ open, onClose }: Props) {
  const [text, setText] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data: tags } = useTags();
  const { data: projects } = useProjects(workspaceId ?? undefined);
  const { data: members } = useMembers(workspaceId ?? undefined);

  const { tasks, errors } = useMemo(() => parseTaskMarkdown(text), [text]);

  const memberEmails = new Set((members ?? []).map((m) => norm(m.email)));
  const projectNames = new Set((projects ?? []).map((p) => norm(p.name)));
  const tagNames = new Set((tags ?? []).map((t) => norm(t.name)));
  const unique = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v)))];
  const unknownAssignees = unique(
    tasks.map((t) => (t.assignee && !memberEmails.has(norm(t.assignee)) ? t.assignee : null)),
  );
  const newProjects = unique(
    tasks.map((t) => (t.projectName && !projectNames.has(norm(t.projectName)) ? t.projectName : null)),
  );
  const newTags = unique(tasks.flatMap((t) => t.tagNames.filter((n) => !tagNames.has(norm(n)))));
  const notes = [...errors, ...tasks.flatMap((t) => t.warnings)];

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setText(await file.text());
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not read that file'));
    }
  };

  const runImport = async () => {
    if (tasks.length === 0 || progress) return;
    setProgress({ done: 0, total: tasks.length });
    const projectIds = new Map((projects ?? []).map((p) => [norm(p.name), p.id]));
    const tagIds = new Map((tags ?? []).map((t) => [norm(t.name), t.id]));
    const memberIds = new Map((members ?? []).map((m) => [norm(m.email), m.user_id]));
    const failed: string[] = [];

    for (const [i, task] of tasks.entries()) {
      try {
        const projectId = await resolveId(projectIds, task.projectName, (name) =>
          projectsApi.create({ name }, workspaceId).then((p) => p.id),
        );
        const tagIdList: string[] = [];
        for (const name of task.tagNames) {
          const id = await resolveId(tagIds, name, (n) => tagsApi.create({ name: n }).then((t) => t.id));
          if (id) tagIdList.push(id);
        }
        await tasksApi.create(
          {
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            estimated_minutes: task.estimated_minutes,
            energy_level: task.energy,
            project_id: projectId,
            assignee_id: task.assignee ? (memberIds.get(norm(task.assignee)) ?? null) : null,
            tag_ids: tagIdList,
          },
          workspaceId,
        );
      } catch (err) {
        failed.push(`${task.title}: ${extractErrorMessage(err)}`);
      }
      setProgress({ done: i + 1, total: tasks.length });
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: TASKS_KEY }),
      qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
      qc.invalidateQueries({ queryKey: ['tags'] }),
    ]);
    setProgress(null);
    const ok = tasks.length - failed.length;
    if (failed.length === 0) {
      toast.success(`Imported ${ok} task${ok === 1 ? '' : 's'}`);
      setText('');
      onClose();
    } else {
      toast.error(`Imported ${ok} of ${tasks.length}. Failed: ${failed.slice(0, 3).join(' · ')}`);
    }
  };

  const close = () => {
    if (!progress) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import tasks from Markdown"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={Boolean(progress)}>
            Cancel
          </Button>
          <Button onClick={() => void runImport()} disabled={tasks.length === 0 || Boolean(progress)}>
            {progress
              ? `Importing ${progress.done}/${progress.total}…`
              : `Import ${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            Choose .md file
            <input
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="sr-only"
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </label>
          <Button variant="secondary" size="sm" onClick={() => setText(TASK_TEMPLATE)}>
            Insert template
          </Button>
          <a
            href={TEMPLATE_HREF}
            download="task-template.md"
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Download template
          </a>
        </div>

        <textarea
          aria-label="Tasks in Markdown"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={'### T01 · Short name\n**Title:** …\n**Status:** To do · **Priority:** Medium'}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:border-slate-600 dark:focus:ring-white/10"
        />

        <p className="text-xs text-slate-400 dark:text-slate-500">
          One block per task. Fields: Title, Description, Status (To do / In progress / Blocked /
          Done / Closed), Priority and Energy (Low / Medium / High), Due date (DD.MM.YYYY), Project,
          Assignee (member email or Unassigned), Est. minutes, Tags (comma-separated). Turkish field
          names work too. Missing projects and tags are created for you.
        </p>

        {text.trim() && (
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} found
            </p>
            {newProjects.length > 0 && (
              <p className="text-slate-500 dark:text-slate-400">
                New projects: {newProjects.join(', ')}
              </p>
            )}
            {newTags.length > 0 && (
              <p className="text-slate-500 dark:text-slate-400">New tags: {newTags.join(', ')}</p>
            )}
            {unknownAssignees.length > 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                Not workspace members, left unassigned: {unknownAssignees.join(', ')}
              </p>
            )}
            {notes.slice(0, MAX_LISTED_WARNINGS).map((note) => (
              <p key={note} className="text-amber-700 dark:text-amber-400">
                {note}
              </p>
            ))}
            {notes.length > MAX_LISTED_WARNINGS && (
              <p className="text-amber-700 dark:text-amber-400">
                +{notes.length - MAX_LISTED_WARNINGS} more
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
