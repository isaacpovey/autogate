---
id: 01-orchestrator
title: Orchestrator + decide/policy
stream: A
depends_on: [00-contracts]
phase: 1
---

# 01 — Orchestrator + decide/policy

## Goal
The core domain loop: when a PR's existing GitHub checks are all green (Layer 1 gate), fan out the Layer-2 AI agents, synthesize their `Verdict`s, and produce a `Decision` (auto-merge | escalate | block) with a risk score and, when escalating, a human **brief**. Pure logic over ports — imports no concrete adapter.

## Owns
`apps/api` (API + worker) — `runPipeline`, `decide`, `buildBrief`, risk aggregation. The tRPC server is already scaffolded here (serves `@autogate/api`'s `appRouter` over the standalone adapter); this ticket adds the orchestrator domain loop behind it and backs the `DashboardApi` procedures with real data.

## Consumes (ports, injected)
`VcsProvider`, `SandboxRunner`, `Store`, `Queue`, `MemoryClient`, the `CheckSource` registry, and `Policy`.

## Deliverables
- `runPipeline({ ports }) => (runId) => Promise<RunDetail>`:
  1. **Layer 1 gate** — `vcs.awaitAllChecks({ pr, required })`; if not all green → status `awaiting_checks` / `blocked`, stop.
  2. Build `RunContext` (clone via sandbox for repo read).
  3. Run Layer-2 agents: `registry.filter(s => s.layer==='ai' && s.appliesTo(ctx))`, `Promise.all`.
  4. Persist verdicts → `decide` → post status/brief via `VcsProvider`.
- `decide({ verdicts, gate, policy }) => Decision`: aggregate `riskContribution`, apply `riskEscalateThreshold`, `escalateOnDisagreement`, `alwaysEscalatePaths`.
- `buildBrief({ pr, verdicts }) => string`: the "what to look at and why" summary for escalations.
- Implement the real `DashboardApi` provider (the port in `@autogate/contracts`) backed by the `Store` + orchestrator outputs, and inject it in `apps/api/src/index.ts` in place of `createMockDashboardApi()` — a **one-line swap**. The tRPC router (`@autogate/api`, spec §6) already delegates every procedure (`listRuns`/`getRun`/`metrics`/`repos`/`override`/`rollback`) to the injected provider, so no router, procedure, or dashboard changes. This is where the derived view fields (decision, riskScore, gate/check tallies) get computed from verdicts + check runs. Then add the `stream`/`runs.onUpdate` SSE subscriptions (additive — no shape changes).

## Definition of Done
- `pnpm turbo check-types` passes; no import of any adapter package (enforced by lint/review).
- Run the pipeline against **mocks** (mock VcsProvider returns all-green + canned agent verdicts) and verify correct decisions: low-risk agree → auto_merge; disagreement → escalate; sensitive path → escalate; gate not green → awaiting_checks/blocked. Confirm by running the e2e eval (ticket 12) on the fixture set.

## Notes
- `decide` is data-driven via `Policy`; do not hardcode thresholds.
- Keep `runPipeline` free of provider-specific logic — all I/O via injected ports.
