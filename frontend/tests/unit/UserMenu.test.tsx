import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UserMenu } from '@/components/UserMenu';

function renderMenu(onSignOut = vi.fn(), onOpenGithub = vi.fn()) {
  render(
    <MemoryRouter>
      <UserMenu
        user={{ email: 'ada@example.com', full_name: 'Ada Lovelace' }}
        githubConnected
        onOpenCalendar={vi.fn()}
        onOpenGithub={onOpenGithub}
        onSignOut={onSignOut}
      />
    </MemoryRouter>,
  );
}

describe('UserMenu', () => {
  it('shows the name, keeps the menu closed until clicked, and runs the picked action', async () => {
    const onSignOut = vi.fn();
    const onOpenGithub = vi.fn();
    renderMenu(onSignOut, onOpenGithub);
    expect(screen.getByTestId('user-name')).toHaveTextContent('Ada Lovelace');
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('menuitem', { name: /github integration/i }));
    expect(onOpenGithub).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
