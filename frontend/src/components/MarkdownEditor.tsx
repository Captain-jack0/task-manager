import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import {
  insertBlock,
  prefixLines,
  TABLE_TEMPLATE,
  wrapSelection,
  type EditResult,
} from '@/lib/markdown';
import { MarkdownView } from './MarkdownView';

interface Props {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
}

type Tool = { label: string; title: string; apply: (text: string, s: { start: number; end: number }) => EditResult };

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold (Ctrl+B)', apply: (t, s) => wrapSelection(t, s, '**') },
  { label: 'I', title: 'Italic (Ctrl+I)', apply: (t, s) => wrapSelection(t, s, '_') },
  { label: 'H', title: 'Heading', apply: (t, s) => prefixLines(t, s, '## ') },
  { label: '•', title: 'Bulleted list', apply: (t, s) => prefixLines(t, s, '- ') },
  { label: '1.', title: 'Numbered list', apply: (t, s) => prefixLines(t, s, (i) => `${i + 1}. `) },
  { label: '☑', title: 'Checklist', apply: (t, s) => prefixLines(t, s, '- [ ] ') },
  { label: '⊞', title: 'Table', apply: (t, s) => insertBlock(t, s, TABLE_TEMPLATE) },
];

const TOOL_BUTTON =
  'rounded px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

/** Markdown textarea with a formatting toolbar and a preview tab. */
export function MarkdownEditor({ id, value, onChange, placeholder, rows = 5, error }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const run = (tool: Tool) => {
    const ta = ref.current;
    const sel = ta ? { start: ta.selectionStart, end: ta.selectionEnd } : { start: value.length, end: value.length };
    const result = tool.apply(value, sel);
    onChange(result.text);
    // Restore focus and select the affected text once React has flushed the new value.
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(result.start, result.end);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const tool = key === 'b' ? TOOLS[0] : key === 'i' ? TOOLS[1] : undefined;
    if (!tool) return;
    e.preventDefault();
    run(tool);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-0.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            disabled={preview}
            onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
            onClick={() => run(tool)}
            className={cn(TOOL_BUTTON, preview && 'opacity-40')}
          >
            {tool.label}
          </button>
        ))}
        <div className="ml-auto flex gap-0.5">
          {(['Write', 'Preview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPreview(tab === 'Preview')}
              className={cn(
                TOOL_BUTTON,
                'font-medium',
                (tab === 'Preview') === preview && 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {preview ? (
        <div className="min-h-[7rem] rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          {value.trim() ? (
            <MarkdownView text={value} />
          ) : (
            <p className="text-sm italic text-slate-400">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          className={cn(
            'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:border-slate-600 dark:focus:ring-white/10',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-500/10',
          )}
        />
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!preview && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Markdown: **bold**, _italic_, - list, - [ ] checklist, | table |
        </p>
      )}
    </div>
  );
}
