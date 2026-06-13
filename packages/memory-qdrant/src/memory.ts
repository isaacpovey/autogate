import { QdrantClient } from '@qdrant/js-client-rest';
import type {
  MemoryClient,
  MemoryCollection,
  MemoryRecord,
} from '@autogate/contracts';
import { EMBEDDING_DIMENSIONS, type Embedder } from './embedder.js';
import { toPointId } from './point-id.js';

const COLLECTIONS: MemoryCollection[] = ['code_knowledge', 'decisions', 'patterns'];

const toQdrantPayload = ({ record }: { record: MemoryRecord }): Record<string, unknown> => ({
  ...record.metadata,
  id: record.id,
  text: record.text,
});

const fromQdrantPayload = ({
  payload,
}: {
  payload: Record<string, unknown> | null | undefined;
}): MemoryRecord | undefined => {
  if (payload === null || payload === undefined) {
    return undefined;
  }
  const { id, text } = payload;
  if (typeof id !== 'string' || typeof text !== 'string') {
    return undefined;
  }
  const metadata = Object.entries(payload).reduce<MemoryRecord['metadata']>(
    (acc, [key, value]) => {
      if (key === 'id' || key === 'text') {
        return acc;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return { ...acc, [key]: value };
      }
      return acc;
    },
    {},
  );
  return { id, text, metadata };
};

export const createMemoryClient = ({
  url,
  embedder,
}: {
  url: string;
  embedder: Embedder;
}): MemoryClient & {
  ensureCollections: () => Promise<void>;
} => {
  const client = new QdrantClient({ url });

  const ensureCollections = async (): Promise<void> => {
    await COLLECTIONS.reduce(async (prev, collection) => {
      await prev;
      const { exists } = await client.collectionExists(collection);
      if (!exists) {
        await client.createCollection(collection, {
          vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
        });
      }
    }, Promise.resolve());
  };

  const query: MemoryClient['query'] = async ({ collection, text, limit }) => {
    const [vector] = await embedder.embed({ texts: [text] });
    if (vector === undefined) {
      return [];
    }
    const results = await client.search(collection, {
      vector,
      limit: limit ?? 10,
      with_payload: true,
    });
    return results.reduce<MemoryRecord[]>((acc, point) => {
      const record = fromQdrantPayload({
        payload: point.payload === null ? undefined : point.payload,
      });
      return record === undefined ? acc : [...acc, record];
    }, []);
  };

  const upsert: MemoryClient['upsert'] = async ({ collection, records }) => {
    if (records.length === 0) {
      return;
    }
    const vectors = await embedder.embed({ texts: records.map((record) => record.text) });
    const points = records.reduce<
      Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>
    >((acc, record, index) => {
      const vector = vectors[index];
      if (vector === undefined) {
        return acc;
      }
      return [
        ...acc,
        {
          id: toPointId({ id: record.id }),
          vector,
          payload: toQdrantPayload({ record }),
        },
      ];
    }, []);
    await client.upsert(collection, { wait: true, points });
  };

  return { query, upsert, ensureCollections };
};
