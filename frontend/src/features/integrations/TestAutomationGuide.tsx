import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { TASK_TEST_WORKFLOW, buildSetupCommands } from './testAutomation';

interface Props {
  /** Default repo plus every repo linked to a project. */
  repos: readonly string[];
  reportToken: string;
  apiBaseUrl: string;
}

/** Collapsible walkthrough shown once GitHub is connected: how to make each
 *  repo write and run tests for every task opened as an issue. */
export function TestAutomationGuide({ repos, reportToken, apiBaseUrl }: Props) {
  return (
    <details className="rounded-xl border border-slate-200 dark:border-slate-800">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Set up test automation
      </summary>
      <div className="space-y-4 border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          When a task's issue gets the <code>test</code> label (Auto-test on its project, or
          the task's Test button), Claude writes and runs tests for it in that repo
          and posts the report on the issue and here, as a comment on the task. Two steps,
          once per repo.
        </p>
        <Step
          title="1. Add this workflow file to each repo"
          hint=".github/workflows/task-test.yml"
          text={TASK_TEST_WORKFLOW}
        />
        <Step
          title="2. Add the secrets"
          hint="With the GitHub CLI, or paste the values under the repo's Settings → Secrets and variables → Actions."
          text={buildSetupCommands(repos, reportToken, apiBaseUrl)}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          CLAUDE_CODE_OAUTH_TOKEN comes from running <code>claude setup-token</code> on a Claude
          Pro or Max plan; with an Anthropic API key set ANTHROPIC_API_KEY instead. Each run is
          billed to that account, not to Task Manager.
        </p>
      </div>
    </details>
  );
}

interface StepProps {
  title: string;
  hint: string;
  text: string;
}

function Step({ title, hint, text }: StepProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy — select the text and copy it manually');
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Button variant="secondary" size="sm" onClick={copy} aria-label={`Copy: ${title}`}>
          Copy
        </Button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs leading-relaxed dark:bg-slate-800">
        <code>{text}</code>
      </pre>
    </div>
  );
}
