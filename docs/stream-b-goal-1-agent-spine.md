# Stream B — Goal 1: the agent spine (run now)

A worked-up completion condition to drive an **autonomous** `/goal` run that builds the
**agent spine of Stream B** — tickets `07`, `08`, and the agent-facing slices of `12` and
`13` — against `@autogate/contracts` + its in-memory mocks. No live infrastructure, no
Stream A dependencies — fully runnable today.

The Stream-A-dependent remainder lives in **Goal 2**
([`stream-b-goal-2-post-stream-a.md`](./stream-b-goal-2-post-stream-a.md)), ready to run
the moment Stream A lands.

## How to use it

In a trusted workspace (ideally with auto mode on so each turn runs unattended):

```text
/goal <paste the condition block below>
```

`/goal` re-runs Claude every turn until a fast model confirms the condition holds.
**The evaluator only reads the conversation transcript — it can't run commands or read
files.** That's why every DONE item is phrased as *run a command and show its output*:
the proof has to land in the transcript. Tune the turn bound (`40`) to taste.

## The goal condition (paste this)

```text
Build the Autogate Stream B agent spine — tickets 07, 08, and the agent-facing slices of 12 and 13 — against @autogate/contracts and its in-memory mocks, with no live infrastructure. Read each ticket in tickets/ for its Definition of Done. The goal is met only when every item under DONE is demonstrated in this conversation (the evaluator reads only what you surface, so run the commands and show their output).

BUILD (dependency order: 07 first, then 12's per-agent runner and 13's agent commands, then 08):
- 07 packages/agent-sdk: the AgentSdk adapter + createAiAgent factory + toVerdict helpers (spec section 5). Verify via the canned-response AgentSdk mock, not the live SDK.
- 12 packages/evals: ONLY the per-agent eval runner — load agents/<id>/evals/*.json, run each agent against the mock AgentSdk, score the result, print pass-rate. Evals are intentionally shallow for now: assert the Verdict is schema-valid and well-formed, NOT that the agent reasoned correctly. Do NOT build the end-to-end / orchestrator eval tier.
- 13 packages/cli: ONLY these commands, wired as pnpm scripts — `agent run <id> --fixture <pr>`, `agent eval <id>`, `eval`. Do NOT build ingest, db migrate, db seed, or run enqueue.
- 08 packages/agents/<id>: the 6 Layer-2 agents (semantic-review, blast-radius, risk-scoring, pattern-compliance, security-review, architecture-review). Each is a self-contained folder (agent.ts + prompt + schema.ts + evals/*.json) assembled via the 07 factory. Author the real declarations but run them ONLY against the mock AgentSdk (canned, deterministic responses) — never call the live Claude Agent SDK or any network API.

DONE (every item must be shown in this conversation):
1. Packages 07, 08, 12, 13 exist and meet the reduced scope above.
2. `pnpm turbo check-types` is run with 0 errors across all packages — output shown.
3. `pnpm turbo lint` is run with 0 errors and 0 warnings — output shown.
4. `pnpm agent run <id> --fixture <pr>` prints a schema-valid Verdict for at least one agent — output shown.
5. `pnpm agent eval <id>` runs for ALL 6 agents and reports pass (schema-valid output) — the per-agent summaries shown.
6. `pnpm eval` runs the per-agent tier headless with zero infra and prints a readable report — output shown.

CONSTRAINTS (must stay true throughout):
- Do NOT modify packages/contracts (@autogate/contracts) — another engineer owns it; import from it, never edit it.
- Do NOT modify apps/web (the dashboard) or change the @autogate/api router/contract shapes — a human is hand-building the dashboard against them.
- Do NOT build or edit Stream A packages, and do NOT implement any real adapter; build only against @autogate/contracts + its in-memory mocks (mockAgent, mockVcs, mockMemory, mockStore, mockQueue, mockSandbox, mockMonitoring).
- Out of scope — do not build now: ticket 09 (layer1-gate), ticket 10 (monitoring), ticket 11 (dashboard), the e2e/orchestrator eval tier, and the CLI infra commands (ingest, db migrate, db seed, run enqueue). These come in later goals.
- Functional style: (dependencies) => (arguments), destructured objects, no mutation. No test framework. Targeted checks for core behavior and contract boundaries, not exhaustive unit tests.
- After each package: run check-types and exercise the artifact before starting the next.

Stop when every DONE item is demonstrated in this conversation, or stop after 40 turns and report exactly what remains.
```

## Why it's scoped this way

- **One cohesive vertical slice.** `07` (factory) is the foundation; `08` (the agents) is
  the meat; the `12`/`13` slices exist only to *run and verify* the agents.
- **Provable in-session.** Every DONE item is a command whose output lands in the
  transcript — the evaluator judges only what's surfaced.
- **Dependency order.** `07` unblocks everything; `08` is verified *through* `12`'s runner
  and `13`'s `agent run`/`agent eval`, so those precede `08`.
- **Evals are intentionally shallow.** Against the canned mock `AgentSdk`, `pnpm agent
  eval` proves *plumbing* (schema-valid `Verdict`, `toVerdict`, tool-allowlist), not prompt
  quality. Deepened later once the live SDK is wired.
- **Collision-safe.** Constraints forbid touching `apps/web`, `@autogate/contracts`, the
  `@autogate/api` shapes, and any Stream A package — so it can't trample the dashboard
  you're building by hand.

## Other follow-up goals (not in either file yet)

- **`09` layer1-gate** — `gateFromChecks` mapping GitHub check runs (incl. bugbot) against
  the mock `VcsProvider`. Standalone and doable now; ask if you want it written up.
- **`10` monitoring-datadog** — deferred to a later session (needs Datadog).
- **Live agent depth** — re-wire `08`/`12` to the real Claude Agent SDK and deepen evals
  from schema-validity to behavioural scoring.

## Suggested working hygiene (optional, outside the condition)

```text
git switch -c stream-b-agents
```

Commit after each package check-types + is exercised — one clean commit per ticket.
