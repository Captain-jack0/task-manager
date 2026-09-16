import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MarkdownView } from '@/components/MarkdownView';

const TEXT = '## Plan\n**bold** _it_\n\n- [ ] write\n- [x] review\n- [ ] ship\n\n| a | b |\n| --- | --- |\n| 1 | 2 |';

describe('MarkdownView', () => {
  it('renders GFM: headings, emphasis, checklists and tables', () => {
    render(<MarkdownView text={TEXT} />);
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('never renders raw HTML', () => {
    render(<MarkdownView text={'<img src=x onerror="alert(1)">hi'} />);
    expect(document.querySelector('img')).toBeNull();
  });

  it('reports the document-order index of a clicked checkbox, even under StrictMode', async () => {
    const onToggle = vi.fn();
    render(
      <StrictMode>
        <MarkdownView text={TEXT} onToggleCheckbox={onToggle} />
      </StrictMode>,
    );
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Checklist item 1',
      'Checklist item 2',
      'Checklist item 3',
    ]);
    await userEvent.click(boxes[2]);
    expect(onToggle).toHaveBeenCalledWith(2, true);
    await userEvent.click(boxes[1]);
    expect(onToggle).toHaveBeenCalledWith(1, false);
  });

  it('keeps checkboxes disabled without a toggle handler', () => {
    render(<MarkdownView text={TEXT} />);
    expect(screen.getAllByRole('checkbox').every((b) => (b as HTMLInputElement).disabled)).toBe(true);
  });

  it('highlights fenced code and offers a Copy button', () => {
    render(<MarkdownView text={'```js\nconst a = 1;\n```\n\nand `inline`'} />);
    const block = document.querySelector('pre code');
    expect(block?.className).toContain('language-js');
    expect(block?.querySelectorAll('.hljs-keyword').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    // Inline code stays plain and outside <pre>.
    const inline = screen.getByText('inline');
    expect(inline.tagName).toBe('CODE');
    expect(inline.closest('pre')).toBeNull();
    expect(inline.className).toContain('bg-slate-100');
  });

  it('renders code with an unknown language without crashing', () => {
    render(<MarkdownView text={'```notalanguage\nhello\n```'} />);
    expect(screen.getByText('hello').closest('pre')).not.toBeNull();
  });
});
