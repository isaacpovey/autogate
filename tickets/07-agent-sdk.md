---
id: 07-agent-sdk
title: AgentSdk adapter + createAiAgent factory
stream: B
depends_on: [00-contracts]
phase: 1
---

# 07 — AgentSdk adapter + factory

## Goal
Implement the `AgentSdk` port over the Claude Agent SDK, and the `createAiAgent` factory that turns a declaration into a Layer-2 `CheckSource`.

## Owns
`packages/agent-sdk` — Claude Agent SDK adapter + `createAiAgent` + `toVerdict` helpers.

## Deliverables
- `AgentSdk.run({ instructions, tools, outputSchema, context })` → validated structured output (retries on schema mismatch).
- `createAiAgent({ sdk })({ id, instructions, tools, outputSchema, toVerdict }) => CheckSource` (`layer: 'ai'`) — see spec §5.
- Shared `toVerdict` utilities (clamp confidence/risk, normalize findings).

## Definition of Done
- `pnpm turbo check-types` passes.
- `createAiAgent` against the **canned-response `AgentSdk` mock** yields a schema-valid `Verdict` (verified via the `agent run` CLI, not a test suite).
- Tool allowlist is enforced (agent cannot call tools outside its list).

## Notes
- Unblocks ticket 08 (agents) — prioritize within stream B.
- Keep the SDK behind the `AgentSdk` port so the CLI/evals can run fully mocked.
- (No `createExternalCheck` — external/bugbot checks are now Layer 1, ticket 09.)
