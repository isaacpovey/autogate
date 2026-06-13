import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter, createContext } from "@autogate/api";
import { createMockDashboardApi } from "./mock-dashboard";

const PORT = Number(process.env.PORT ?? 3002);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

/**
 * Orchestrator/API HTTP server. Serves the `@autogate/api` tRPC router over a
 * framework-free Node server (this is what replaced the planned Hono setup).
 *
 * Dependency injection happens here at the boundary: the in-memory mock
 * `DashboardApi` is wired into the request context. When ticket 01 lands the
 * real Store/orchestrator-backed provider, this single argument changes — no
 * router, procedure, or dashboard edits.
 */
const dashboard = createMockDashboardApi();

const server = createHTTPServer({
  router: appRouter,
  createContext: createContext({ dashboard }),
  middleware: cors({ origin: WEB_ORIGIN }),
});

server.listen(PORT);
console.log(`🚪 autogate api (tRPC) listening on http://localhost:${PORT}`);
