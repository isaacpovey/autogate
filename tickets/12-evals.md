---
id: 12-evals
title: Eval harness + fixtures
stream: B
depends_on: [00-contracts]
phase: 1
---

# 12 — Evals harness + fixtures

## Goal
Two-tier eval system that lets agents self-verify and measures orchestrator accuracy — the acceptance gate for nearly every other ticket.

## Owns
`packages/evals` — Vitest harness, fixture loader, scorers, labeled fixture PRs.

## Deliverables
- **Per-agent eval runner:** loads `agents/<id>/evals/*.json` (fixture PR + expected verdict labels), runs the agent against `AgentSdk` (real or mock), scores status / risk-band / key findings, prints pass-rate. Backs `pnpm agent eval <id>`.
- **End-to-end eval runner:** replays labeled fixture PRs through the orchestrator against **all mocks**; asserts final `Decision` vs ground truth; reports **escalation precision** (false escalations) and **recall** (missed escalations).
- **Fixture set:** the seeded demo PRs (clean / risky / security-disagreement / regressing) plus a handful of override cases.
- Scorers tolerant to phrasing (assert structured fields, not prose).

## Definition of Done
- `pnpm eval` runs both tiers headless with zero infra (all mocks).
- Reports per-agent pass-rates + orchestrator precision/recall on the fixture set.
- An override fixture demonstrates the precedent-retrieval path changing a verdict.

## Notes
- This harness IS the DoD for tickets 01, 08, 09, 10 — build the runner early in stream B.
- Overrides captured at runtime should be exportable into new fixtures (closes the trust loop).
