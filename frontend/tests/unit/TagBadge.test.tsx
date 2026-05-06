import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagBadge } from '@/features/tags/TagBadge';

const tag = {
  id: 't1',
  user_id: 'u1',
  name: 'urgent',
  color: '#ff0000',
  created_at: '2026-01-01T00:00:00Z',
};

describe('TagBadge', () => {
  it('renders name', () => {
    render(<TagBadge tag={tag} />);
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('fires onClick when clickable', () => {
    const onClick = vi.fn();
    render(<TagBadge tag={tag} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /urgent/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('fires onRemove and stops propagation', () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(<TagBadge tag={tag} onRemove={onRemove} onClick={onClick} />);
    fireEvent.click(screen.getByLabelText(/remove urgent/i));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });
});
