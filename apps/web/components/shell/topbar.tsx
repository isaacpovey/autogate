"use client";

import Link from "next/link";
import { useQuery, useQueries, useIsFetching } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Icon } from "@/components/primitives/icon";
import { useToast } from "./toast";
import { agreementPct, deriveIncident } from "@/lib/view-model";

export function Topbar() {
  const trpc = useTRPC();
  const { toast } = useToast();
  const fetching = useIsFetching() > 0;

  const { data: metrics } = useQuery(trpc.metrics.queryOptions());
  const { data: runList } = useQuery(trpc.runs.list.queryOptions({ limit: 100 }));

  const mergedIds = (runList?.items ?? []).filter((r) => r.decision === "merged").map((r) => r.runId);
  const details = useQueries({ queries: mergedIds.map((id) => trpc.runs.byId.queryOptions({ runId: id })) });
  const incident = details.map((d) => d.data).find((d) => d && deriveIncident(d));

  const lastRate = metrics?.agreementRate.at(-1)?.rate;
  const agreement = lastRate != null ? agreementPct(lastRate) : null;

  return (
    <div
      style={{
        height: 46,
        flexShrink: 0,
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 18px",
        background: "var(--bg)",
      }}
    >
      {incident ? (
        <Link
          href={`/runs/${incident.runId}`}
          className="focusable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 11px",
            borderRadius: 6,
            background: "var(--fail-tint)",
            border: "1px solid var(--fail-edge)",
            color: "var(--fail)",
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: 7, background: "var(--fail)" }} />1 incident
        </Link>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-muted)" }}>
          <span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--pass)", opacity: 0.7 }} />all systems nominal
        </span>
      )}

      {agreement != null && (
        <>
          <span style={{ width: 1, height: 16, background: "var(--line-2)" }} />
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            agreement <span className="tnum" style={{ color: "var(--fg-2)", fontWeight: 500 }}>{agreement}%</span>
          </span>
        </>
      )}

      <div style={{ flex: 1 }} />

      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--fg-faint)" }}>
        <span className={fetching ? "pulse-dot" : ""} style={{ width: 6, height: 6, borderRadius: 6, background: "var(--pass)", opacity: 0.6 }} />
        live
      </span>
      <button
        onClick={() => toast("Runs are created automatically by CI when code is pushed.")}
        className="focusable"
        title="New runs are created by CI on push"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, background: "var(--brand)", border: "none" }}
      >
        <Icon name="plus" size={16} style={{ color: "#fff" }} />
      </button>
    </div>
  );
}
