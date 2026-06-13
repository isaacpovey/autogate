---
id: 08-agents
title: Agents (6 Layer-2 AI agents)
stream: B
depends_on: [07-agent-sdk]
phase: 1
---

# 08 — Agents

## Goal
Author the Layer-2 agent library. Each agent is one self-contained folder (prompt + schema + `toVerdict` + evals) assembled via `createAiAgent`. **Each agent is independently parallelizable** — a separate sub-agent task.

## Owns
`packages/agents/<id>/` — one folder per agent: `agent.ts`, `prompt.md`, `schema.ts`, `evals/*.json`.

## Agents to build (Layer 2 — AI, pre-merge; diff + repo + RAG, no app boot)
- `semantic-review` — does the change do what it says; intent vs implementation.
- `blast-radius` — dependency graph of affected systems/paths (uses `code_knowledge`).
- `risk-scoring` — scope/complexity/sensitivity → `riskContribution`.
- `pattern-compliance` — conventions via `patterns` collection.
- `security-review` — static: secrets, injection, authz, unsafe patterns.
- `architecture-review` — boundary/coupling/layering concerns.

(Layer 3a web-testing / pen-test agents were dropped — no app boot.)

## Definition of Done
- `pnpm turbo check-types` passes for each agent package.
- Each agent runs in isolation via `pnpm agent run <id> --fixture <pr>` (against the `AgentSdk` mock or real) and prints a schema-valid `Verdict`.
- `pnpm agent eval <id>` passes the agent's focused fixtures — **run it to verify the agent** before the step is done.

## Notes
- Iterate prompt/schema in-folder; never touch the orchestrator.
- Keep each agent's output schema tight — it drives the dashboard findings.
- Which agents run per repo comes from `RepoConfig.agents`.
