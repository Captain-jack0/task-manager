import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestAutomationGuide } from '@/features/integrations/TestAutomationGuide';
import { buildSetupCommands } from '@/features/integrations/testAutomation';

describe('buildSetupCommands', () => {
  it('emits one block per distinct repo with the token and API URL', () => {
    const out = buildSetupCommands(
      ['octocat/hello', 'octocat/world', 'octocat/hello'],
      'tok123',
      'https://api.example.com',
    );
    expect(out.match(/# octocat\/hello/g)).toHaveLength(1);
    expect(out).toContain('TASK_MANAGER_REPORT_SECRET -R octocat/world -b "tok123"');
    expect(out).toContain('TASK_MANAGER_URL -R octocat/hello -b "https://api.example.com"');
  });
});

describe('TestAutomationGuide', () => {
  it('shows both steps and copies the secrets commands', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <TestAutomationGuide
        repos={['octocat/hello']}
        reportToken="tok123"
        apiBaseUrl="https://api.example.com"
      />,
    );
    expect(screen.getByText('1. Add this workflow file to each repo')).toBeInTheDocument();
    expect(screen.getByText(/uses: Captain-jack0\/task-manager/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copy: 2. Add the secrets' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('-b "tok123"'));
  });
});
