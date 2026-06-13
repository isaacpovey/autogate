---
id: 11-dashboard
title: Dashboard (Next.js)
stream: B
depends_on: [00-contracts]
phase: 1
---

# 11 — Dashboard

## Goal
The release-view UI: a designer is building this in Claude design against the `DashboardApi` contract. This ticket covers wiring it to the tRPC API and building the three surfaces.

## Owns
`apps/web` (the scaffold's Next.js app) — App Router + Tailwind + shadcn/ui. The tRPC + TanStack Query foundation is **already scaffolded** (`apps/web/trpc/*`: query-client factory, `TRPCReactProvider`, RSC server proxy + `HydrateClient`, `useTRPC`), consuming `@autogate/api`'s `AppRouter` type end-to-end via the modern `@trpc/tanstack-react-query` integration (`queryOptions` + native TanStack Query hooks — no legacy `useQuery` hooks). Build new surfaces on that.

## Surfaces
1. **Release stream (home):** live table across both repos — PR, repo, risk, **gate status (Layer 1 GitHub checks incl. bugbot)**, Layer-2 check chips, decision. Status includes `awaiting_checks` (gate not yet green). Filters by repo/status via `runs.list` input. Live via the `stream` subscription (tRPC SSE).
2. **Run detail:** decision + reasons + brief, the raw **`gateChecks`** (Layer 1 GitHub checks with conclusions/links), every Layer-2 `CheckResult`, monitoring panel. Query `runs.byId`; live via the `runs.onUpdate` subscription.
3. **Human override:** approve-merge / block + required reason → `runs.override` mutation; rollback button → `runs.rollback` mutation (use `useMutation(trpc.runs.override.mutationOptions())` + invalidate).
4. (If time) **Trust metric** chart from the `metrics` query (agreement rate over time).

## Deliverables
- New surfaces built on the existing typed tRPC client (prefetch in RSC + `useSuspenseQuery` on the client, per the scaffolded `app/page.tsx` pattern).
- No separate mock server needed: `apps/api` already serves `appRouter` over the in-memory mock store; UI dev runs against it (real adapters swap in via ticket 01/03 with no component changes).

## Definition of Done
- `pnpm turbo check-types` passes.
- Renders fully against `apps/api` (seeded runs covering all decision + `awaiting_checks` states).
- Swapping the in-memory store for the real adapters needs no component changes.
- Override + rollback mutations hit the router and optimistically update / invalidate.

## Notes
- No auth for hackday.
- The override→memory→eval arrow is the trust story; keep the override reason field required.
- Cut: roles/multi-tenant/historical analytics beyond the trust chart.
