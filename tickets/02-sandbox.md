---
id: 02-sandbox
title: Sandbox runner (Docker) — clone + read
stream: A
depends_on: [00-contracts]
phase: 1
---

# 02 — Sandbox runner (Docker)

## Goal
Implement `SandboxRunner` over Docker: create an isolated container for a run, clone the PR ref, and expose **scoped repo read/grep** to the Layer-2 agents. No app boot, no test execution (Layer 1 already ran the repo's checks on GitHub).

## Owns
`packages/sandbox` — the Docker adapter for `SandboxRunner`.

## Deliverables
- `clone({ repoUrl, ref })` → working checkout in container.
- `RepoAccess` facade (scoped `read`/`grep`/`ls`) handed to agents in `RunContext`.
- `teardown()` → remove container/volumes.

## Definition of Done
- `pnpm turbo check-types` passes.
- Behaves identically (for read/grep) to the in-mem mock from ticket 00 on a fixture repo.
- Clones a public ref, lists/reads files, tears down cleanly with no leaked containers.

## Notes
- Fallback adapter (git-worktree) is acceptable if Docker is fiddly on EC2 — keep `SandboxRunner` the seam so it swaps cleanly.
- No `bootApp`/`exec` of tests — those were Layer 3a / Layer 1 responsibilities that are now gone or on GitHub.
