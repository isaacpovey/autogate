import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

/**
 * Factory for a TanStack QueryClient. Used in three places with different
 * lifetimes: a fresh one per request on the server, a singleton in the browser,
 * and a cached-per-request one for RSC prefetching (see `server.tsx`).
 *
 * `shouldDehydrateQuery` is extended to also dehydrate *pending* queries so
 * server-prefetched data streams to the client without a loading flash.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
