import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter, createContext } from "@autogate/api";
import { createMockDashboardApi } from "./mock-dashboard";

/**
 * DB-free API server backed by the in-memory mock `DashboardApi`. Serves the
 * same `appRouter` as `index.ts` so the dashboard can run end-to-end against the
 * rich fixtures (every decision/status state) without Postgres — handy for UI
 * development and smoke tests.
 */
const PORT = Number(process.env.PORT ?? 3002);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const dashboard = createMockDashboardApi();
const server = createHTTPServer({
  router: appRouter,
  createContext: createContext({ dashboard }),
  middleware: cors({ origin: WEB_ORIGIN }),
});

server.listen(PORT);
console.log(`🚪 autogate api (mock, tRPC) listening on http://localhost:${PORT}`);
