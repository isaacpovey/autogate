---
id: 11-dashboard
title: Dashboard (Next.js)
stream: B
depends_on: [00-contracts]
phase: 1
---

# 11 — Dashboard

## Goal
The release-view UI: a designer is building this in Claude design against the `DashboardApi` contract. This ticket covers wiring it to the API (real + mock server) and the three surfaces.

## Owns
`apps/web` (the scaffold's Next.js app) — App Router + Tailwind + shadcn/ui, typed client generated from `DashboardApi`.

## Surfaces
1. **Release stream (home):** live table across both repos — PR, repo, risk, **gate status (Layer 1 GitHub checks incl. bugbot)**, Layer-2 check chips, decision. Status includes `awaiting_checks` (gate not yet green). Filters by repo/status. Live via `/api/stream` (SSE).
2. **Run detail:** decision + reasons + brief, the raw **`gateChecks`** (Layer 1 GitHub checks with conclusions/links), every Layer-2 `CheckResult`, monitoring panel. Live via `/api/runs/:id/stream`.
3. **Human override:** approve-merge / block + required reason → `POST /api/runs/:id/override`; rollback button → `POST /api/runs/:id/rollback`.
4. (If time) **Trust metric** chart from `/api/metrics` (agreement rate over time).

## Deliverables
- Typed API client + a **mock server** implementing `DashboardApi` (so UI dev needs no backend).
- The three surfaces wired to the contract.

## Definition of Done
- `pnpm turbo check-types` passes.
- Renders fully against the mock server (seeded runs covering all decision + `awaiting_checks` states).
- Swapping mock base-URL for the real API needs no component changes.
- Override + rollback POSTs hit the contract and optimistically update.

## Notes
- No auth for hackday.
- The override→memory→eval arrow is the trust story; keep the override reason field required.
- Cut: roles/multi-tenant/historical analytics beyond the trust chart.
