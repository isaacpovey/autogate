---
id: 00-contracts
title: Contracts + mocks (the spine)
stream: shared
depends_on: []
phase: 0
---

# 00 — Contracts + mocks

## Goal
Define every shared type, port (interface), and the `DashboardApi` schema, plus an in-memory mock for every port. This package is the single dependency of every other package and **must land before Phase 1 starts**.

## Owns
`packages/contracts` — the only package other packages may import for types. No runtime adapters here.

## Deliverables
- Zod schemas + inferred TS types for: `Verdict`, `Finding`, `Severity`, `VerdictStatus`, `RunContext`, `PullRequest`, `CheckSource`, `Policy`, `RepoConfig`.
- Port interfaces: `VcsProvider`, `SandboxRunner`, `AgentSdk`, `MemoryClient`, `Store`, `Queue`, `MonitoringClient`.
- `DashboardApi` request/response schemas (`RunSummary`, `CheckResult`, `RunDetail`, `TrustMetrics`, `RepoSummary`) — see spec §6.
- `packages/contracts/mocks/*` — an in-memory implementation of every port (deterministic, seedable) so all Phase-1 packages build/test without infra.

## Contract (authoritative source: spec §4–§6)
```ts
type Verdict = { agentId: string; status: 'pass'|'warn'|'fail'|'needs_human'; confidence: number; riskContribution: number; summary: string; findings: Finding[] }
type CheckSource = { id: string; kind: 'agent'|'external'; layer: 'static'|'ai'|'runtime'|'monitor'|'external'; appliesTo: (ctx: RunContext) => boolean; run: (ctx: RunContext) => Promise<Verdict> }
type RepoConfig = { id: string; bootCmd?: string; testCmd?: string; lintCmd?: string; typecheckCmd?: string; ragInclude: string[]; sensitivePaths: string[]; checks: ({use:'agent';id:string}|{use:'external';id:string;checkName:string})[] }
// ...full set in spec
```

## Definition of Done
- `pnpm -F contracts typecheck` passes; all schemas export inferred types.
- Every port has a mock; `pnpm -F contracts test` proves each mock satisfies its interface and round-trips seed data.
- A consumer can `import { Verdict, mockStore } from '@autogate/contracts'` and compile.

## Notes
- Functional style: `(dependencies) => (arguments)`, destructured objects, no mutation.
- Mocks are the contract for parallel work — keep them realistic enough that swapping the real adapter in Phase 2 needs no consumer changes.
