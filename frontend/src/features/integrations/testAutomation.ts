/** Caller workflow a repo adds to run task tests (see task-manager README). */
export const TASK_TEST_WORKFLOW = `name: task-test
on:
  issues: { types: [labeled] }
  pull_request: { types: [opened, synchronize, reopened] }
permissions: { contents: write, issues: write, pull-requests: write }
jobs:
  test:
    uses: Captain-jack0/task-manager/.github/workflows/task-test.yml@dev
    secrets: inherit
`;

/** GitHub CLI commands that wire each repo to this account's test reports. */
export function buildSetupCommands(
  repos: readonly string[],
  reportToken: string,
  apiBaseUrl: string,
): string {
  return [...new Set(repos)]
    .map((repo) =>
      [
        `# ${repo}`,
        `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R ${repo}`,
        `gh secret set TASK_MANAGER_REPORT_SECRET -R ${repo} -b "${reportToken}"`,
        `gh variable set TASK_MANAGER_URL -R ${repo} -b "${apiBaseUrl}"`,
      ].join('\n'),
    )
    .join('\n\n');
}
