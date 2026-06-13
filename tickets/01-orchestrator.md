---
id: 01-orchestrator
title: Orchestrator + decide/policy
stream: A
depends_on: [00-contracts]
phase: 1
---

# 01 — Orchestrator + decide/policy

## Goal
The core domain loop: receive a run, fan out applicable `CheckSource`s, synthesize their `Verdict`s, and produce a `Decision` (auto-merge | escalate | block) with a risk score and, when escalating, a human **brief**. Pure logic over ports — imports no concrete adapter.

## Owns
`packages/orchestrator` — `runPipeline`, `decide`, `buildBrief`, risk aggregation.

## Consumes (ports, injected)
`VcsProvider`, `SandboxRunner`, `Store`, `Queue`, `MemoryClient`, the `CheckSource` registry, and `Policy`.

## Deliverables
- `runPipeline({ ports }) => (runId) => Promise<RunDetail>`: claim job → build `RunContext` → `registry.filter(appliesTo)` → run sources (L1 fail-fast before L2/L3) → persist verdicts → `decide` → post status/brief via `VcsProvider`.
- `decide({ verdicts, policy }) => Decision`: aggregate `riskContribution`, apply `riskEscalateThreshold`, `escalateOnDisagreement`, `alwaysEscalatePaths`.
- `buildBrief({ pr, verdicts }) => string`: the "what to look at and why" summary for escalations.
- Layer ordering + fail-fast: static failures short-circuit the run.

## Definition of Done
- End-to-end eval (ticket 12) over labeled fixture PRs against **mocks** passes: final decision matches ground truth on the fixture set.
- Unit tests for `decide` cover: low-risk agree → auto_merge; disagreement → escalate; sensitive path → escalate; static fail → blocked.
- No import of any adapter package (lint rule / review check).

## Notes
- `decide` is data-driven via `Policy`; do not hardcode thresholds.
- Keep `runPipeline` free of provider-specific logic — all I/O via injected ports.
