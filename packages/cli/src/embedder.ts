import { createOpenAIEmbedder, EMBEDDING_DIMENSIONS, type Embedder } from '@autogate/memory-qdrant';

/** FNV-1a 32-bit hash — seeds the deterministic embedder per text. */
const fnv1a = ({ input }: { input: string }): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * A deterministic, offline `Embedder`: a stable xorshift32 stream seeded from
 * each text produces a fixed pseudo-random vector. Lets `ingest` exercise the
 * real Qdrant adapter without an `OPENAI_API_KEY` — same text always maps to the
 * same vector, so re-ingestion is idempotent. Not for semantic search quality.
 */
const deterministicEmbedder = (): Embedder => ({
  embed: async ({ texts }) =>
    texts.map((text) => {
      let state = fnv1a({ input: text }) || 1;
      return Array.from({ length: EMBEDDING_DIMENSIONS }, () => {
        state = (state ^ (state << 13)) >>> 0;
        state = (state ^ (state >>> 17)) >>> 0;
        state = (state ^ (state << 5)) >>> 0;
        return (state / 0x100000000) * 2 - 1;
      });
    }),
});

export type ResolvedEmbedder = { embedder: Embedder; mode: 'openai' | 'deterministic' };

/**
 * Use the real OpenAI embedder when a key is present, otherwise fall back to the
 * deterministic offline embedder so `ingest` works with zero external services.
 */
export const resolveEmbedder = ({ openaiApiKey }: { openaiApiKey?: string }): ResolvedEmbedder =>
  openaiApiKey === undefined || openaiApiKey.trim() === ''
    ? { embedder: deterministicEmbedder(), mode: 'deterministic' }
    : { embedder: createOpenAIEmbedder({ apiKey: openaiApiKey }), mode: 'openai' };
