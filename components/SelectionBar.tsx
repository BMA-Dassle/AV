"use client";
import { boxNow, chan, label, tvById, tvsOn, type Model, type GuideIndex } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";

export default function SelectionBar({ m, gi, cat, sel, onClear, onPick }: { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; onClear: () => void; onPick: (src: string | null) => void }) {
  const ids = [...sel];
  const open = ids.length > 0;
  const cur = new Set(ids.map((id) => tvById(m, id)?.src));
  return (
    <div className={`bar ${open ? "open" : ""}`} aria-live="polite">
      {open && (
        <>
          <div className="row">
            <div className="who">{ids.length} screen{ids.length > 1 ? "s" : ""} selected<small>{label(m, ids)}</small></div>
            <button className="btn outline sm clear" onClick={onClear}>Clear</button>
          </div>
          <div className="eyebrow" style={{ marginTop: 8 }}>Show on them</div>
          <div className="srcs">
            {m.boxes.map((b) => { const c = chan(gi, cat, b.channel), p = boxNow(gi, b), n = tvsOn(m, b.id).length; const isCur = cur.size === 1 && cur.has(b.id);
              return (
                <button key={b.id} className={`srcbtn ${isCur ? "cur" : ""}`} style={{ "--c": b.color } as React.CSSProperties} onClick={() => onPick(b.id)} aria-label={`Show ${b.name} on selected screens`}>
                  <span className="a">{b.channel ? c.cs : b.name}<small>{b.name}{n ? ` · ${n}` : ""}</small></span>
                  <span className="b">{p ? p.sub || p.title : c.name}</span>
                </button>
              ); })}
            {m.other.map((o) => <button key={o.id} className="srcbtn" onClick={() => onPick(o.id)}><span className="a">{o.name}</span><span className="b">{o.kind}</span></button>)}
            <button className="srcbtn off" onClick={() => onPick(null)}><span className="a">Off</span><span className="b">Blank the screen</span></button>
          </div>
        </>
      )}
    </div>
  );
}
