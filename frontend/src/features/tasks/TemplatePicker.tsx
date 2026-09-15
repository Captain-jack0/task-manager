import { useState } from 'react';
import type { TaskTemplate } from './taskTemplates';

interface Props {
  templates: TaskTemplate[];
  onPick: (template: TaskTemplate) => void;
  onSaveCurrent: () => void;
  onDelete: (id: string) => void;
  canSave: boolean;
}

const SELECT =
  'cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs text-slate-700 transition-colors focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-600 dark:focus:ring-white/10';

const LINK =
  'text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50';

/** "Start from a template" row for the new-task form. */
export function TemplatePicker({ templates, onPick, onSaveCurrent, onDelete, canSave }: Props) {
  const [lastId, setLastId] = useState('');
  const last = templates.find((t) => t.id === lastId);
  const custom = templates.filter((t) => !t.builtIn);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <label htmlFor="task-template" className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Template
      </label>
      <select
        id="task-template"
        className={SELECT}
        value=""
        onChange={(e) => {
          const tpl = templates.find((t) => t.id === e.target.value);
          if (!tpl) return;
          setLastId(tpl.id);
          onPick(tpl);
          e.target.value = '';
        }}
      >
        <option value="">Choose…</option>
        <optgroup label="Built-in">
          {templates
            .filter((t) => t.builtIn)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </optgroup>
        {custom.length > 0 && (
          <optgroup label="Mine">
            {custom.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {last && !last.builtIn && (
        <button type="button" onClick={() => onDelete(last.id)} className={LINK}>
          Remove “{last.name}”
        </button>
      )}
      <button
        type="button"
        onClick={onSaveCurrent}
        disabled={!canSave}
        title={canSave ? 'Save this description and presets as a template' : 'Write a description first'}
        className={`ml-auto ${LINK}`}
      >
        Save as template…
      </button>
    </div>
  );
}
