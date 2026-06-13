import type { MemoryClient, MemoryCollection, MemoryRecord } from '../ports/index.js';
import { createCell } from './cell.js';

export type MemorySeed = Partial<Record<MemoryCollection, MemoryRecord[]>>;

type Collections = Record<MemoryCollection, MemoryRecord[]>;

const emptyCollections = (): Collections => ({
  code_knowledge: [],
  decisions: [],
  patterns: [],
});

const scoreRecord = ({ text, record }: { text: string; record: MemoryRecord }): number => {
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = record.text.toLowerCase();
  return terms.reduce((score, term) => (haystack.includes(term) ? score + 1 : score), 0);
};

export const mockMemory = ({ seed }: { seed?: MemorySeed } = {}): MemoryClient => {
  const state = createCell<Collections>()({
    initial: { ...emptyCollections(), ...seed },
  });

  return {
    query: async ({ collection, text, limit }) => {
      const records = state.get()[collection];
      const ranked = [...records]
        .map((record) => ({ record, score: scoreRecord({ text, record }) }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.record);
      return limit === undefined ? ranked : ranked.slice(0, limit);
    },
    upsert: async ({ collection, records }) => {
      const current = state.get();
      const ids = new Set(records.map((record) => record.id));
      const kept = current[collection].filter((record) => !ids.has(record.id));
      state.set({ ...current, [collection]: [...kept, ...records] });
    },
  };
};
