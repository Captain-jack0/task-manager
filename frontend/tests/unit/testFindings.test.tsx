import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestFindings } from '@/features/tasks/TestFindings';
import {
  isTestReport,
  latestFindings,
  parseFindings,
  stripFindings,
} from '@/features/tasks/testReport';
import type { Comment, Task, TaskListResponse } from '@/types/api';

const REPORT =
  '_Otomatik test raporu (GitHub Actions)_\n\n## Test raporu — #7\n\n**Sonuç:** 1/2 geçti.';
const FINDING = {
  criterion: 'Boş başlık reddedilir',
  test: 'test_empty_title',
  reason: '422 yerine 500 döndü',
};
const BODY = `${REPORT}\n\n<!-- task-test-findings ${JSON.stringify([FINDING])} -->`;
const ALL_PASSED = `${REPORT}\n\n<!-- task-test-findings [] -->`;

const { create } = vi.hoisted(() => ({ create: vi.fn(async () => ({})) }));
vi.mock('@/api/tasks', () => ({
  tasksApi: {
    list: vi.fn(
      async () =>
        ({
          data: [{ id: 's1', title: 'Liste tarihe göre sıralı', status: 'todo' }],
          total: 1,
        }) as unknown as TaskListResponse,
    ),
    create: (...args: unknown[]) => create(...args),
  },
}));

describe('test findings parsing', () => {
  it('parses the hidden block, strips it from the report and picks the latest run', () => {
    expect(isTestReport(BODY)).toBe(true);
    expect(isTestReport('plain comment')).toBe(false);
    expect(parseFindings(BODY)).toEqual([FINDING]);
    expect(stripFindings(BODY)).toBe(REPORT);
    expect(parseFindings('plain comment')).toBeNull();
    expect(parseFindings(ALL_PASSED)).toEqual([]);
    expect(parseFindings(`${REPORT}\n\n<!-- task-test-findings [not json] -->`)).toBeNull();

    const comments = [
      { id: 'c1', body: BODY },
      { id: 'c2', body: 'hi' },
      { id: 'c3', body: ALL_PASSED },
    ] as Comment[];
    expect(latestFindings(comments)).toEqual({ commentId: 'c3', findings: [] });
    expect(latestFindings([{ id: 'c2', body: 'hi' }] as Comment[])).toBeNull();
  });
});

describe('TestFindings', () => {
  const TASK = { id: 't1', workspace_id: 'w1', project_id: 'p1', sprint_id: null } as unknown as Task;

  function renderPanel(findings = [FINDING, { criterion: 'Liste tarihe göre sıralı', test: '', reason: '' }]) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <TestFindings task={TASK} findings={findings} />
      </QueryClientProvider>,
    );
  }

  it('marks findings that already have a subtask and adds the rest on click', async () => {
    renderPanel();
    const added = await screen.findByRole('button', { name: 'Added' });
    expect(added).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add as subtask' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({
      title: FINDING.criterion,
      description: 'Test: test_empty_title\n\n422 yerine 500 döndü',
      parent_id: 't1',
      project_id: 'p1',
    });
    expect(create.mock.calls[0][1]).toBe('w1');
  });

  it('says so when every criterion passed', () => {
    renderPanel([]);
    expect(screen.getByText('All criteria passed.')).toBeInTheDocument();
  });
});
