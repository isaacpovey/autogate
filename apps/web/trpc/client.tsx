"use client";

import { useState } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@autogate/api";
import { makeQueryClient } from "./query-client";
import { getApiUrl } from "./shared";

/**
 * Modern `@trpc/tanstack-react-query` integration: `useTRPC()` returns a typed
 * proxy whose `.queryOptions()` / `.mutationOptions()` feed native TanStack
 * Query hooks. No legacy `trpc.x.useQuery()` hooks.
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always a fresh client so requests never share cache.
    return makeQueryClient();
  }
  // Browser: reuse one client across renders to avoid refetch-on-remount.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function TRPCReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: getApiUrl() })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
