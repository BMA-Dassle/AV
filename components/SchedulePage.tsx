"use client";
// Scheduled changes: what will change and when, what already ran, and a quick way to add one by hand.
// Today a change tunes a box (and can put it on screens); the list is built on action lists so it can grow to
// screens, walls and projectors across every box.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Catalog } from "@/lib/client/api";
import { chan, dayLabel, describeActions, fmtT, label, untilText, type GuideIndex, type Model, type Scheduled } from "@/lib/client/model";

const STATUS: Record<string, [string, string]> = { done: ["free", "Done"], failed: ["red", "Failed"], missed: ["gray", "Missed"], canceled: ["gray", "Canceled"], running: ["", "Running"], pending: ["", "Scheduled"] };
const nextHalfHour = () => { const d = new Date(Date.now() + 30 * 60000); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return d; };
const toLocalInput = (d: Date) => { const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export default function SchedulePage({ m, gi, cat, sel, onCreate, onCancel, onRunNow }: { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; onCreate: (r: { runAt: number; actions: Scheduled["actions"]; label: string; program: Scheduled["program"] }) => Promise<boolean>; onCancel: (id: string) => Promise<void>; onRunNow: (id: string) => Promise<void> }) {
  const [items, setItems] = useState<Scheduled[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { try { setItems((await api.schedule()).items); setErr(null); } catch (e: any) { setErr(e?.message || "Could not load the schedule"); } }, []);
  // reload when the shared list changes (another tablet added / a change ran) and every 30 s for history
  const sig = m.schedule.map((i) => `${i.id}:${i.status}:${i.runAt}`).join(",");
  useEffect(() => { void load(); }, [load, sig]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const now = Date.now();
  const upcoming = (items || []).filter((i) => i.status === "pending" || i.status === "running").sort((a, b) => a.runAt - b.runAt);
  const history = (items || []).filter((i) => i.status !== "pending" && i.status !== "running").sort((a, b) => (b.ranAt ?? b.runAt) - (a.ranAt ?? a.runAt));
  const byDay = useMemo(() => { const g = new Map<string, Scheduled[]>(); for (const i of upcoming) { const k = dayLabel(i.runAt); g.set(k, [...(g.get(k) || []), i]); } return [...g.entries()]; }, [upcoming]);

  // ---- add by hand ----
  const [boxId, setBoxId] = useState(m.boxes[0]?.id || "");
  const [num, setNum] = useState("");
  const [at, setAt] = useState(() => toLocalInput(nextHalfHour()));
  const [withSel, setWithSel] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!boxId && m.boxes[0]) setBoxId(m.boxes[0].id); }, [m.boxes, boxId]);
  const n = Number(num); const ci = n ? chan(gi, cat, n) : null; const runAt = new Date(at).getTime();
  const prog = n ? gi.byNum.get(n)?.programs.find((p) => p.start <= runAt && p.end > runAt) : undefined;
  const canAdd = boxId && Number.isInteger(n) && n > 0 && Number.isFinite(runAt) && runAt > now - 60000;
  const add = async () => {
    if (!canAdd) return; setSaving(true);
    const ids = [...sel];
    const ok = await onCreate({ runAt, label: prog && !prog.filler ? (prog.subtitle && prog.teams?.length ? prog.subtitle : prog.title) : `${ci?.cs || "CH"} ${n}`,
      actions: [{ type: "tune", boxId, channel: n }, ...(withSel && ids.length ? [{ type: "source" as const, tvIds: ids, sourceId: boxId }] : [])],
      program: prog ? { num: n, callsign: gi.byNum.get(n)?.callsign || "", title: prog.title, subtitle: prog.subtitle, start: prog.start, end: prog.end } : null });
    setSaving(false); if (ok) { setNum(""); void load(); }
  };

  return (
    <div className="sched">
      <div className="card schedadd">
        <div className="eyebrow">Add a scheduled change</div>
        <div className="row">
          <label><span>Box</span><select value={boxId} onChange={(e) => setBoxId(e.target.value)}>{m.boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>Channel</span><input inputMode="numeric" pattern="[0-9]*" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="206" /></label>
          <label><span>When</span><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
          <button className="btn primary" disabled={!canAdd || saving} onClick={() => void add()}>Schedule</button>
        </div>
        <div className="small">{ci ? <>{ci.cs} {n}{prog ? <> · at that time: <b>{prog.filler ? "nothing scheduled" : prog.subtitle && prog.teams?.length ? prog.subtitle : prog.title}</b></> : null}</> : "Or schedule from the Guide: tap a program and pick Change automatically."}
          {sel.size > 0 && <label className="check inline"><input type="checkbox" checked={withSel} onChange={(e) => setWithSel(e.target.checked)} /> also show it on the {sel.size} selected screen{sel.size > 1 ? "s" : ""} ({label(m, [...sel])})</label>}</div>
      </div>

      {err && <div className="alert warn"><span className="ico">⚠</span><div>{err}</div></div>}
      <div className="sec"><h2>Coming up</h2><span className="hint">{upcoming.length ? `${upcoming.length} scheduled change${upcoming.length > 1 ? "s" : ""}` : ""}</span></div>
      {items === null ? <div className="sempty">Loading…</div> : !upcoming.length ? <div className="sempty">Nothing scheduled. In the Guide, tap an upcoming game and choose <b>Change automatically</b>.</div> : byDay.map(([day, list]) => (
        <div key={day} className="sday">
          <div className="eyebrow">{day}</div>
          <div className="slist">
            {list.map((i) => <Row key={i.id} m={m} gi={gi} cat={cat} i={i} now={now} onCancel={onCancel} onRunNow={onRunNow} />)}
          </div>
        </div>
      ))}

      <div className="sec"><h2>History</h2><span className="hint">last 3 days</span></div>
      {!history.length ? <div className="sempty">No scheduled changes have run yet.</div> : (
        <div className="slist">{history.slice(0, 60).map((i) => <Row key={i.id} m={m} gi={gi} cat={cat} i={i} now={now} />)}</div>
      )}
      <div className="foot"><span>Changes run at their time on the server, and while the app is open on any device.</span></div>
    </div>
  );
}

function Row({ m, gi, cat, i, now, onCancel, onRunNow }: { m: Model; gi: GuideIndex; cat: Catalog; i: Scheduled; now: number; onCancel?: (id: string) => Promise<void>; onRunNow?: (id: string) => Promise<void> }) {
  const [cls, txt] = STATUS[i.status] || ["", i.status];
  const tune = i.actions.find((a) => a.type === "tune"); const color = tune && tune.type === "tune" ? m.boxes.find((b) => b.id === tune.boxId)?.color : undefined;
  const pending = i.status === "pending";
  return (
    <div className={`srow ${i.status}`} style={{ "--c": color || "" } as React.CSSProperties}>
      <div className="when"><b className="num">{fmtT(i.runAt)}</b><small>{pending ? untilText(i.runAt, now) : i.ranAt ? `ran ${fmtT(i.ranAt)}` : ""}</small></div>
      <div className="what"><b>{i.label}</b><small>{describeActions(m, gi, cat, i).join(" · then ")}{i.program ? ` · ${fmtT(i.program.start)}–${fmtT(i.program.end)}` : ""}</small>
        {i.error && <small className="err">{i.error}</small>}</div>
      <span className={`chip ${cls}`}>{txt}</span>
      {pending && onRunNow && onCancel && <div className="acts"><button className="btn outline sm" onClick={() => void onRunNow(i.id)}>Run now</button><button className="btn ghost sm" onClick={() => void onCancel(i.id)}>Cancel</button></div>}
    </div>
  );
}
