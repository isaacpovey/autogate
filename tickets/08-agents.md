---
id: 08-agents
title: Agents (6 L2 + 2 L3a)
stream: B
depends_on: [07-agent-sdk]
phase: 1
---

# 08 — Agents

## Goal
Author the agent library. Each agent is one self-contained folder (prompt + schema + `toVerdict` + evals) assembled via `createAiAgent`. **Each agent is independently parallelizable** — can be a separate sub-agent task.

## Owns
`packages/agents/<id>/` — one folder per agent: `agent.ts`, `prompt.md`, `schema.ts`, `evals/*.json`.

## Agents to build
Layer 2 (AI, pre-merge; diff + repo + RAG):
- `semantic-review` — does the change do what it says; intent vs implementation.
- `blast-radius` — dependency graph of affected systems/paths (uses `code_knowledge`).
- `risk-scoring` — scope/complexity/sensitivity → `riskContribution`.
- `pattern-compliance` — conventions via `patterns` collection.
- `security-review` — static: secrets, injection, authz, unsafe patterns.
- `architecture-review` — boundary/coupling/layering concerns.

Layer 3a (runtime; require `ctx.app`, so `appliesTo` checks for it):
- `web-testing` — drive the booted app, exercise affected user paths.
- `pen-test` — probe the booted app's affected endpoints (authz, injection, IDOR).

## Definition of Done
- Each agent passes its own `pnpm agent eval <id>` fixture set (status / risk-band / key findings vs labels).
- L3a agents `appliesTo` returns false when `ctx.app` is absent (so they're skipped without a boot).
- Each agent runs in isolation via `pnpm agent run <id> --fixture <pr>` and prints a valid `Verdict`.

## Notes
- Iterate prompt/schema in-folder; never touch the orchestrator.
- Keep each agent's output schema tight — it drives the dashboard findings.
- Registry assembly (the list of `CheckSource`s) is per-`RepoConfig.checks`.
