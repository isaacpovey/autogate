# Stream A — Execution Plan (goal-mode + dynamic workflows)

**Date:** 2026-06-13
**Driver:** This doc is the per-turn playbook referenced by the active `/goal`. Each goal-turn:
re-reads current state, runs ONE dynamic Workflow to advance the still-incomplete work in
parallel, then commits each newly-green ticket. Repeats until every ticket has real green
evidence in the transcript.

Design context: [`2026-06-13-autogate-design.md`](./2026-06-13-autogate-design.md).
Ticket specs: [`../../../tickets/`](../../../tickets/).

---

## 1. Scope (locked)

Stream A = tickets **01, 02, 03, 04, 05, 06, 14**. All depend only on `00-contracts`
(already built: `packages/contracts` ports + in-mem mocks). They are mutually independent at
build time; **full-real verification** introduces a natural runtime ordering (see §4).

| # | Owns | Port / artifact |
|---|------|-----------------|
| 01 | `apps/api` domain loop | `runPipeline`, `decide`, `buildBrief`; backs `@autogate/api` DashboardApi procedures with the real `Store` |
| 02 | `packages/sandbox` | `SandboxRunner` over Podman/Docker |
| 03 | `packages/store-postgres` | `Store` + `Queue` over Postgres + Drizzle |
| 04 | `packages/vcs-github` | `VcsProvider` over a GitHub App + webhook handler |
| 05 | `packages/memory-qdrant` | `MemoryClient` over Qdrant + ingestion (OpenAI embeddings) |
| 06 | `infra/` | `setup.sh`, `docker-compose.yml`, `repo-configs/{askable,autogate}.ts`, `.env.example` |
| 14 | `.github/workflows/`, `infra/gate-template/` | `gate.yml` producing real Layer-1 check runs |

## 2. Verification posture — FULL REAL

Each ticket must show, in-transcript: **(a)** `pnpm turbo check-types` passing for the whole
monorepo, AND **(b)** a real verification artifact with correct output:

| # | Real evidence |
|---|---------------|
| 02 | Podman container clone + read/grep/ls of a real public ref; clean teardown, no leaked containers |
| 03 | Smoke vs **real Postgres** (migrate from empty → CRUD on runs/verdicts/escalations/overrides) + concurrent-claim proving `FOR UPDATE SKIP LOCKED` (two claimers, no double-claim) |
| 04 | **GitHub App** auth → read real PR/diff/checks on a live `autogate` PR; `awaitAllChecks` resolves on the real `gate.yml` suite; posts a real comment + brief; merge; **live `check_suite` webhook delivered via smee** enqueues a run |
| 05 | Ingest a fixture repo → query returns expected file top-k vs **real Qdrant** with OpenAI embedder; `recordDecision`→`query(decisions)` round-trip |
| 14 | Push `gate.yml`; a real `autogate` PR produces real check runs that 04 reads; failing job → not-green |
| 01 | Pipeline e2e over real Store + real Sandbox + **mock** AgentSdk (Stream B owns real agents) → all four correct decisions: low-risk-agree→`auto_merge`; disagreement→`escalate`; sensitive-path→`escalate`; gate-not-green→`awaiting_checks` |
| 06 | `compose up` → Postgres+Qdrant+api+web+worker healthy, dashboard reachable, a queued fixture run completes; both repo-configs validate against `RepoConfig` |

## 3. Isolation & git strategy

- **Shared tree, disjoint dirs.** Each ticket writes only its own package/dir → no file
  collisions. Build agents edit only their own `package.json` for deps.
- **Single install barrier.** After the parallel build, ONE `pnpm install` resolves the whole
  workspace; never run installs concurrently (root `pnpm-lock.yaml` is the one shared file).
- **Commits are serial, in the main loop** (git index is shared global state). One commit per
  ticket as it goes green. **`git pull --rebase origin main` before each commit** — Stream B
  (tickets 07–13) lands on `main` in parallel. Rebase hotspots: `pnpm-lock.yaml` (resolve by
  re-running `pnpm install`), `turbo.json` / root `package.json` (merge task/dep additions).
- **No adapter cross-imports.** Packages import `@autogate/contracts` only; the orchestrator
  core imports no concrete adapter (injected via ports).

## 4. Orchestration — per-turn Workflow phases

A single dynamic Workflow per goal-turn, operating on the *incomplete* ticket set:

1. **Build** *(parallel, one agent per incomplete ticket)* — scaffold dir, write code vs
   `contracts` + mocks, declare deps, write a real-smoke script. No install. Returns a manifest
   `{ ticket, dir, depsAdded, files, smokeCmd }`.
2. **Install barrier** *(one agent)* — `pnpm install`, then `pnpm turbo check-types`; returns
   per-package pass/fail + errors.
3. **Verify-real + self-fix** *(parallel per ticket, loop-until-green)* — run the real smoke
   against live local services / GitHub; fix own package until `check-types` + smoke pass.
   Returns `{ ticket, checkTypes, smoke, evidence }`.
4. **Integrate** *(serial, may span turns)* — 01 pipeline e2e (real Store+Sandbox + mock
   AgentSdk); then 06 `compose up` + fixture run. These wait until their deps are green, so they
   typically complete on a later turn — goal mode drives that progression.

After the Workflow returns, the main loop commits each newly-green ticket (rebase first) and
prints consolidated evidence for the goal evaluator.

## 5. Local services & secrets (preflight — before the goal runs)

Brought up once, before the autonomous loop, so goal-turns never block on a human:

- **Podman machine** started; **Postgres** (`postgres:16`) and **Qdrant** (`qdrant/qdrant`) running.
- `.env` populated:
  - `DATABASE_URL=postgres://autogate:autogate@localhost:5432/autogate`
  - `QDRANT_URL=http://localhost:6333`
  - `OPENAI_API_KEY=…` (ticket 05 embeddings — `text-embedding-3-small`, 1536 dims)
  - `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`,
    `GITHUB_APP_INSTALLATION_ID` (ticket 04). Webhook delivery via **smee.io**.
- **GitHub App** created by the human (click-steps provided); can be done in parallel with the
  autonomous build — 04's live-webhook verification is the last real check to go green.

## 6. Key technical choices (so build agents are consistent)

- **03 store-postgres:** Drizzle ORM + `drizzle-kit` migrations; `postgres` (postgres.js) driver.
  Tables: `runs`, `verdicts`, `escalations`, `overrides`, `jobs`. `runs.list` returns
  `{ items, nextCursor }` (cursor pagination matching DashboardApi). `claim` uses
  `FOR UPDATE SKIP LOCKED`.
- **02 sandbox:** Podman containers (`node:22-alpine` + git, or `alpine/git`); `clone` checks out
  the ref, `RepoAccess` = scoped `read`/`grep`/`ls`; `teardown` removes container + volume. No
  app boot, no test exec.
- **04 vcs-github:** `@octokit/auth-app` + `@octokit/rest` for reads/merge/comments;
  `@octokit/webhooks` + `smee-client` for delivery. `awaitAllChecks` polls `check_suite` with a
  timeout and yields (no worker block). Webhook: `check_suite` completed+success → enqueue;
  PR-open-already-green → enqueue.
- **05 memory-qdrant:** `@qdrant/js-client-rest`; `openai` for embeddings behind an `Embedder`
  seam (swappable/mockable). Collections `code_knowledge` / `decisions` / `patterns`.
  `ingestRepo` walks `ragInclude`, chunks, embeds, upserts.
- **01 orchestrator:** pure functional domain loop in `apps/api`; `(deps) => (args)`; mock
  AgentSdk + canned verdicts for L2; reads ports from tRPC context; no provider logic in procedures.
- **06 infra:** `compose` services for pg/qdrant/api/web/worker; `setup.sh` installs + boots +
  migrates + ingests; `repo-configs/{askable,autogate}.ts` typed against `RepoConfig`.
- Functional style throughout: `(dependencies) => (arguments)`, destructured object args, no
  mutation, no `as`/`any` outside tests.

## 7. Done

Goal met when all seven tickets show (a) whole-repo `check-types` green AND (b) their real
evidence (§2), and each has its own commit on `main`. Turn cap: 25.
