import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { TrustView } from "@/components/stats/trust-view";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const qc = getQueryClient();
  await Promise.all([
    qc.prefetchQuery(trpc.metrics.queryOptions()),
    qc.prefetchQuery(trpc.repos.queryOptions()),
    qc.prefetchQuery(trpc.runs.list.queryOptions({ limit: 100 })),
  ]);
  return (
    <HydrateClient>
      <Suspense fallback={<div className="p-6 caption">Loading…</div>}>
        <TrustView />
      </Suspense>
    </HydrateClient>
  );
}
