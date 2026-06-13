---
id: 12-evals
title: Eval harness + fixtures
stream: B
depends_on: [00-contracts]
phase: 1
---

# 12 — Evals harness + fixtures

## Goal
A lightweight, two-tier eval system that is **the verification mechanism for agent and orchestrator behavior** (how an agent proves it works after a change) and demonstrates the trust loop. Focused fixtures, not exhaustive coverage.

## Owns
`packages/evals` — a small `tsx`-runnable harness (no test framework), fixture loader, scorers, labeled fixture PRs.

## Deliverables
- **Per-agent eval runner:** loads `agents/<id>/evals/*.json` (fixture PR + expected verdict labels), runs the agent against `AgentSdk` (real or mock), scores status / risk-band / key findings, prints pass-rate. Backs `pnpm agent eval <id>`.
- **End-to-end eval runner:** replays labeled fixture PRs through the orchestrator against **all mocks** (gate forced green); prints final `Decision` vs ground truth and escalation **precision/recall**.
- **Fixture set:** the seeded demo PRs (clean / risky / flagged / regressing) plus a couple of override cases.
- Scorers assert structured fields, not prose.

## Definition of Done
- `pnpm turbo check-types` passes.
- `pnpm eval` runs both tiers headless with zero infra (all mocks) and prints a readable report.
- An override fixture demonstrates the precedent-retrieval path changing a verdict.

## Notes
- Build the per-agent runner early — agents (ticket 08) use it to verify their work as they iterate.
- Keep fixtures focused (a handful per agent); this is verification, not exhaustive coverage.
- Overrides captured at runtime should be exportable into new fixtures (closes the trust loop).
