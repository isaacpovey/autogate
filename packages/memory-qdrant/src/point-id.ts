import { createHash } from 'node:crypto';

/**
 * Qdrant point IDs must be unsigned integers or UUIDs, but MemoryRecord ids are
 * arbitrary strings. Deriving a deterministic UUID from the record id keeps
 * upserts idempotent (same id => same point) while preserving the original id
 * in the payload for retrieval.
 */
export const toPointId = ({ id }: { id: string }): string => {
  const hex = createHash('sha256').update(id).digest('hex').slice(0, 32);
  const v5 = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return v5;
};
