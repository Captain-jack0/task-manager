import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BurndownChart } from '@/features/sprints/BurndownChart';

const POINTS = [
  { day: '2026-09-07', remaining: 4, ideal: 4 },
  { day: '2026-09-08', remaining: 3, ideal: 2 },
  { day: '2026-09-09', remaining: null, ideal: 0 },
];

describe('BurndownChart', () => {
  it('draws the ideal line through every day and the actual line through measured days only', () => {
    render(<BurndownChart points={POINTS} />);
    const svg = screen.getByRole('img', { name: 'Sprint burndown' });
    const ideal = svg.querySelector('[data-series="ideal"]')!.getAttribute('points')!.split(' ');
    const actual = svg.querySelector('[data-series="remaining"]')!.getAttribute('points')!.split(' ');
    expect(ideal).toHaveLength(3);
    expect(actual).toHaveLength(2);
    // 4 remaining sits on the top of the plot, ideal 0 on the baseline
    const top = Number(actual[0].split(',')[1]);
    const baseline = Number(ideal[2].split(',')[1]);
    expect(top).toBeLessThan(baseline);
    expect(svg.querySelectorAll('circle')).toHaveLength(2);
    expect(svg.querySelectorAll('title')).toHaveLength(3);
  });

  it('renders nothing without points', () => {
    const { container } = render(<BurndownChart points={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
