import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "../trpc/server";
import { RunsList } from "./_components/runs-list";
import styles from "./page.module.css";

export default async function Home() {
  const queryClient = getQueryClient();

  // Prefetch on the server so the client hydrates with data on first paint.
  await Promise.all([
    queryClient.prefetchQuery(trpc.health.queryOptions()),
    queryClient.prefetchQuery(trpc.runs.list.queryOptions({ limit: 20 })),
  ]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Autogate — runs</h1>
        <p>Served over tRPC from the orchestrator/API, typed end-to-end.</p>
        <HydrateClient>
          <Suspense fallback={<p>Loading runs…</p>}>
            <RunsList />
          </Suspense>
        </HydrateClient>
      </main>
    </div>
  );
}
