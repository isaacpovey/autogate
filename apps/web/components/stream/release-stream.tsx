"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSuspenseQuery, useQueries } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { groupRuns, deriveIncident } from "@/lib/view-model";
import type { RunDetail } from "@/lib/api-types";
import { Icon } from "@/components/primitives/icon";
import { VerdictGlyph } from "@/components/primitives/verdict-glyph";
import { GroupHeader } from "./group-header";
import { Segmented } from "./segmented";
import { RunRow, StreamColHeader } from "./run-row";
import { AutoRow } from "./auto-row";
import { ProdCard } from "./prod-card";
import { IncidentBar } from "./incident-bar";
import { EmptyNeedsYou } from "./empty-needs-you";

type StatusFilter = "all" | "needs" | "prod" | "auto";

export function ReleaseStream() {
  const trpc = useTRPC();
  const params = useSearchParams();
  const repo = params.get("repo") ?? undefined;
  const input = { limit: 50, ...(repo ? { repo } : {}) };

  const { data } = useSuspenseQuery(trpc.runs.list.queryOptions(input, { refetchInterval: 5000 }));
  const runs = data.items;
  const { needsYou, inProgress, inProduction, autoMerged } = groupRuns(runs);

  // In-production cards + incident detection need full detail (monitoring/brief).
  const prodResults = useQueries({
    queries: inProduction.map((r) => trpc.runs.byId.queryOptions({ runId: r.runId })),
  });
  const prodDetails = prodResults.map((r) => r.data).filter((d): d is RunDetail => !!d);
  const incident = prodDetails.find((d) => deriveIncident(d));

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [prodOpen, setProdOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoLimit, setAutoLimit] = useState(3);
  const [expandedProd, setExpandedProd] = useState<Record<string, boolean>>({});

  const visible = (g: StatusFilter) => statusFilter === "all" || statusFilter === g;
  const prodExpanded = statusFilter === "prod" ? true : prodOpen;
  const autoExpanded = statusFilter === "auto" ? true : autoOpen;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px", height: 52, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <h1 className="display-face" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Open reviews</h1>
        <div style={{ flex: 1 }} />
        <Segmented<StatusFilter>
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { v: "all", l: "All" },
            { v: "needs", l: "Needs you" },
            { v: "prod", l: "In production" },
            { v: "auto", l: "Auto-merged" },
          ]}
        />
      </div>

      {repo && (
        <div style={{ padding: "8px 22px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 8px 4px 11px", borderRadius: 6, background: "var(--bg-raised)", border: "1px solid var(--line-2)", fontSize: 12, color: "var(--fg-2)" }}>
            <Icon name="repo" size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="mono">{repo}</span>
          </span>
        </div>
      )}

      <div className="scroll" style={{ flex: 1, paddingBottom: 60 }}>
        {incident && <IncidentBar title={incident.pr.title} href={`/runs/${incident.runId}`} />}

        {/* Tier 1 — Needs you */}
        {visible("needs") && (
          <div style={{ marginTop: incident ? 0 : 4 }}>
            <GroupHeader glyph={<span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--warn)" }} />} label="Needs you" count={needsYou.length} sub="quick → deep" />
            {needsYou.length === 0 ? (
              <EmptyNeedsYou filtered={!!repo} />
            ) : (
              <>
                <StreamColHeader />
                {needsYou.map((r) => (
                  <RunRow key={r.runId} run={r} />
                ))}
              </>
            )}
          </div>
        )}

        {/* In progress (running + awaiting checks) */}
        {visible("needs") && inProgress.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <GroupHeader glyph={<span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: 7, background: "var(--info)" }} />} label="In progress" count={inProgress.length} />
            <StreamColHeader />
            {inProgress.map((r) => (
              <RunRow key={r.runId} run={r} />
            ))}
          </div>
        )}

        {/* Tier 2 — Handled by the system */}
        {(visible("prod") || visible("auto")) && (inProduction.length > 0 || autoMerged.length > 0) && (
          <div style={{ marginTop: 22, padding: "0 22px 8px" }}>
            <span className="label" style={{ color: "var(--fg-faint)" }}>Handled by the system</span>
          </div>
        )}

        {visible("prod") && inProduction.length > 0 && (
          <div>
            <GroupHeader
              onToggle={() => setProdOpen((o) => !o)}
              collapsed={!prodExpanded}
              glyph={<Icon name="activity" size={15} style={{ color: "var(--fg-muted)" }} />}
              label="In production"
              count={inProduction.length}
            />
            {prodExpanded &&
              prodDetails.map((d) => (
                <ProdCard
                  key={d.runId}
                  run={d}
                  expanded={expandedProd[d.runId] ?? deriveIncident(d)}
                  onToggle={() => setExpandedProd((s) => ({ ...s, [d.runId]: !(s[d.runId] ?? deriveIncident(d)) }))}
                />
              ))}
          </div>
        )}

        {visible("auto") && autoMerged.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <GroupHeader onToggle={() => setAutoOpen((o) => !o)} collapsed={!autoExpanded} glyph={<VerdictGlyph verdict="pass" size={14} />} label="Auto-merged" count={autoMerged.length} sub="riskiest first" />
            {autoExpanded && (
              <>
                {autoMerged.slice(0, autoLimit).map((r) => (
                  <AutoRow key={r.runId} run={r} />
                ))}
                {autoLimit < autoMerged.length ? (
                  <button
                    onClick={() => setAutoLimit(autoMerged.length)}
                    className="focusable"
                    style={{ display: "block", width: "100%", textAlign: "center", padding: "11px", background: "none", border: "none", borderBottom: "1px solid var(--line)", color: "var(--fg-muted)", fontSize: 12.5 }}
                  >
                    Load {autoMerged.length - autoLimit} more
                  </button>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px", color: "var(--fg-faint)", fontSize: 11.5 }}>— end of auto-merged —</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
