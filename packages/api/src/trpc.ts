import { initTRPC } from "@trpc/server";
import type { Context } from "./context";

/**
 * tRPC instance, bound to our request {@link Context}.
 *
 * No data transformer is configured: payloads are plain JSON and our contract
 * types use string timestamps (see `schemas.ts`). If we later need to send
 * richer types (Date, Map, bigint) over the wire, add a transformer here and
 * mirror it on the client.
 */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Used by tests/SSR to call procedures directly without an HTTP round-trip. */
export const createCallerFactory = t.createCallerFactory;
