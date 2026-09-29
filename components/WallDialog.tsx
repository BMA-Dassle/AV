"use client";
// Switching a video wall to one picture: pick what goes across all of its screens.
import { useState } from "react";
import { boxNow, chan, tvById, type GuideIndex, type Model, type Wall } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";

export default function WallDialog({ m, gi, cat, wall, onClose, onConfirm }: { m: Model; gi: GuideIndex; cat: Catalog; wall: Wall; onClose: () => void; onConfirm: (sourceId: string | null) => void }) {
  // Pre-pick what most of the wall's screens show now.
  const counts: Record<string, number> = {};
  for (const id of wall.rows.flat()) { const s = tvById(m, id)?.src; if (s) counts[s] = (counts[s] || 0) + 1; }
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? m.boxes[0]?.id ?? null;
  const [pick, setPick] = useState<string | null>(common);
  const n = wall.rows.flat().length;
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true">
        <div className="hd"><h2>{wall.name}: one picture</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <p className="small" style={{ margin: 0 }}>Shows one source stretched across all {n} screens. Takes about 7 seconds; the wall keeps its current picture until then.</p>
        <div className="eyebrow">Show across the wall</div>
        <div className="srcs" style={{ marginTop: 0 }}>
          {m.boxes.map((b) => { const c = chan(gi, cat, b.channel); const p = boxNow(gi, b);
            return (
              <button key={b.id} className={`srcbtn ${pick === b.id ? "picked" : ""}`} style={{ "--c": b.color } as React.CSSProperties} onClick={() => setPick(b.id)} aria-pressed={pick === b.id}>
                <span className="a">{b.channel ? c.cs : b.name}<small>{b.name}</small></span><span className="b">{p ? p.sub || p.title : c.name}</span>
              </button>
            ); })}
          {m.other.map((o) => <button key={o.id} className={`srcbtn ${pick === o.id ? "picked" : ""}`} onClick={() => setPick(o.id)} aria-pressed={pick === o.id}><span className="a">{o.name}</span><span className="b">{o.kind}</span></button>)}
        </div>
        <div className="actions">
          <button className="btn outline" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!pick} onClick={() => onConfirm(pick)}>Show on the whole wall</button>
        </div>
      </div>
    </div>
  );
}
