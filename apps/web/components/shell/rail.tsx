"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Icon } from "@/components/primitives/icon";
import { Emblem, Lockup } from "./brand";
import { useTheme } from "./theme-provider";

function RailItem({
  icon,
  label,
  active,
  collapsed,
  href,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  href?: string;
  onClick?: () => void;
  badge?: number;
}) {
  const inner = (
    <>
      {active && (
        <span
          style={{
            position: "absolute",
            left: collapsed ? 6 : 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2.5,
            height: 17,
            borderRadius: 2,
            background: "var(--brand)",
          }}
        />
      )}
      <span style={{ display: "flex", color: active ? "var(--fg)" : "var(--fg-muted)" }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span
          className="tnum"
          style={{ fontSize: 11, color: "var(--warn)", background: "var(--warn-tint)", borderRadius: 5, padding: "0 6px", minWidth: 18, textAlign: "center" }}
        >
          {badge}
        </span>
      )}
    </>
  );
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 11,
    width: "100%",
    padding: collapsed ? "0" : "0 12px",
    height: 36,
    justifyContent: collapsed ? "center" : "flex-start",
    borderRadius: 7,
    border: "none",
    background: active ? "var(--bg-active)" : "transparent",
    color: active ? "var(--fg)" : "var(--fg-2)",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    position: "relative",
  };
  if (href)
    return (
      <Link href={href} className="focusable" title={collapsed ? label : undefined} style={style}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className="focusable" title={collapsed ? label : undefined} style={style}>
      {inner}
    </button>
  );
}

export function Rail() {
  const [collapsed, setCollapsed] = useState(false);
  const trpc = useTRPC();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeRepo = params.get("repo");
  const { theme, toggle } = useTheme();

  const { data: repos } = useQuery(trpc.repos.queryOptions());
  const { data: runList } = useQuery(trpc.runs.list.queryOptions({ limit: 100 }));
  const runs = runList?.items ?? [];
  const needs = (repo?: string) =>
    runs.filter(
      (r) =>
        (r.decision === "escalate" || r.decision === "blocked") &&
        r.status === "completed" &&
        (repo ? r.pr.repo === repo : true),
    ).length;

  const onReviews = pathname === "/";
  return (
    <div
      style={{
        width: collapsed ? 56 : 220,
        flexShrink: 0,
        background: "var(--bg-rail)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        transition: "width 180ms cubic-bezier(.22,.61,.36,1)",
      }}
    >
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          padding: collapsed ? 0 : "0 16px",
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {collapsed ? <Emblem size={20} /> : <Lockup height={20} />}
      </div>

      <div style={{ flex: 1, padding: collapsed ? "10px 8px" : "10px 12px", display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
        <RailItem icon={<Icon name="releases" size={17} />} label="Open reviews" active={onReviews && !activeRepo} collapsed={collapsed} href="/" badge={needs()} />
        <RailItem icon={<Icon name="stats" size={17} />} label="Stats" active={pathname === "/stats"} collapsed={collapsed} href="/stats" />

        {!collapsed && <div className="label" style={{ margin: "18px 12px 6px", color: "var(--fg-faint)" }}>Repositories</div>}
        {collapsed && <div style={{ height: 1, background: "var(--line)", margin: "12px 6px" }} />}
        {(repos ?? []).map((r) => {
          const active = activeRepo === r.id && onReviews;
          const n = needs(r.id);
          return (
            <Link
              key={r.id}
              href={active ? "/" : `/?repo=${encodeURIComponent(r.id)}`}
              className="focusable"
              title={collapsed ? r.name : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                height: 32,
                padding: collapsed ? 0 : "0 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 7,
                background: active ? "var(--bg-active)" : "transparent",
                color: active ? "var(--fg)" : "var(--fg-muted)",
                fontSize: 12.5,
              }}
            >
              <Icon name="repo" size={15} style={{ color: active ? "var(--fg-2)" : "var(--fg-faint)" }} />
              {!collapsed && <span className="mono" style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", fontSize: 12 }}>{r.name}</span>}
              {!collapsed && n > 0 && <span className="tnum" style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>{n}</span>}
            </Link>
          );
        })}
      </div>

      <div style={{ padding: collapsed ? "10px 8px" : "10px 12px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 2 }}>
        <RailItem icon={<Icon name={theme === "dark" ? "sun" : "moon"} size={16} />} label={theme === "dark" ? "Light mode" : "Dark mode"} collapsed={collapsed} onClick={toggle} />
        <RailItem icon={<Icon name="panel" size={16} />} label="Collapse" collapsed={collapsed} onClick={() => setCollapsed((c) => !c)} />
      </div>
    </div>
  );
}
