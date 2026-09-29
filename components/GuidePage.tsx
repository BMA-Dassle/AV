"use client";
import { useState } from "react";
import { chan, fmtT, label, suggestBox, tvById, tvsOn, type GuideIndex, type Model } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";
import type { GuideChannel, Program } from "@/lib/server/guide";

const GF: [string, string][] = [["sports", "Sports"], ["package", "Sunday Ticket"], ["local", "Locals"], ["news", "News"], ["all", "All"]];
const SLOTS = 6;

type Props = { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; gridStart: number; onProgram: (c: GuideChannel, p: Program) => void };

export function GuideGrid({ m, gi, cat, sel, gridStart, onProgram }: Props) {
  const [filter, setFilter] = useState("sports");
  const gridEnd = gridStart + SLOTS * 30 * 60000; const now = Date.now();
  let rows = gi.guide?.channels || [];
  if (filter === "sports") rows = rows.filter((c) => c.cat === "sports" || (c.cat === "local" && c.programs.some((p) => p.sport)));
  else if (filter !== "all") rows = rows.filter((c) => c.cat === filter);
  rows = rows.filter((c) => c.programs.length).sort((a, b) => a.num - b.num);
  const pct = (now - gridStart) / (SLOTS * 30 * 60000);
  return (
    <>
      <div className="gtools">
        <div className="chips">{GF.map(([k, l]) => <button key={k} className="tog" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
        <div className="legend" style={{ marginLeft: "auto" }}>{m.boxes.filter((b) => tvsOn(m, b.id).length).map((b) => <span key={b.id} style={{ "--c": b.color } as React.CSSProperties}><i />{b.name}</span>)}</div>
      </div>
      <div className="small" style={{ marginBottom: 8 }}>{sel.size ? `${sel.size} screen${sel.size > 1 ? "s" : ""} selected on the TVs page: ${label(m, [...sel])}` : "No screens selected. Pick a program, then choose where it goes."}</div>
      <div className="guide card">
        <div className="gg" style={{ "--slots": SLOTS } as React.CSSProperties}>
          <div className="th first">Channel</div>
          {Array.from({ length: SLOTS }, (_, i) => <div key={i} className="th">{fmtT(gridStart + i * 30 * 60000)}</div>)}
          {rows.map((c) => {
            const on = m.boxes.filter((b) => b.channel === c.num);
            return [
              <div key={`c${c.num}`} className="chn" style={{ "--c": on[0]?.color || "" } as React.CSSProperties}>
                <span className="cs">{c.callsign}<small className="num">{c.num}</small></span><span className="small">{c.name}</span>
                {on.length > 0 && <span className="on">{on.map((b) => <span key={b.id} className="chip c" style={{ "--c": b.color } as React.CSSProperties}>{b.name} · {tvsOn(m, b.id).length}</span>)}</span>}
              </div>,
              ...c.programs.filter((p) => p.end > gridStart && p.start < gridEnd).map((p) => {
                const s = Math.max(gridStart, p.start), e = Math.min(gridEnd, p.end);
                const c0 = Math.floor((s - gridStart) / 1800000) + 2, c1 = Math.ceil((e - gridStart) / 1800000) + 2; if (c1 <= c0) return null;
                const live = p.start <= now && p.end > now; const past = p.end <= now;
                return (
                  <div key={`${c.num}-${p.start}`} className="cell" style={{ gridColumn: `${c0}/${c1}` }}>
                    <button className={`prog ${p.sport ? "sport" : ""} ${live ? "live" : ""} ${past ? "past" : ""} ${on.length && live ? "onbox" : ""}`} style={{ "--c": on[0]?.color || "" } as React.CSSProperties} disabled={past} onClick={() => onProgram(c, p)}>
                      <span className="t">{p.title}</span>
                      <span className="s">{p.subtitle || ""}{p.subtitle ? " · " : ""}{fmtT(p.start)}–{fmtT(p.end)}{live ? " · LIVE" : ""}{p.league ? ` · ${p.league}` : ""}</span>
                    </button>
                  </div>
                );
              }),
            ];
          })}
          <div className="nowline" style={{ left: `calc(160px + (100% - 160px) * ${pct})` }} />
        </div>
      </div>
      <div className="foot">
        <span>{gi.guide?.provider === "tvmedia" ? `Guide: TV Media lineup ${gi.guide.lineupId} · ${rows.length} channels` : "Guide: mock data"}</span>
        <span>Channels already on a box are tagged with the box colour</span>
      </div>
    </>
  );
}

export function ProgramDialog({ m, gi, cat, sel, c, p, onClose, onTuneBox, onSend, onPick }: { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; c: GuideChannel; p: Program; onClose: () => void; onTuneBox: (boxId: string, num: number) => Promise<void>; onSend: (ids: string[], boxId: string) => Promise<void>; onPick: (boxName: string, title: string) => void }) {
  const ci = chan(gi, cat, c.num); const on = m.boxes.filter((b) => b.channel === c.num); const sug = suggestBox(m, c.num);
  const selected = [...sel]; const live = p.start <= Date.now() && p.end > Date.now();
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true">
        <div className="hd"><h2>{p.title}</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="now"><div className="big">{ci.cs}<small className="num">{ci.num}</small></div><div className="t">{p.subtitle || ci.name}{p.league ? ` · ${p.league}` : ""}</div><div className="m">{fmtT(p.start)} – {fmtT(p.end)}{live ? " · live now" : " · starts later"}</div></div>
        {on.length ? (
          <div className="alert ok"><span className="ico">✓</span><div><b>Already on {on.map((b) => b.name).join(" and ")}</b> ({on.map((b) => `${tvsOn(m, b.id).length} screens`).join(", ")}). Sending screens there changes nothing else.</div></div>
        ) : (
          <div className="alert warn"><span className="ico">⚠</span><div><b>Not on any box yet.</b> Suggested: tune <b>{sug.box.name}</b> ({sug.reason}).{tvsOn(m, sug.box.id).length ? ` That moves its ${tvsOn(m, sug.box.id).length} screens too.` : ""}</div></div>
        )}
        {selected.length > 0 && <div><div className="eyebrow">Selected screens</div><div className="feeds">{selected.map((id) => <span key={id} className="pill">{tvById(m, id)?.name}</span>)}</div></div>}
        <div className="actions">
          {!live && <button className="btn outline" disabled title="Reminders: future feature">Remind me at {fmtT(p.start)}</button>}
          {!on.length && <button className="btn outline" onClick={async () => { onClose(); await onTuneBox(sug.box.id, c.num); }}>Just tune {sug.box.name}</button>}
          {selected.length ? (
            <button className="btn primary" onClick={async () => { onClose(); let box = on[0]; if (!box) { await onTuneBox(sug.box.id, c.num); box = sug.box; } await onSend(selected, box.id); }}>Put on {selected.length} selected screen{selected.length > 1 ? "s" : ""}</button>
          ) : (
            <button className="btn primary" onClick={async () => { onClose(); onPick(on[0]?.name || sug.box.name, p.subtitle || p.title); if (!on.length) await onTuneBox(sug.box.id, c.num); }}>Choose screens…</button>
          )}
        </div>
      </div>
    </div>
  );
}
