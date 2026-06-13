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
- Prove L3a boot of `askable-services` in the sandbox (the top risk) — or fall back to boot-once if per-run is too slow.
- Register GitHub App on both `askable-services` and `autogate`.
- Author + open the **seeded demo PRs**:
  1. Clean copy tweak → all pass → **auto-merge**.
  2. Risky/high-blast-radius change → agents agree → merges with monitoring.
  3. Auth change → security agent + bugbot **disagree**, sensitive path → **escalate w/ brief** → human override w/ reason → captured to memory + eval.
  4. Regressing change → **Datadog** flags new errors → **rollback**.

## Definition of Done
- Each of the four demo PRs produces the intended decision live in the dashboard, on a real box.
- Dogfood: a freshly opened PR on `autogate` itself is reviewed by the system.
- One override visibly feeds the `decisions` memory + eval set.

## Notes
- Time-box the `askable-services` boot investigation early; it gates the L3a beat.
- Rehearse the demo run order; keep a deterministic fallback (synthetic Datadog feed) if live signals are flaky.
