import type { StoreSeed, StoredRun } from "@autogate/contracts";

/**
 * Demo fixture data for the in-memory `Store`. These are system-of-record
 * `StoredRun`s (no derived decision/risk — the orchestrator computes those,
 * ticket 01). Replaced by real runs once the orchestrator writes to the Store.
 */
const runs: StoredRun[] = [
  {
    runId: "run_01",
    pr: {
      number: 482,
      title: "Copy tweak on pricing page",
      repo: "askable-services",
      author: "tyron",
      url: "https://github.com/askable/askable-services/pull/482",
      branch: "copy/pricing-tweak",
      baseRef: "main",
      headRef: "copy/pricing-tweak",
      headSha: "a1b2c3d",
      description: "Fix a typo and tighten the pricing page headline.",
    },
    status: "completed",
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
      baseRef: "main",
      headRef: "auth/token-rotation",
      headSha: "e4f5a6b",
      description: "Rotate session tokens on privilege change.",
    },
    status: "completed",
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
      baseRef: "main",
      headRef: "feat/await-all-checks",
      headSha: "c7d8e9f",
      description: "Poll check_suite until all required checks complete.",
    },
    status: "running",
    createdAt: "2026-06-13T11:30:00.000Z",
    updatedAt: "2026-06-13T11:31:00.000Z",
  },
];

export const storeSeed: StoreSeed = { runs };
