import type { ListRunsInput, RunSummary } from "./schemas";

/**
 * ⚠️ SCAFFOLD ONLY — a minimal slice of the `Store` port (design spec §4).
 * The authoritative port interface ships from `@autogate/contracts` (ticket 00);
 * the real Postgres + Drizzle adapter ships from `store-postgres` (ticket 03).
 * Procedures depend on this interface, never on a concrete adapter, so either
 * can be swapped in without touching the router.
 */
export type StorePort = {
  listRuns: (input: ListRunsInput) => Promise<RunSummary[]>;
};

const seedRuns: RunSummary[] = [
  {
    runId: "run_01",
    pr: {
      number: 482,
      title: "Copy tweak on pricing page",
      repo: "askable-services",
      author: "tyron",
      url: "https://github.com/askable/askable-services/pull/482",
      branch: "copy/pricing-tweak",
    },
    status: "completed",
    decision: "auto_merge",
    riskScore: 8,
    gate: { total: 5, passed: 5, failed: 0, pending: 0 },
    checkSummary: { pass: 6, warn: 0, fail: 0, pending: 0 },
    createdAt: "2026-06-13T09:00:00.000Z",
    updatedAt: "2026-06-13T09:04:00.000Z",
  },
  {
    runId: "run_02",
    pr: {
      number: 483,
      title: "Refactor session token rotation",
      repo: "askable-services",
      author: "mei",
      url: "https://github.com/askable/askable-services/pull/483",
      branch: "auth/token-rotation",
    },
    status: "completed",
    decision: "escalate",
    riskScore: 72,
    gate: { total: 5, passed: 5, failed: 0, pending: 0 },
    checkSummary: { pass: 4, warn: 1, fail: 1, pending: 0 },
    createdAt: "2026-06-13T10:12:00.000Z",
    updatedAt: "2026-06-13T10:19:00.000Z",
  },
  {
    runId: "run_03",
    pr: {
      number: 17,
      title: "Add awaitAllChecks gate to vcs-github",
      repo: "autogate",
      author: "tyron",
      url: "https://github.com/askable/autogate/pull/17",
      branch: "feat/await-all-checks",
    },
    status: "running",
    decision: "pending",
    riskScore: 31,
    gate: { total: 4, passed: 4, failed: 0, pending: 0 },
    checkSummary: { pass: 2, warn: 0, fail: 0, pending: 4 },
    createdAt: "2026-06-13T11:30:00.000Z",
    updatedAt: "2026-06-13T11:31:00.000Z",
  },
];

/**
 * Deterministic in-memory `Store`. Filters the seed data the same way the real
 * adapter will, so the dashboard renders against a realistic shape from day one.
 */
export const mockStore: StorePort = {
  listRuns: async ({ repo, status, limit }) =>
    seedRuns
      .filter((run) => (repo ? run.pr.repo === repo : true))
      .filter((run) => (status ? run.status === status : true))
      .slice(0, limit),
};
