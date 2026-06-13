import "server-only";

import { cache } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@autogate/api";
import { makeQueryClient } from "./query-client";
import { getApiUrl } from "./shared";

/**
 * One QueryClient per RSC request, cached so a Server Component's prefetch and
 * the `HydrateClient` boundary below share the same instance.
 */
export const getQueryClient = cache(makeQueryClient);

const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: getApiUrl() })],
});

/**
 * Server-side typed proxy. Use in Server Components to build `queryOptions`
 * for prefetching, e.g.
 *   await getQueryClient().prefetchQuery(trpc.runs.list.queryOptions({ limit: 20 }))
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient: getQueryClient,
});

/** Streams the server-prefetched cache to the client for hydration. */
export function HydrateClient({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
