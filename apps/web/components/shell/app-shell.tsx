"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Rail } from "./rail";
import { Topbar } from "./topbar";
import { ToastProvider } from "./toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <ToastProvider>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <Rail />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
            <Topbar />
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</div>
          </div>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
