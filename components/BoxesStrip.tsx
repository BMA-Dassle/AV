"use client";
import { boxNow, chan, fmtT, schedForBox, tuneOf, tvsOn, type Model, type GuideIndex } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";

export default function BoxesStrip({ m, gi, cat, armed, hl, onBox }: { m: Model; gi: GuideIndex; cat: Catalog; armed: boolean; hl: string | null; onBox: (id: string) => void }) {
  return (
    <div className="boxes">
      {m.boxes.map((b) => {
        const n = tvsOn(m, b.id).length, c = chan(gi, cat, b.channel), p = boxNow(gi, b); const next = schedForBox(m, b.id)[0];
        const status = b.online === false ? <span className="chip red">Offline</span> : n === 0 ? <span className="chip free">Free</span> : <span className="chip c">{n} screen{n > 1 ? "s" : ""}</span>;
        return (
          <button key={b.id} className={`box card ${armed ? "armed" : ""} ${hl === b.id ? "hl" : ""} ${n === 0 ? "free" : ""}`} style={{ "--c": b.color } as React.CSSProperties} onClick={() => onBox(b.id)}
            aria-label={`${b.name}, channel ${c.num} ${c.name}, on ${n} screens`}>
            <div className="top"><span className="name">{b.name}</span>{status}</div>
            <div className="ch">{b.channel ? <>{c.cs}<small className="num">{c.num}</small></> : <span style={{ color: "var(--muted-foreground)" }}>—</span>}</div>
            <div className="title">
              {b.pending ? <span style={{ color: "var(--primary)" }}>Tuning…</span>
                : p ? <>{p.title}{p.sub ? ` · ${p.sub}` : ""}</>
                : b.error ? <span style={{ color: "var(--red-400)" }}>{b.error}</span>
                : <span style={{ color: "var(--muted-foreground)" }}>No guide data</span>}
            </div>
            {next && <div className="next" title={next.label}>⏱ {fmtT(next.runAt)} → {chan(gi, cat, tuneOf(next)?.channel ?? null).cs} · {next.label}</div>}
          </button>
        );
      })}
    </div>
  );
}
