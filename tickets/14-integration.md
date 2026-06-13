---
id: 14-integration
title: Integration + demo
stream: shared
depends_on: [01,02,03,04,05,06,07,08,09,10,11,12,13]
phase: 2
---

# 14 — Integration + demo

## Goal
Swap mocks for real adapters, boot the whole system on EC2, run both demo repos end-to-end, and author the seeded PRs that drive the demo narrative.

## Deliverables
- Wire real adapters into the orchestrator (replace mocks): GitHub, Docker sandbox, Postgres, Qdrant, Datadog, Claude SDK.
- Boot on a fresh EC2 box via `setup.sh`; confirm dashboard + workers healthy.
- Register the GitHub App on both `askable-services` and `autogate`; **confirm both repos have GitHub checks + bugbot enabled** (the Layer 1 gate is only meaningful if they do).
- Author + open the **seeded demo PRs**:
  1. Clean copy tweak → all GitHub checks green → agents pass → **auto-merge**.
  2. Risky/high-blast-radius change → checks green → agents agree → merges with monitoring.
  3. Sensitive-path change → checks green, but **security + architecture agents flag** → **escalate w/ brief** → human override w/ reason → captured to memory + eval.
  4. Regressing change → merged → **Datadog** flags new errors → **rollback**.

## Definition of Done
- `pnpm turbo check-types` passes across the monorepo.
- Each of the four demo PRs produces the intended decision live in the dashboard, on a real box.
- Dogfood: a freshly opened PR on `autogate` itself is reviewed by the system once its own checks go green.
- One override visibly feeds the `decisions` memory + eval set.

## Notes
- The top risk is now `awaitAllChecks` latency (bugbot/CI can be slow) — verify the gate resolves promptly when checks complete and doesn't hold a worker.
- Rehearse the demo run order; keep a deterministic fallback (synthetic Datadog feed) if live signals are flaky.
