import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import type { Dashboard } from '@/types/api';

const REPORT: Dashboard = {
  days: 7,
  open: 3,
  overdue: 1,
  completed: 4,
  created: 6,
  by_status: { todo: 2, in_progress: 1, closed: 4 },
  per_day: [
    { day: '2026-09-09', completed: 0, created: 2 },
    { day: '2026-09-10', completed: 4, created: 1 },
    { day: '2026-09-11', completed: 0, created: 3 },
  ],
  people: [
    { user_id: 'u1', email: 'a@x.io', full_name: 'Ada', open: 2, overdue: 1, completed: 3, estimated_open_minutes: 90, logged_minutes: 125 },
  ],
  active_sprint: { id: 's1', name: 'Sprint 3', end_date: '2026-09-20', total: 4, finished: 1 },
};

vi.mock('@/api/reports', () => ({ reportsApi: { dashboard: vi.fn(async () => REPORT) } }));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('scales bars to the busiest day and lists people, status and sprint', async () => {
    renderPage();
    const chart = await screen.findByRole('img', { name: /completed and created/i });
    const bars = Array.from(chart.querySelectorAll('span[style]')) as HTMLElement[];
    const heights = bars.map((b) => parseInt(b.style.height, 10));
    expect(heights).toHaveLength(6);
    expect(Math.max(...heights)).toBe(112); // completed=4 on the busiest day fills the plot (120 - 8)
    expect(heights[0]).toBe(2); // zero stays a 2px stub
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('2h 5m')).toBeInTheDocument();
    expect(screen.getByText('Sprint 3')).toBeInTheDocument();
    expect(screen.getByText('1/4 finished')).toBeInTheDocument();
  });
});
