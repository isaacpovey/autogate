import type {
  Store,
  StoredEscalation,
  StoredOverride,
  StoredRun,
  StoredVerdict,
} from '../ports/index.js';
import { createCell } from './cell.js';

export type StoreSeed = {
  runs?: StoredRun[];
  verdicts?: StoredVerdict[];
  escalations?: StoredEscalation[];
  overrides?: StoredOverride[];
};

export const mockStore = ({ seed }: { seed?: StoreSeed } = {}): Store => {
  const runs = createCell<StoredRun[]>()({ initial: seed?.runs ?? [] });
  const verdicts = createCell<StoredVerdict[]>()({ initial: seed?.verdicts ?? [] });
  const escalations = createCell<StoredEscalation[]>()({
    initial: seed?.escalations ?? [],
  });
  const overrides = createCell<StoredOverride[]>()({ initial: seed?.overrides ?? [] });

  return {
    runs: {
      save: async ({ run }) => {
        const rest = runs.get().filter((existing) => existing.runId !== run.runId);
        runs.set([...rest, run]);
      },
      get: async ({ runId }) => runs.get().find((run) => run.runId === runId),
      list: async ({ repo, limit }) => {
        const filtered = runs
          .get()
          .filter((run) => (repo === undefined ? true : run.pr.repo === repo));
        return limit === undefined ? filtered : filtered.slice(0, limit);
      },
    },
    verdicts: {
      save: async ({ verdict }) => {
        const rest = verdicts
          .get()
          .filter(
            (existing) =>
              !(existing.runId === verdict.runId && existing.sourceId === verdict.sourceId),
          );
        verdicts.set([...rest, verdict]);
      },
      listForRun: async ({ runId }) =>
        verdicts.get().filter((verdict) => verdict.runId === runId),
    },
    escalations: {
      save: async ({ escalation }) => {
        const rest = escalations
          .get()
          .filter((existing) => existing.runId !== escalation.runId);
        escalations.set([...rest, escalation]);
      },
      get: async ({ runId }) =>
        escalations.get().find((escalation) => escalation.runId === runId),
    },
    overrides: {
      save: async ({ override }) => {
        overrides.set([...overrides.get(), override]);
      },
      listForRun: async ({ runId }) =>
        overrides.get().filter((override) => override.runId === runId),
    },
  };
};
