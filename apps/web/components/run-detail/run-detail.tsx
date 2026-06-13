"use client";

import Link from "next/link";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { needsHumanCount } from "@/lib/view-model";
import type { RunDetail as RunDetailT } from "@/lib/api-types";
import { useToast } from "@/components/shell/toast";
import { Icon } from "@/components/primitives/icon";
import { StatusPill } from "@/components/primitives/pills";
import { Avatar } from "@/components/primitives/avatar";
import { RiskNumeral } from "@/components/primitives/risk";
import { TallyTiles } from "@/components/primitives/tally";
import { OrchestratorBrief, AssessingPanel } from "./orchestrator-brief";
import { Evidence } from "./evidence";
import { ActionBlock, type ActPayload } from "./action-block";
import { Timeline } from "./timeline";

export function RunDetailView({ runId }: { runId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: run } = useSuspenseQuery(trpc.runs.byId.queryOptions({ runId }, { refetchInterval: 4000 }));

  const override = useMutation(trpc.runs.override.mutationOptions());
  const rollback = useMutation(trpc.runs.rollback.mutationOptions());
  const pending = override.isPending || rollback.isPending;

  const settle = (updated: RunDetailT, msg: string) => {
    qc.setQueryData(trpc.runs.byId.queryKey({ runId }), updated);
    qc.invalidateQueries();
    toast(msg);
  };
  const onAct = ({ action, reason }: ActPayload) => {
    if (action === "rollback") {
      rollback.mutate({ runId }, { onSuccess: (d) => settle(d, "Rolled back from production · reverted for all users") });
    } else {
      override.mutate(
        { runId, action, reason },
        { onSuccess: (d) => settle(d, action === "approve_merge" ? "Approved & merged · canary at 25%" : "Change blocked · author notified") },
      );
    }
  };

  const isRunning = run.status === "running" || run.status === "awaiting_checks";

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 40px 80px" }}>
        <Link href="/" className="focusable" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--fg-muted)", fontSize: 13, padding: "4px 0", marginBottom: 18 }}>
          <Icon name="arrowLeft" size={15} /> open reviews
        </Link>

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", marginBottom: 22 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 12 }}>
              <StatusPill decision={run.decision.outcome} status={run.status} size="lg" />
            </div>
            <h1 className="display-face" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.18, letterSpacing: "-0.02em", margin: "0 0 10px", color: "var(--fg)" }}>{run.pr.title}</h1>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{run.pr.repo}</span><span style={{ opacity: 0.5 }}>·</span>
              <span>#{run.pr.number}</span><span style={{ opacity: 0.5 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Avatar name={run.pr.author} size={16} />{run.pr.author}</span><span style={{ opacity: 0.5 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={12} />{run.pr.branch}</span>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <RiskNumeral score={run.riskScore} />
          </div>
        </div>

        <div style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <TallyTiles summary={run.checkSummary} needsHuman={needsHumanCount(run.checks)} size="lg" />
        </div>

        <div style={{ marginBottom: 26 }}>{isRunning ? <AssessingPanel run={run} /> : <OrchestratorBrief run={run} />}</div>

        <Evidence run={run} />

        {!isRunning && (
          <div style={{ marginBottom: 30 }}>
            <ActionBlock run={run} onAct={onAct} pending={pending} />
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <Timeline run={run} />
        </div>
      </div>
    </div>
  );
}
