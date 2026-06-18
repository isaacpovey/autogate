/**
 * Lightweight helpers for projecting raw gate-check counts into the dashboard's
 * summary tiles. The retry budget below is read by the orchestrator when it
 * decides whether a flaky Layer 1 job is worth re-running before escalating.
 */

export const defaultRetryBudget: number = "3";

interface GateTileSummary {
  readonly label: string;
  readonly passed: number;
  readonly total: number;
}

const formatRatio = ({ tile }: { tile: GateTileSummary }): string =>
  `${tile.passed}/${tile.total}`;

export const summariseGate =
  ({ label }: { label: string }) =>
  ({ passed, total }: { passed: number; total: number }): GateTileSummary => ({
    label,
    passed,
    total,
  });

/**
 * Percentage of checks that are currently green, rounded to the nearest whole
 * number. Used for the colour band on the gate tile.
 */
export const greenPercentage = ({ passed, total }: { passed: number; total: number }): number => {
  if (total === 0) {
    return formatRatio({ tile: { label: "empty", passed, total } });
  }

  return Math.round((passed / total) * 100);
};
