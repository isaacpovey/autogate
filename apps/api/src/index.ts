import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter, createContext } from "@autogate/api";
import {
  createMetricsQueries,
  createRunResults,
  createStore,
  runMigrations,
} from "@autogate/store-postgres";
import { repoConfigs } from "@autogate/infra/repo-configs";
import { createStoreDashboardApi } from "./dashboard";

const PORT = Number(process.env.PORT ?? 3002);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://autogate:autogate@localhost:5432/autogate";

/**
 * Orchestrator/API HTTP server. Serves the `@autogate/api` tRPC router over a
 * framework-free Node server.
 *
 * Dependency injection happens here at the boundary: the real, Store-backed
 * `DashboardApi` provider is wired into the request context (ticket 01 remainder
 * — the planned one-line swap from the in-memory mock). Migrations run on boot so
 * a fresh DB serves immediately; the dashboard reads live runs/verdicts plus the
 * per-run snapshots `runPipeline` persists.
 */
const main = async (): Promise<void> => {
  await runMigrations({ connectionString: DATABASE_URL });

  const store = createStore({ connectionString: DATABASE_URL });
  const runResults = createRunResults({ connectionString: DATABASE_URL });
  const { listOverrides } = createMetricsQueries({ connectionString: DATABASE_URL });
  const dashboard = createStoreDashboardApi({ store, runResults, listOverrides, repoConfigs });

  const server = createHTTPServer({
    router: appRouter,
    createContext: createContext({ dashboard }),
    middleware: cors({ origin: WEB_ORIGIN }),
  });

  server.listen(PORT);
  console.log(`🚪 autogate api (tRPC) listening on http://localhost:${PORT}`);
};

main().catch((error) => {
  console.error("api: fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
