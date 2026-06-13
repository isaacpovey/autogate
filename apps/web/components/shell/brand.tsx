/* The three-bar "barcode" emblem (theme-aware via currentColor) + wordmark. */
const EMBLEM_PATHS = `<path d="M25 0.999999C25 0.447714 25.4477 0 26 0H27C27.5523 0 28 0.447715 28 1V43C28 43.5523 27.5523 44 27 44H26C25.4477 44 25 43.5523 25 43V0.999999Z" fill="currentColor"></path><path d="M20 1C20 0.447715 20.4477 0 21 0H22C22.5523 0 23 0.447715 23 1V14C23 14.5523 22.5523 15 22 15H21C20.4477 15 20 14.5523 20 14V1Z" fill="currentColor"></path><path d="M15 1C15 0.447715 15.4477 0 16 0H17C17.5523 0 18 0.447715 18 1V14C18 14.5523 17.5523 15 17 15H16C15.4477 15 15 14.5523 15 14V1Z" fill="currentColor"></path><path d="M15 28C15 27.4477 15.4477 27 16 27H17C17.5523 27 18 27.4477 18 28V35C18 35.5523 17.5523 36 17 36H16C15.4477 36 15 35.5523 15 35V28Z" fill="currentColor"></path><path d="M20 28C20 27.4477 20.4477 27 21 27H22C22.5523 27 23 27.4477 23 28V35C23 35.5523 22.5523 36 22 36H21C20.4477 36 20 35.5523 20 35V28Z" fill="currentColor"></path><path d="M10 0.999999C10 0.447714 10.4477 0 11 0H12C12.5523 0 13 0.447715 13 1V43C13 43.5523 12.5523 44 12 44H11C10.4477 44 10 43.5523 10 43V0.999999Z" fill="currentColor"></path><rect x="30" y="16" width="3" height="28" rx="1" fill="currentColor"></rect><rect x="5" y="16" width="3" height="28" rx="1" fill="currentColor"></rect><rect x="35" y="31" width="3" height="13" rx="1" fill="currentColor"></rect><rect y="31" width="3" height="13" rx="1" fill="currentColor"></rect>`;

export function Emblem({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={(size * 38) / 44}
      height={size}
      viewBox="0 0 38 44"
      fill="none"
      style={{ display: "block", color: "var(--fg)", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: EMBLEM_PATHS }}
    />
  );
}

export function Lockup({ height = 20 }: { height?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Emblem size={height} />
      <span
        className="display-face"
        style={{
          fontSize: height * 0.92,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: "var(--fg)",
          lineHeight: 1,
        }}
      >
        autogate
      </span>
    </span>
  );
}
