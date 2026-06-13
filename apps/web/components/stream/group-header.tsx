import { Icon } from "@/components/primitives/icon";

export function GroupHeader({
  glyph,
  label,
  count,
  sub,
  right,
  collapsed,
  onToggle,
}: {
  glyph?: React.ReactNode;
  label: string;
  count?: number;
  sub?: string;
  right?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "0 22px",
        height: 46,
        cursor: onToggle ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {onToggle && (
        <Icon
          name="chevronRight"
          size={15}
          style={{ color: "var(--fg-muted)", transition: "transform 140ms ease", transform: collapsed ? "none" : "rotate(90deg)" }}
        />
      )}
      {glyph}
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em" }}>{label}</span>
      {count != null && <span className="tnum" style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{count}</span>}
      {sub && <span className="caption" style={{ marginLeft: 2 }}>{sub}</span>}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}
