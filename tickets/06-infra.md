---
id: 06-infra
title: Infra — setup.sh + docker-compose + repo-configs
stream: A
depends_on: [00-contracts]
phase: 1
---

# 06 — Infra (EC2 one-command boot)

## Goal
Make the whole system come up on a fresh single EC2 instance with one command, and define the per-target `RepoConfig`s.

## Owns
`infra/` — `setup.sh`, `docker-compose.yml`, `repo-configs/{askable,autogate}.ts`, `.env.example`.

## Deliverables
- `setup.sh`: install Docker + Compose + Node/pnpm, clone repo, `pnpm install`, write `.env`, run DB migrations, run repo ingestion, `docker-compose up`.
- `docker-compose.yml`: services for Postgres, Qdrant, orchestrator/API (`apps/orchestrator`), dashboard (`apps/web`), and worker(s).
- `repo-configs/askable.ts` and `repo-configs/autogate.ts`: `RepoConfig` with `ragInclude`, `sensitivePaths`, `requiredChecks` (default `'all'` — every existing GitHub check incl. bugbot must pass), and `agents` (which Layer-2 agents run).
- `.env.example` documenting required secrets (GitHub App, Datadog, Anthropic, DB).

## Definition of Done
- `pnpm turbo check-types` passes for config files.
- On a clean box: `./setup.sh` → full stack healthy; dashboard reachable; a queued fixture run completes.
- Both repo-configs load and validate against the `RepoConfig` schema.

## Notes
- Monorepo is already scaffolded (`create-turbo`) — `setup.sh` just installs + boots; no scaffolding here.
- Single-node for the demo; workers scale via `docker-compose --scale worker=N`.
- The "watch it boot on a fresh box" demo opener.
