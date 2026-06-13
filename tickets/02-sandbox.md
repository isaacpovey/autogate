---
id: 02-sandbox
title: Sandbox runner (Docker)
stream: A
depends_on: [00-contracts]
phase: 1
---

# 02 — Sandbox runner (Docker)

## Goal
Implement `SandboxRunner` over Docker: create an isolated container for a run, clone the PR ref, expose scoped repo read/exec to agents, optionally boot the target app (L3a), and tear down.

## Owns
`packages/sandbox` — the Docker adapter for `SandboxRunner`.

## Deliverables
- `clone({ repoUrl, ref })` → working checkout in container.
- `exec({ cmd, cwd, timeoutMs })` → `{ stdout, stderr, code }` (used for L1 tests/lint/types and `bootCmd`).
- `bootApp({ repoConfig })` → boots the app via `repoConfig.bootCmd`, waits for health, returns `RunningApp { baseUrl }`; used only for L3a.
- `teardown()` → remove container/volumes.
- `RepoAccess` facade (scoped read/grep) handed to agents in `RunContext`.

## Definition of Done
- Contract test: behaves identically (for read/exec) to the in-mem mock from ticket 00 on a fixture repo.
- Can clone a public ref, run `echo`/`ls`, and tear down cleanly with no leaked containers.
- `bootApp` proven against a trivial sample service (health endpoint returns 200) before integration tackles `askable-services`.

## Notes
- Fallback adapter (git-worktree + subprocess) is acceptable if Docker is fiddly on the EC2 box — keep `SandboxRunner` the seam so it swaps cleanly.
- Resource limits + per-run timeout to avoid runaway boots.
