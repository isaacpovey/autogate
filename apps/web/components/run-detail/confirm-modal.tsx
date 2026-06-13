import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type ConfirmAction = "approve_merge" | "block" | "rollback";

const CFG: Record<ConfirmAction, { title: string; c: string; cta: string }> = {
  approve_merge: { title: "Approve & merge", c: "var(--pass)", cta: "Approve & merge" },
  block: { title: "Block this change", c: "var(--fail)", cta: "Block change" },
  rollback: { title: "Roll back from production", c: "var(--fail)", cta: "Roll back now" },
};

export function ConfirmModal({
  open,
  action,
  reason,
  pr,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  action: ConfirmAction;
  reason: string;
  pr: { title: string; author: string };
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cfg = CFG[action];
  const body =
    action === "approve_merge" ? (
      <>Merge <b>{pr.title}</b> to <code className="mono" style={{ color: "var(--fg)" }}>main</code> and begin canary rollout at 25%? The change will start reaching real users.</>
    ) : action === "block" ? (
      <>Block <b>{pr.title}</b> from merging? It will not reach production, and the author ({pr.author}) will be notified.</>
    ) : (
      <>Roll back <b>{pr.title}</b> from production? This reverts the change for all users immediately and stops the canary.</>
    );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent showCloseButton={false} className="border-line-2 bg-[var(--bg-raised)] p-[22px] sm:max-w-[460px]">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: cfg.c }} />
          <DialogTitle className="display-face" style={{ fontSize: 16, fontWeight: 500, color: "var(--fg)" }}>{cfg.title}</DialogTitle>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--fg-2)" }}>{body}</p>
        <div style={{ padding: "11px 13px", borderRadius: 7, background: "var(--bg)", border: "1px solid var(--line)", marginBottom: 18 }}>
          <div className="label" style={{ marginBottom: 5 }}>recorded reason</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)" }}>{reason}</p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} className="focusable" style={{ padding: "9px 16px", borderRadius: 7, background: "transparent", color: "var(--fg-2)", fontSize: 13.5, border: "1px solid var(--line-2)" }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="focusable"
            style={{ padding: "9px 18px", borderRadius: 7, background: cfg.c, color: "var(--bg)", fontSize: 13.5, fontWeight: 500, border: `1px solid ${cfg.c}`, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Working…" : cfg.cta}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
