"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "../../trpc/client";

/**
 * Proves the end-to-end typed contract: `health` and `runs` come straight from
 * the `AppRouter` — `run` and `health` are fully inferred, no `any`/`as`.
 * Rename a field in the server's procedure and this component stops compiling.
 *
 * Uses `useSuspenseQuery` against the server-prefetched cache (see `page.tsx`),
 * so it renders with data on first paint.
 */
export function RunsList() {
  const trpc = useTRPC();
  const { data: health } = useSuspenseQuery(trpc.health.queryOptions());
  const { data: runs } = useSuspenseQuery(
    trpc.runs.list.queryOptions({ limit: 20 }),
  );

  return (
    <section>
      <p>
        API status: <strong>{health.status}</strong>{" "}
        <small>({health.time})</small>
      </p>
      <ul>
        {runs.map((run) => (
          <li key={run.runId}>
            <code>{run.pr.repo}</code> #{run.pr.number} — {run.pr.title} —{" "}
            <strong>{run.decision}</strong> (risk {run.riskScore})
          </li>
        ))}
      </ul>
    </section>
  );
}
