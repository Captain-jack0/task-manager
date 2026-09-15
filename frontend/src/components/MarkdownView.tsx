import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';
import { checkboxLines } from '@/lib/markdown';

interface Props {
  text: string;
  className?: string;
  /** When given, checklist boxes become clickable; `n` is the checkbox's document-order index. */
  onToggleCheckbox?: (n: number, checked: boolean) => void;
}

interface CheckboxSlot {
  /** Document-order index of the checkbox inside this list item, -1 when unknown. */
  index: number;
  onToggle?: (n: number, checked: boolean) => void;
}

// The list item knows its source line; the checkbox inside it reads the slot
// from context. Deterministic, unlike a render counter (StrictMode renders twice).
const CheckboxContext = createContext<CheckboxSlot>({ index: -1 });

// Lets the `code` renderer tell a fenced block (inside <pre>) from inline code.
const InPreContext = createContext(false);

function TaskCheckbox({ checked }: { checked?: boolean }) {
  const { index, onToggle } = useContext(CheckboxContext);
  const interactive = Boolean(onToggle) && index >= 0;
  return (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled={!interactive}
      onChange={() => onToggle?.(index, !checked)}
      aria-label={`Checklist item ${index + 1}`}
      className={cn('mt-1 shrink-0 accent-slate-900 dark:accent-white', interactive && 'cursor-pointer')}
    />
  );
}

/** Fenced code block with a hover "Copy" button. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText ?? '');
      setState('copied');
    } catch {
      // Clipboard unavailable (insecure context / permission denied).
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  };

  return (
    <div className="group relative my-2">
      <pre
        ref={ref}
        className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs leading-relaxed dark:bg-slate-800"
      >
        <InPreContext.Provider value>{children}</InPreContext.Provider>
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        className="absolute right-2 top-2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 opacity-0 transition-opacity hover:text-slate-900 focus-visible:opacity-100 group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
      </button>
    </div>
  );
}

function Code({ className, children }: { className?: string; children?: ReactNode }) {
  const inPre = useContext(InPreContext);
  if (inPre) return <code className={cn('font-mono', className)}>{children}</code>;
  return (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-slate-800">{children}</code>
  );
}

/** Renders task Markdown (GFM: tables, checklists, strikethrough; highlighted code). Raw HTML is never rendered. */
export function MarkdownView({ text, className, onToggleCheckbox }: Props) {
  const lines = useMemo(() => checkboxLines(text), [text]);

  const components: Components = {
    h1: ({ children }) => <h3 className="mt-3 text-base font-semibold">{children}</h3>,
    h2: ({ children }) => <h3 className="mt-3 text-base font-semibold">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-2 text-sm font-semibold">{children}</h4>,
    p: ({ children }) => <p className="my-1.5">{children}</p>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white"
      >
        {children}
      </a>
    ),
    ul: ({ children, className: c }) => (
      <ul className={cn('my-1.5 list-disc pl-5', c?.includes('contains-task-list') && 'list-none pl-1')}>
        {children}
      </ul>
    ),
    ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
    li: ({ node, children, className: c }) => {
      const isTask = Boolean(c?.includes('task-list-item'));
      const line = node?.position?.start.line;
      const index = isTask && line != null ? lines.indexOf(line) : -1;
      return (
        <CheckboxContext.Provider value={{ index, onToggle: onToggleCheckbox }}>
          <li className={cn('my-0.5', isTask && 'flex items-start gap-2')}>{children}</li>
        </CheckboxContext.Provider>
      );
    },
    input: TaskCheckbox,
    code: Code,
    pre: CodeBlock,
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-500 dark:border-slate-600 dark:text-slate-400">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-slate-200 bg-slate-50 px-2 py-1 font-semibold dark:border-slate-700 dark:bg-slate-800">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">{children}</td>,
    hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
  };

  return (
    <div className={cn('text-sm leading-relaxed text-slate-700 dark:text-slate-300', className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {text}
      </Markdown>
    </div>
  );
}
