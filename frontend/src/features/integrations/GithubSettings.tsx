import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { baseURL, extractErrorMessage } from '@/api/client';
import { useProjects } from '@/features/projects/useProjects';
import { useWorkspaceStore } from '@/features/workspaces/workspaceStore';
import { TestAutomationGuide } from './TestAutomationGuide';
import { useConnectGithub, useDisconnectGithub, useGithubStatus } from './useGithub';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** GitHub-integration modal; opened from the account menu. */
export function GithubSettings({ open, onClose }: Props) {
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('');
  const { data: status } = useGithubStatus();
  const connect = useConnectGithub();
  const disconnect = useDisconnectGithub();

  const connected = status?.connected ?? false;
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const { data: projects } = useProjects(workspaceId);
  // Every repo issues can land in: the default plus each project's own.
  const repos = [status?.repo, ...(projects ?? []).map((p) => p.github_repo)].filter(
    (r): r is string => Boolean(r),
  );

  const handleConnect = () => {
    if (!token.trim() || !repo.trim()) return;
    connect.mutate(
      { token: token.trim(), repo: repo.trim() },
      {
        onSuccess: () => {
          toast.success('GitHub connected');
          setToken('');
          setRepo('');
          onClose();
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not connect GitHub')),
      },
    );
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success('GitHub disconnected'),
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not disconnect')),
    });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="GitHub integration">
        {connected ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Connected to <span className="font-medium">{status?.repo}</span>. Open any task as
              an issue from its detail page: it lands in the repo linked to the task's project,
              or in this default repo. The token must have{' '}
              <span className="font-medium">Issues: write</span> on every one of those repos —
              linking a project to a repo the token cannot see is refused.
            </p>
            {status?.report_token && (
              <TestAutomationGuide
                repos={repos}
                reportToken={status.report_token}
                apiBaseUrl={baseURL}
              />
            )}
            <Button variant="danger" onClick={handleDisconnect} isLoading={disconnect.isPending}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paste a GitHub personal access token with <span className="font-medium">Issues:
              write</span> access to the repo, plus the default repository. Grant the same
              access on any repo you later link to a project — issues for that project's
              tasks open there. The token is stored only on the server and never shown again.
            </p>
            <a
              href="https://github.com/settings/personal-access-tokens"
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-medium text-slate-900 underline underline-offset-2 dark:text-white"
            >
              Create a token on GitHub →
            </a>
            <Input
              label="Repository (owner/repo)"
              placeholder="octocat/hello-world"
              hint="Just owner/repo — you can also paste the full repo URL."
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <Input
              label="Personal access token"
              type="password"
              placeholder="github_pat_… or ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                isLoading={connect.isPending}
                disabled={!token.trim() || !repo.trim()}
              >
                Connect
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
