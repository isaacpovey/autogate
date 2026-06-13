import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { mockStore } from "@autogate/contracts";
import { appRouter, createContext } from "@autogate/api";
import { storeSeed } from "./seed";

const PORT = Number(process.env.PORT ?? 3002);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

/**
 * Orchestrator/API HTTP server. Serves the `@autogate/api` tRPC router over a
 * framework-free Node server (this is what replaced the planned Hono setup).
 *
 * Dependency injection happens here at the boundary: the seeded in-memory
 * `mockStore` from `@autogate/contracts` is wired into the request context.
 * Swapping in the real Postgres `Store` (ticket 03) means changing this one
 * argument — no router or procedure edits.
 */
const store = mockStore({ seed: storeSeed });

const server = createHTTPServer({
  router: appRouter,
  createContext: createContext({ store }),
  middleware: cors({ origin: WEB_ORIGIN }),
});

server.listen(PORT);
console.log(`🚪 autogate api (tRPC) listening on http://localhost:${PORT}`);
