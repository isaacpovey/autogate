import type { Queue, QueueJob } from '../ports/index.js';
import { createCell } from './cell.js';

type QueueState<TPayload> = {
  pending: QueueJob<TPayload>[];
  claimed: QueueJob<TPayload>[];
};

export const mockQueue = <TPayload>({
  seed,
}: {
  seed?: { pending?: QueueJob<TPayload>[] };
} = {}): Queue<TPayload> => {
  const state = createCell<QueueState<TPayload>>()({
    initial: { pending: seed?.pending ?? [], claimed: [] },
  });

  return {
    enqueue: async ({ id, payload }) => {
      const current = state.get();
      state.set({
        ...current,
        pending: [...current.pending, { id, payload, attempts: 0 }],
      });
    },
    claim: async () => {
      const current = state.get();
      const [next, ...rest] = current.pending;
      if (next === undefined) {
        return undefined;
      }
      const claimedJob: QueueJob<TPayload> = { ...next, attempts: next.attempts + 1 };
      state.set({ pending: rest, claimed: [...current.claimed, claimedJob] });
      return claimedJob;
    },
    complete: async ({ id }) => {
      const current = state.get();
      state.set({
        ...current,
        claimed: current.claimed.filter((job) => job.id !== id),
      });
    },
  };
};
