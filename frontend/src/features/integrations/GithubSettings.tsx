import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { extractErrorMessage } from '@/api/client';
import { useConnectGithub, useDisconnectGithub, useGithubStatus } from './useGithub';

export function GithubSettings() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('');
  const { data: status } = useGithubStatus();
  const connect = useConnectGithub();
  const disconnect = useDisconnectGithub();

  const connected = status?.connected ?? false;

  const handleConnect = () => {
    if (!token.trim() || !repo.trim()) return;
    connect.mutate(
      { token: token.trim(), repo: repo.trim() },
      {
        onSuccess: () => {
          toast.success('GitHub connected');
          setToken('');
          setRepo('');
          setOpen(false);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="GitHub integration"
        className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 sm:inline-flex sm:items-center sm:gap-1.5 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span className={connected ? 'text-emerald-500' : 'text-slate-400'}>●</span>
        GitHub
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="GitHub integration">
        {connected ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Connected to <span className="font-medium">{status?.repo}</span>. Open any task as
              an issue from its detail page.
            </p>
            <Button variant="danger" onClick={handleDisconnect} isLoading={disconnect.isPending}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paste a GitHub personal access token with <span className="font-medium">issues:
              write</span> access and the target repository. The token is stored only on the
              server and never shown again.
            </p>
            <Input
              label="Repository (owner/repo)"
              placeholder="octocat/hello-world"
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
              <Button variant="secondary" onClick={() => setOpen(false)}>
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
