"use client";
// Offline boxes: the banner on the TVs page and the recovery panel inside the box dialog.
import { useState } from "react";
import { fmtT, since, tvsOn, type Box, type Model } from "@/lib/client/model";

export type RecoverFn = (boxId: string, action: "retry" | "wake" | "cycle" | "move", toBoxId?: string) => Promise<void>;

export function OfflineBanner({ m, onOpen, onRecover }: { m: Model; onOpen: (id: string) => void; onRecover: RecoverFn }) {
  const down = m.boxes.filter((b) => b.online === false);
  if (!down.length) return null;
  return (
    <div className="alert warn" style={{ marginBottom: 12 }}>
      <span className="ico">⚠</span>
      <div style={{ flex: 1 }}>
        <b>{down.length === 1 ? `${down[0].name} is not responding` : `${down.length} boxes are not responding`}</b>
        <div className="feeds">
          {down.map((b) => { const n = tvsOn(m, b.id).length; return (
            <span key={b.id} className="pill" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              {b.name} · {b.offlineSince ? `since ${fmtT(b.offlineSince)} (${since(b.offlineSince)})` : "offline"}{n ? ` · ${n} screen${n > 1 ? "s" : ""} affected` : ""}
              <button className="btn outline sm" style={{ height: 24, padding: "0 8px", fontSize: 11 }} onClick={() => onOpen(b.id)}>Fix</button>
              {n > 0 && <button className="btn primary sm" style={{ height: 24, padding: "0 8px", fontSize: 11 }} onClick={() => onRecover(b.id, "move")}>Move screens</button>}
            </span>
          ); })}
        </div>
      </div>
    </div>
  );
}

export function RecoveryPanel({ m, box, onRecover }: { m: Model; box: Box; onRecover: RecoverFn }) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmCycle, setConfirmCycle] = useState(false);
  const n = tvsOn(m, box.id).length;
  const run = async (a: "retry" | "wake" | "cycle" | "move", to?: string) => { setBusyAction(a); try { await onRecover(box.id, a, to); } finally { setBusyAction(null); setConfirmCycle(false); } };
  const candidates = m.boxes.filter((b) => b.id !== box.id && b.online !== false);
  const sameCh = candidates.find((b) => box.channel && b.channel === box.channel);
  return (
    <div className="alert warn" style={{ flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10 }}><span className="ico">⚠</span><div>
        <b>{box.name} is not responding</b>{box.offlineSince ? ` since ${fmtT(box.offlineSince)} (${since(box.offlineSince)})` : ""}.
        {box.error ? <div className="small" style={{ marginTop: 2 }}>{box.error}</div> : null}
        {n > 0 && <div className="small" style={{ marginTop: 2 }}>{n} screen{n > 1 ? "s" : ""} on the floor {n > 1 ? "are" : "is"} showing this box.</div>}
      </div></div>
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button className="btn outline sm" disabled={!!busyAction} onClick={() => run("retry")}>{busyAction === "retry" ? "Checking…" : "Retry"}</button>
        <button className="btn outline sm" disabled={!!busyAction} onClick={() => run("wake")} title="Sends power-on. Works when the box is in standby.">{busyAction === "wake" ? "Waking…" : "Wake"}</button>
        {box.powerControl ? (
          confirmCycle
            ? <><button className="btn destructive sm" disabled={!!busyAction} onClick={() => run("cycle")}>{busyAction === "cycle" ? "Rebooting…" : "Yes, power cycle (about 1 min)"}</button><button className="btn outline sm" onClick={() => setConfirmCycle(false)}>Cancel</button></>
            : <button className="btn outline sm" disabled={!!busyAction} onClick={() => setConfirmCycle(true)}>Power cycle…</button>
        ) : <span className="small" title="Configure boxes[].power in the site file when a switched outlet exists">Power cycle: no outlet control set up</span>}
      </div>
      {n > 0 && (
        <div className="actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn primary sm" disabled={!!busyAction} onClick={() => run("move")}>{busyAction === "move" ? "Moving…" : `Move ${n} screen${n > 1 ? "s" : ""} to ${sameCh ? `${sameCh.name} (same channel)` : "the best free box"}`}</button>
          <select className="loc" style={{ display: "inline-block" }} aria-label="Move to a specific box" disabled={!!busyAction} defaultValue="" onChange={(e) => { if (e.target.value) run("move", e.target.value); }}>
            <option value="">or pick a box…</option>
            {candidates.map((b) => <option key={b.id} value={b.id}>{b.name}{b.channel ? ` · ch ${b.channel}` : ""} · {tvsOn(m, b.id).length} screens</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
