# Stream B — Goal 2: the Stream-A-dependent slices (run after Stream A lands)

The completion of Stream B that couldn't be built in **Goal 1**
([`stream-b-goal-1-agent-spine.md`](./stream-b-goal-1-agent-spine.md)) because it needs
Stream A: the **end-to-end eval tier** (ticket `12`) and the **infrastructure CLI
commands** (ticket `13`). Pre-written so you can fire it the moment Stream A is in.

## Precondition

Run this **only after Stream A (tickets `01`–`06`) has landed**, and with local infra up:
the orchestrator package exists, and `docker-compose` Postgres + Qdrant are running (the
e2e eval tier needs only the orchestrator *code* + mocks; the CLI infra commands need the
real Postgres/Qdrant). The condition tells Claude to bring infra up if it isn't.

## How to use it

```text
/goal <paste the condition block below>
```

Same mechanics as Goal 1: the evaluator reads only the transcript, so every DONE item is a
*run-and-show-output* check. Tune the turn bound (`30`) to taste.

## The goal condition (paste this)

```text
Complete the Stream-A-dependent slices of Autogate Stream B — the end-to-end eval tier (ticket 12) and the infrastructure CLI commands (ticket 13) — now that Stream A (tickets 01-06) has landed. Read tickets/12-evals.md and tickets/13-cli.md for their Definitions of Done. PRECONDITION: the Stream A packages exist; ensure local infra is up before the infra commands (run `docker-compose up -d` for Postgres + Qdrant if they are not already running, per ticket 06). The goal is met only when every item under DONE is demonstrated in this conversation (the evaluator reads only what you surface, so run the commands and show their output).

BUILD:
- 12 end-to-end eval tier (extend packages/evals): replay the labeled fixture PRs through the orchestrator (ticket 01) against all mocks with the gate forced green; for each, print the final Decision vs ground truth, and an overall escalation precision/recall summary. Add the override fixture that demonstrates precedent retrieval changing a verdict (the trust loop).
- 13 infra CLI commands (extend packages/cli), each wired to the real Stream A adapters via their contracts ports — reuse the adapters, do NOT re-implement them: `db migrate` and `db seed` (Postgres, ticket 03), `ingest <repoConfig>` (Qdrant ingestion, ticket 05), `run enqueue --repo <id> --pr <n>` (enqueue a run via the queue, ticket 03/01). Structured output, quiet by default.

DONE (every item must be shown in this conversation):
1. `pnpm turbo check-types` is run with 0 errors across all packages — output shown.
2. `pnpm turbo lint` is run with 0 errors and 0 warnings — output shown.
3. `pnpm eval` runs BOTH tiers headless; the e2e tier prints per-fixture Decision vs ground truth and an escalation precision/recall summary — output shown.
4. The override fixture run shows precedent retrieval changing the verdict — output shown.
5. `pnpm autogate db migrate` then `pnpm autogate db seed` run clean against the local Postgres — output shown.
6. `pnpm autogate ingest <repoConfig>` ingests into Qdrant and reports the document/chunk counts — output shown.
7. `pnpm autogate run enqueue --repo <id> --pr <n>` enqueues a run and prints the new run id — output shown.

CONSTRAINTS (must stay true throughout):
- Do NOT modify packages/contracts (@autogate/contracts) — import from it, never edit it.
- Do NOT modify apps/web (the dashboard) or change the @autogate/api router/contract shapes.
- Reuse the existing Stream A adapters through their ports; do NOT re-implement an adapter and do NOT change Stream A package internals beyond what wiring requires.
- Do NOT change the agent spine (07/08) beyond what the e2e eval tier strictly needs.
- Out of scope: ticket 10 (monitoring-datadog) and ticket 11 (dashboard).
- Functional style: (dependencies) => (arguments), destructured objects, no mutation. No test framework. Targeted checks for core behavior and contract boundaries, not exhaustive unit tests.
- After each piece: run check-types and exercise the artifact before starting the next.

Stop when every DONE item is demonstrated in this conversation, or stop after 30 turns and report exactly what remains.
```

## Why it's scoped this way

- **It's exactly the Goal-1 deferrals that needed Stream A** — the e2e eval tier (needs the
  orchestrator, ticket `01`) and the infra CLI commands (need Postgres/Qdrant from tickets
  `03`/`05`, brought up by `06`'s compose).
- **Reuse, don't reimplement.** Constraints force Claude to wire through the existing
  Stream A adapters via their ports, so this goal *integrates* rather than duplicating
  Stream A's work.
- **Still transcript-provable**, but two DONE items (`db`/`ingest`/`enqueue`) depend on
  real infra being up — hence the explicit precondition and the `docker-compose up` clause.
- **Not included here:** `09` layer1-gate (doable now — belongs to a now-goal, not this
  one), `10` monitoring (separate session), and deepening agent evals to the live SDK.
