---
id: 07-agent-sdk
title: AgentSdk adapter + factories
stream: B
depends_on: [00-contracts]
phase: 1
---

# 07 — AgentSdk adapter + factories

## Goal
Implement the `AgentSdk` port over the Claude Agent SDK, and the two factories that turn declarations into `CheckSource`s: `createAiAgent` and `createExternalCheck`.

## Owns
`packages/agent-sdk` — Claude Agent SDK adapter + `createAiAgent` + `createExternalCheck` + `toVerdict` helpers.

## Deliverables
- `AgentSdk.run({ instructions, tools, outputSchema, context })` → validated structured output (retries on schema mismatch).
- `createAiAgent({ sdk })({ id, instructions, tools, outputSchema, toVerdict }) => CheckSource` (see spec §5).
- `createExternalCheck({ vcs })({ id, checkName, mapToVerdict, timeoutMs }) => CheckSource`.
- Shared `toVerdict` utilities (clamp confidence/risk, normalize findings).

## Definition of Done
- Unit test: `createAiAgent` against the **canned-response `AgentSdk` mock** yields a schema-valid `Verdict`.
- Unit test: `createExternalCheck` against the mock `VcsProvider` maps a check conclusion → `Verdict`; timeout → `warn`.
- Tool allowlist is enforced (agent cannot call tools outside its list).

## Notes
- This package unblocks ticket 08 (agents) and 09 (external checks) — prioritize within stream B.
- Keep the SDK behind the `AgentSdk` port so evals can run fully mocked.
