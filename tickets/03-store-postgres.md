---
id: 03-store-postgres
title: Store + Queue (Postgres/Drizzle)
stream: A
depends_on: [00-contracts]
phase: 1
---

# 03 — Store + Queue (Postgres)

## Goal
Implement the `Store` and `Queue` ports over Postgres with Drizzle, including migrations. This is the system of record for runs, verdicts, escalations, overrides — and the job queue.

## Owns
`packages/store-postgres` — Drizzle schema, migrations, `Store` + `Queue` adapters.

## Deliverables
- Drizzle schema + migrations for: `runs`, `verdicts`, `escalations`, `overrides`, `jobs`.
- `Store`: create/get/list runs (with filters + cursor pagination for `/api/runs`), append verdicts, record escalation, record override.
- `Queue`: `enqueue`, `claim` (atomic, `FOR UPDATE SKIP LOCKED`), `complete`/`fail`.
- Seed script for demo data.

## Definition of Done
- Contract parity test: `Store`/`Queue` pass the **same** test suite as the in-mem mocks from ticket 00.
- `claim` is concurrency-safe (two workers never claim the same job) — proven by a concurrent test.
- Migrations run clean from empty DB via the CLI (ticket 13).

## Notes
- Pagination shape must match `DashboardApi` `/api/runs` (`{ items, nextCursor }`).
- Keep queries in repository functions; no ORM leakage past the port.
