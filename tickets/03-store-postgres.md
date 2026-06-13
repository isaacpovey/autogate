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
- `Store`: create/get/list runs (with filters + cursor pagination for the `runs.list` tRPC query), append verdicts, record escalation, record override.
- `Queue`: `enqueue`, `claim` (atomic, `FOR UPDATE SKIP LOCKED`), `complete`/`fail`.
- Seed script for demo data.

## Definition of Done
- `pnpm turbo check-types` passes; adapters satisfy the `Store`/`Queue` interfaces at compile time.
- A `tsx` smoke script exercises the same operations as the in-mem mocks and matches their behavior.
- `claim` is concurrency-safe (`FOR UPDATE SKIP LOCKED`) — verified by a small concurrent `tsx` script (two claimers, no double-claim).
- Migrations run clean from an empty DB via the CLI (ticket 13).

## Notes
- Pagination shape must match the `DashboardApi` `runs.list` query (`{ items, nextCursor }`).
- Keep queries in repository functions; no ORM leakage past the port.
