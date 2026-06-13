---
id: 13-cli
title: CLI
stream: B
depends_on: [00-contracts]
phase: 1
---

# 13 — CLI

## Goal
The developer entrypoint that makes iteration fast: run a single agent, run evals, ingest a repo, run migrations, enqueue a run.

## Owns
`packages/cli` — `autogate` command (or `pnpm agent ...` scripts).

## Commands
- `agent run <id> --fixture <pr>` — run one `CheckSource` in isolation, print the `Verdict`. (L2 agents need no boot → tight loop.)
- `agent eval <id>` — run that agent's fixture evals (delegates to ticket 12).
- `eval` — run the full two-tier eval suite.
- `ingest <repoConfig>` — run repo ingestion into Qdrant.
- `db migrate` / `db seed` — migrations + demo seed.
- `run enqueue --repo <id> --pr <n>` — enqueue a real run.

## Definition of Done
- Every command works against **mocks** (no infra) where applicable.
- `agent run` + `agent eval` operate on a real agent folder and print structured output.
- Used by ticket 06's `setup.sh` for migrate/ingest.

## Notes
- This is the surface agents and humans use to iterate — keep output structured and quiet by default, verbose on a flag.
