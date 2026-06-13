import { VerdictGlyph } from "@/components/primitives/verdict-glyph";

export function EmptyNeedsYou({ filtered }: { filtered: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "54px 22px", gap: 12, textAlign: "center" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--pass-tint)",
          border: "1px solid color-mix(in srgb, var(--pass) 30%, transparent)",
          boxShadow: "var(--lit-edge)",
        }}
      >
        <VerdictGlyph verdict="pass" size={22} />
      </div>
      <div style={{ fontSize: 15, color: "var(--fg)", fontWeight: 450 }}>Nothing needs you right now</div>
      <div className="caption" style={{ maxWidth: 360, lineHeight: 1.5 }}>
        {filtered ? "No runs in this repo are waiting on a human." : "The system is handling everything in flight."}
      </div>
    </div>
  );
}
