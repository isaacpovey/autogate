import Link from "next/link";
import { Icon } from "@/components/primitives/icon";

export function IncidentBar({ title, href }: { title: string; href: string }) {
  return (
    <div
      className="settle"
      style={{
        padding: "16px 22px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--fail-tint)",
        borderTop: "1px solid color-mix(in srgb, var(--fail) 35%, transparent)",
        borderBottom: "1px solid color-mix(in srgb, var(--fail) 35%, transparent)",
      }}
    >
      <span className="pulse-dot" style={{ width: 9, height: 9, borderRadius: 9, background: "var(--fail)", flexShrink: 0, boxShadow: "0 0 0 4px var(--fail-tint)" }} />
      <Icon name="incident" size={17} style={{ color: "var(--fail)" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 500 }}>Errors rising in production</span>
        <span style={{ fontSize: 13.5, color: "var(--fg-muted)" }}> — {title}</span>
      </div>
      <Link
        href={href}
        className="focusable"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 14px",
          borderRadius: 6,
          background: "transparent",
          color: "var(--fail)",
          fontSize: 13,
          fontWeight: 500,
          border: "1px solid color-mix(in srgb, var(--fail) 50%, transparent)",
        }}
      >
        Inspect <Icon name="arrowRight" size={14} />
      </Link>
    </div>
  );
}
