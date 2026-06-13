import type { MonitoringClient, MonitoringErrorEvent } from '../ports/index.js';

export type MonitoringSeed = {
  errors?: Record<string, MonitoringErrorEvent[]>;
};

export const mockMonitoring = ({ seed }: { seed?: MonitoringSeed } = {}): MonitoringClient => {
  const errors = seed?.errors ?? {};
  return {
    errorsSince: async ({ deploy }) => errors[deploy] ?? [],
  };
};
