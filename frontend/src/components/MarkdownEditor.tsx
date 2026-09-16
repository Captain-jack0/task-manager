import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  continueList,
  insertBlock,
  insertFencedCode,
  insideFence,
  prefixLines,
  TABLE_TEMPLATE,
  wrapLink,
  wrapSelection,
  type EditResult,
  type Selection,
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

interface Tool {
  label: ReactNode;
  title: string;
  /** Ctrl/Cmd + key */
  shortcut?: string;
  apply: (text: string, selection: Selection) => EditResult;
}

const TOOL_GROUPS: Tool[][] = [
  [
    { label: 'B', title: 'Bold', shortcut: 'b', apply: (t, s) => wrapSelection(t, s, '**') },
    { label: <i>I</i>, title: 'Italic', shortcut: 'i', apply: (t, s) => wrapSelection(t, s, '_') },
    { label: <s>S</s>, title: 'Strikethrough', apply: (t, s) => wrapSelection(t, s, '~~') },
  ],
  [
    { label: 'H', title: 'Heading', apply: (t, s) => prefixLines(t, s, '## ') },
    { label: '❝', title: 'Quote', apply: (t, s) => prefixLines(t, s, '> ') },
  ],
  [
    { label: '•', title: 'Bulleted list', apply: (t, s) => prefixLines(t, s, '- ') },
    { label: '1.', title: 'Numbered list', apply: (t, s) => prefixLines(t, s, (i) => `${i + 1}. `) },
    { label: '☑', title: 'Checklist', apply: (t, s) => prefixLines(t, s, '- [ ] ') },
  ],
  [
    { label: '</>', title: 'Inline code', shortcut: 'e', apply: (t, s) => wrapSelection(t, s, '`', 'code') },
    { label: '```', title: 'Code block (Tab indents inside)', apply: (t, s) => insertFencedCode(t, s) },
    { label: '🔗', title: 'Link', shortcut: 'k', apply: wrapLink },
    { label: '⊞', title: 'Table', apply: (t, s) => insertBlock(t, s, TABLE_TEMPLATE) },
  ],
];

const SHORTCUTS = new Map(
  TOOL_GROUPS.flat()
    .filter((tool) => tool.shortcut)
    .map((tool) => [tool.shortcut as string, tool]),
);

const TOOL_BUTTON =
  'rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

/** Markdown textarea with a formatting toolbar and a preview tab. */
export function MarkdownEditor({ id, value, onChange, placeholder, rows = 5, error }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const applyResult = (result: EditResult) => {
    const ta = ref.current;
    onChange(result.text);
    // Restore focus and the selection once React has flushed the new value.
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(result.start, result.end);
    });
  };

  const run = (tool: Tool) => {
    const ta = ref.current;
    const sel = ta
      ? { start: ta.selectionStart, end: ta.selectionEnd }
      : { start: value.length, end: value.length };
    applyResult(tool.apply(value, sel));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const collapsed = ta.selectionStart === ta.selectionEnd;
    // Enter inside a list keeps the list going (1. → 2., - → -, - [ ] → - [ ]).
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && collapsed) {
      const result = continueList(value, ta.selectionStart);
      if (result) {
        e.preventDefault();
        applyResult(result);
      }
      return;
    }
    // Tab inside a code fence indents instead of leaving the field.
    if (e.key === 'Tab' && !e.shiftKey && insideFence(value, ta.selectionStart)) {
      e.preventDefault();
      const pos = ta.selectionStart;
      applyResult({
        text: `${value.slice(0, pos)}  ${value.slice(ta.selectionEnd)}`,
        start: pos + 2,
        end: pos + 2,
      });
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const tool = SHORTCUTS.get(e.key.toLowerCase());
    if (!tool) return;
    e.preventDefault();
    run(tool);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-0.5">
        {TOOL_GROUPS.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />}
            {group.map((tool) => (
              <button
                key={tool.title}
                type="button"
                title={tool.shortcut ? `${tool.title} (Ctrl+${tool.shortcut.toUpperCase()})` : tool.title}
                aria-label={tool.title}
                disabled={preview}
                onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
                onClick={() => run(tool)}
                className={cn(TOOL_BUTTON, preview && 'opacity-40')}
              >
                {tool.label}
              </button>
            ))}
          </Fragment>
        ))}
        <div className="ml-auto flex gap-0.5">
          {(['Write', 'Preview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPreview(tab === 'Preview')}
              className={cn(
                TOOL_BUTTON,
                'font-sans font-medium',
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
          spellCheck={false}
          className={cn(
            'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:border-slate-600 dark:focus:ring-white/10',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-500/10',
          )}
        />
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!preview && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Markdown: **bold**, _italic_, - list, - [ ] checklist, `code`, ```js … ``` block, | table |
        </p>
      )}
    </div>
  );
}
