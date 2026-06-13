import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { RunDetailView } from "@/components/run-detail/run-detail";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const qc = getQueryClient();
  await Promise.all([
    qc.prefetchQuery(trpc.runs.byId.queryOptions({ runId })),
    qc.prefetchQuery(trpc.repos.queryOptions()),
    qc.prefetchQuery(trpc.metrics.queryOptions()),
  ]);
  return (
    <HydrateClient>
      <Suspense fallback={<div className="p-6 caption">Loading…</div>}>
        <RunDetailView runId={runId} />
      </Suspense>
    </HydrateClient>
  );
}
