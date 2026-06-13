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
- `setup.sh`: install Docker + Compose, clone repo, write `.env`, run DB migrations, run repo ingestion, `docker-compose up`.
- `docker-compose.yml`: services for Postgres, Qdrant, orchestrator/API, dashboard, and N sandbox workers.
- `repo-configs/askable.ts` and `repo-configs/autogate.ts`: `RepoConfig` with `bootCmd`, `testCmd`, `lint/typecheck`, `ragInclude`, `sensitivePaths`, and the `checks` list (agents vs external — e.g. bugbot replacing an agent on askable).
- `.env.example` documenting all required secrets (GitHub App, Datadog, Anthropic, DB).

## Definition of Done
- On a clean box: `./setup.sh` → full stack healthy; dashboard reachable; a queued fixture run completes.
- Both repo-configs load and validate against the `RepoConfig` schema.

## Notes
- Single-node for the demo; workers scale via `docker-compose --scale worker=N`.
- This is the "watch it boot on a fresh box" demo opener.
