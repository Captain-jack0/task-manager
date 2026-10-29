import type { Comment } from '@/types/api';

/** One criterion the task-test workflow could not get to pass. */
export interface TestFinding {
  criterion: string;
  test: string;
  reason: string;
}

/** Prefix the backend puts on every comment that came from the test workflow. */
const REPORT_PREFIX = '_Otomatik test raporu';
// The workflow appends the findings as a hidden block at the very end of the report.
const MARKER = /\n*<!-- task-test-findings (\[[\s\S]*?\]) -->\s*$/;

export function isTestReport(body: string): boolean {
  return body.startsWith(REPORT_PREFIX);
}

/** The report without its hidden findings block. */
export function stripFindings(body: string): string {
  return body.replace(MARKER, '');
}

/** Findings carried by a report, `[]` when everything passed, null when the body has none. */
export function parseFindings(body: string): TestFinding[] | null {
  const match = MARKER.exec(body);
  if (!match) return null;
  try {
    const raw: unknown = JSON.parse(match[1]);
    if (!Array.isArray(raw)) return null;
    return raw
      .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
      .map((f) => ({
        criterion: String(f.criterion ?? '').trim(),
        test: String(f.test ?? '').trim(),
        reason: String(f.reason ?? '').trim(),
      }))
      .filter((f) => f.criterion);
  } catch {
    return null;
  }
}

/** The newest report's findings; earlier runs are superseded. Comments come oldest first. */
export function latestFindings(
  comments: readonly Comment[],
): { commentId: string; findings: TestFinding[] } | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const findings = parseFindings(comments[i].body);
    if (findings) return { commentId: comments[i].id, findings };
  }
  return null;
}
