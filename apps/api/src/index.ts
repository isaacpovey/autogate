import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter, createContext, mockStore } from "@autogate/api";

const PORT = Number(process.env.PORT ?? 3002);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

/**
 * Orchestrator/API HTTP server. Serves the `@autogate/api` tRPC router over a
 * framework-free Node server (this is what replaced the planned Hono setup).
 *
 * Dependency injection happens here at the boundary: the in-memory `mockStore`
 * is wired into the request context. Swapping in the real Postgres `Store`
 * (ticket 03) means changing this one argument — no router or procedure edits.
 */
const server = createHTTPServer({
  router: appRouter,
  createContext: createContext({ store: mockStore }),
  middleware: cors({ origin: WEB_ORIGIN }),
});

server.listen(PORT);
console.log(`🚪 autogate api (tRPC) listening on http://localhost:${PORT}`);
