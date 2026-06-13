"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const Ctx = createContext<{ toast: (msg: string) => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => setMsg(m), []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {msg && <ToastView msg={msg} onDone={() => setMsg(null)} />}
    </Ctx.Provider>
  );
}

function ToastView({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return (
    <div
      className="popin"
      style={{
        position: "fixed",
        bottom: 22,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        background: "var(--bg-raised-2)",
        border: "1px solid var(--line-2)",
        borderRadius: 8,
        padding: "10px 16px",
        boxShadow: "var(--shadow-pop)",
        fontSize: 13,
        color: "var(--fg)",
      }}
    >
      {msg}
    </div>
  );
}
