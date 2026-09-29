"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "success" | "info" | "error"; node: ReactNode };
type ToastFn = (node: ReactNode, kind?: Toast["kind"]) => void;
const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const toast = useCallback<ToastFn>((node, kind = "success") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, kind, node }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toasts">{list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.node}</div>)}</div>
    </Ctx.Provider>
  );
}
