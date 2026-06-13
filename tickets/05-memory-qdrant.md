---
id: 05-memory-qdrant
title: MemoryClient (Qdrant) + ingestion
stream: A
depends_on: [00-contracts]
phase: 1
---

# 05 — MemoryClient (Qdrant) + ingestion

## Goal
Implement `MemoryClient` over Qdrant across three collections, plus the repo-ingestion pipeline that populates `code_knowledge`.

## Owns
`packages/memory-qdrant` — Qdrant adapter, embedding, ingestion pipeline.

## Collections
- `code_knowledge` — embedded repo symbols/files/dependency edges (RAG for semantic / blast-radius / pattern agents).
- `decisions` — past PRs: diff embedding + verdicts + human decision + reason (runtime precedent retrieval + eval growth).
- `patterns` — approved conventions / prior review comments (pattern-compliance agent).

## Deliverables
- `query({ collection, vectorOrText, filter, k })` and `upsert({ collection, items })`.
- `ingestRepo({ repoConfig })` — walk `ragInclude`, chunk, embed, upsert to `code_knowledge`. Run at setup and on demand via CLI.
- Feedback writer helper: `recordDecision({ pr, verdicts, override })` → `decisions`.

## Definition of Done
- Contract parity with the in-mem vector mock from ticket 00.
- `ingestRepo` on a small fixture repo populates `code_knowledge`; a known query returns the expected file in top-k.
- Round-trip: `recordDecision` then `query(decisions)` retrieves the precedent.

## Notes
- Scope `ragInclude` tightly for the demo to keep ingestion fast.
- Embedding model behind a tiny internal seam so it can be swapped/mocked.
