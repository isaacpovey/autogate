import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ReleaseStream } from "@/components/stream/release-stream";

export const dynamic = "force-dynamic";

export default async function OpenReviews({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;
  const qc = getQueryClient();
  await Promise.all([
    qc.prefetchQuery(trpc.runs.list.queryOptions({ limit: 50, ...(repo ? { repo } : {}) })),
    qc.prefetchQuery(trpc.repos.queryOptions()),
    qc.prefetchQuery(trpc.metrics.queryOptions()),
  ]);
  return (
    <HydrateClient>
      <Suspense fallback={<div className="p-6 caption">Loading…</div>}>
        <ReleaseStream />
      </Suspense>
    </HydrateClient>
  );
}
