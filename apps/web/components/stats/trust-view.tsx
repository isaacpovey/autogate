"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { agreementPct } from "@/lib/view-model";
import { StatTile } from "./stat-tile";
import { Panel } from "./panel";
import { AgreementChart, OverridesChart } from "./charts";

export function TrustView() {
  const trpc = useTRPC();
  const { data: m } = useSuspenseQuery(trpc.metrics.queryOptions());

  const agree = m.agreementRate;
  const first = agree[0];
  const last = agree.at(-1);
  const now = last ? agreementPct(last.rate) : null;
  const delta = first && last ? agreementPct(last.rate) - agreementPct(first.rate) : 0;
  const precision = Math.round(m.escalation.precision * 100);
  const recall = Math.round(m.escalation.recall * 100);

  // honest-dip detection: lowest agreement point is not the most recent
  const minIdx = agree.reduce((mi, d, i, a) => (d.rate < a[mi]!.rate ? i : mi), 0);
  const dip = agree.length > 2 && minIdx !== agree.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 22px", height: 52, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <h1 className="display-face" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Trust</h1>
        <span className="caption">is the system&apos;s judgment good enough to trust with more autonomy?</span>
      </div>
      <div className="scroll" style={{ flex: 1 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 40px 80px" }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 30 }}>
            <StatTile label="agreement rate" value={now ?? "—"} unit={now != null ? "%" : undefined} sub={delta ? `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} pts since first week` : "human vs system, latest"} />
            <StatTile label="escalation precision" value={precision} unit="%" sub="of escalations, share a human agreed needed review" />
            <StatTile label="escalation recall" value={recall} unit="%" sub="of changes needing review, share it caught" />
          </div>

          <Panel title="Agreement rate over time" sub="human vs system">
            <AgreementChart data={agree} />
            {dip && (
              <p className="caption" style={{ margin: "14px 0 0", maxWidth: 640 }}>
                The curve dips before recovering — an honest agreement trend has setbacks, not a straight climb.
              </p>
            )}
          </Panel>

          <Panel title="Human overrides per week" sub="ideally declining">
            <OverridesChart data={m.overridesPerWeek} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
