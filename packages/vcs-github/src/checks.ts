import type { AwaitAllChecksResult, CheckRun } from '@autogate/contracts';

const passingConclusions = new Set(['success', 'neutral', 'skipped']);

export const isPassingConclusion = ({ conclusion }: { conclusion: string }): boolean =>
  passingConclusions.has(conclusion);

const incompleteConclusions = new Set(['', 'pending', 'queued', 'in_progress', 'waiting', 'requested']);

export const isCompleteConclusion = ({ conclusion }: { conclusion: string }): boolean =>
  !incompleteConclusions.has(conclusion);

export const evaluateChecks = ({
  checks,
  required,
}: {
  checks: CheckRun[];
  required: 'all' | string[];
}): AwaitAllChecksResult => {
  const relevant =
    required === 'all' ? checks : checks.filter((check) => required.includes(check.name));
  const allPassed = relevant.every((check) => isPassingConclusion({ conclusion: check.conclusion }));
  return { allPassed, checks: relevant };
};

export const requiredAreComplete = ({
  checks,
  required,
}: {
  checks: CheckRun[];
  required: 'all' | string[];
}): boolean => {
  const relevant =
    required === 'all' ? checks : checks.filter((check) => required.includes(check.name));
  const presentNames = new Set(relevant.map((check) => check.name));
  const missing = required === 'all' ? [] : required.filter((name) => !presentNames.has(name));
  return (
    missing.length === 0 &&
    relevant.length > 0 &&
    relevant.every((check) => isCompleteConclusion({ conclusion: check.conclusion }))
  );
};

/**
 * GitHub exposes two parallel notions of CI signal on a commit: modern "check runs"
 * (Actions, bugbot, coderabbit, etc.) and the legacy "commit statuses" (some bots
 * still post via the Statuses API). Both gate a merge, so we merge them into one list,
 * preferring the latest check run for a given name.
 */
export const combineCheckRuns = ({
  checkRuns,
  statuses,
}: {
  checkRuns: CheckRun[];
  statuses: CheckRun[];
}): CheckRun[] => {
  const byName = [...statuses, ...checkRuns].reduce<Map<string, CheckRun>>(
    (acc, check) => acc.set(check.name, check),
    new Map<string, CheckRun>(),
  );
  return [...byName.values()];
};
