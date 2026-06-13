const AVATAR_TINTS = ["var(--info)", "var(--effort)", "var(--pass)", "var(--warn)", "var(--incon)"];

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length;
  const c = AVATAR_TINTS[idx];
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 500,
        color: c,
        background: `color-mix(in srgb, ${c} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 26%, transparent)`,
      }}
    >
      {initials}
    </span>
  );
}
