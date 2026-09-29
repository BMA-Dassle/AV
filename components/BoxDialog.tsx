"use client";
import { useState } from "react";
import { boxNow, chan, fmtT, progAt, tvsOn, type Box, type GuideIndex, type Model } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";
import type { Channel } from "@/lib/server/channels";
import Preview from "./Preview";
import { RecoveryPanel, type RecoverFn } from "./Recovery";

const CATS: [string, string][] = [["fav", "Favorites"], ["sports", "Sports"], ["local", "Locals"], ["package", "Sunday Ticket"], ["all", "All"]];
const PAD = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function BoxDialog({ m, gi, cat, box, live, onTune, onKey, onClose, onRecover }: { m: Model; gi: GuideIndex; cat: Catalog; box: Box; live: boolean; onTune: (num: number) => void; onKey: (key: string) => void; onClose: () => void; onRecover: RecoverFn }) {
  const [tab, setTab] = useState("fav");
  const [entry, setEntry] = useState("");
  const feeds = tvsOn(m, box.id); const c = chan(gi, cat, box.channel); const p = boxNow(gi, box);
  const prog = p && p.start && p.end ? Math.min(100, Math.max(0, Math.round((Date.now() - p.start) / (p.end - p.start) * 100))) : 0;
  const all: Channel[] = cat.all.length ? cat.all : (gi.guide?.channels || []).map((g) => ({ num: g.num, callsign: g.callsign, name: g.name, cat: g.cat as Channel["cat"] }));
  const list = tab === "fav" ? (cat.favorites.length ? cat.favorites : all.filter((x) => x.cat === "sports" || x.cat === "local")) : tab === "all" ? all : all.filter((x) => x.cat === tab);
  const key = (k: string) => { if (k === "bs") setEntry((e) => e.slice(0, -1)); else if (k === "go") { if (entry) onTune(Number(entry)); } else if (entry.length < 4) setEntry((e) => e + k); };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg box" role="dialog" aria-modal="true">
        <div className="hd">
          <h2><span className="swatch" style={{ "--c": box.color } as React.CSSProperties} />{box.name}
            <span className={`chip ${feeds.length ? "c" : "free"}`} style={{ "--c": box.color } as React.CSSProperties}>{feeds.length ? `${feeds.length} screens` : "Free"}</span>
            {box.online === false && <span className="chip red">Offline</span>}
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="boxcols">
          <div className="left">
            <div className="preview" style={{ "--c": box.color, "--p": `${prog}%` } as React.CSSProperties} aria-label={`Preview of ${box.name}`}>
              <div className="scene" />
              <Preview url={box.preview} name={box.name} />
              <div className="cs">{box.channel ? c.cs : "—"}<small className="num">{box.channel || ""}</small></div>
              <div className="tt">{p ? <>{p.title}{p.sub ? ` · ${p.sub}` : ""}</> : c.name}</div>
              <div className="clock num">{fmtT(Date.now())}</div>
              <div className="bar"><i /></div>
            </div>
            <div className="now slim">
              <div className="big">{box.channel ? c.cs : "—"}<small className="num">{box.channel || ""}</small></div>
              <div className="t">{p ? p.sub || p.title : c.name}</div>
              <div className="m">{p && p.start && p.end ? `${fmtT(p.start)} – ${fmtT(p.end)}` : ""}{box.pending ? " · tuning…" : ""}</div>
            </div>
            {box.online === false && <RecoveryPanel m={m} box={box} onRecover={onRecover} />}
            {feeds.length ? (
              <div className="alert warn"><span className="ico">⚠</span><div><b>Feeds {feeds.length} screen{feeds.length > 1 ? "s" : ""}.</b> Changing the channel changes all of them.
                <div className="feeds">{feeds.map((t) => <span key={t.id} className="pill">{t.name}</span>)}</div></div></div>
            ) : (
              <div className="alert ok"><span className="ico">✓</span><div><b>No screens are watching this box.</b> Safe to change.</div></div>
            )}
          </div>
          <div>
            <div className="chips" style={{ marginBottom: 8 }}>{CATS.map(([k, l]) => <button key={k} className="tog" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
            <div className="favgrid compact">
              {list.map((ch) => { const on = m.boxes.find((x) => x.channel === ch.num && x.id !== box.id); const np = progAt(gi, ch.num);
                return (
                  <button key={ch.num} className={`fav ${ch.num === box.channel ? "cur" : ""}`} style={{ "--c": on?.color || "" } as React.CSSProperties} onClick={() => onTune(ch.num)} title={np ? `${np.title}${np.subtitle ? " · " + np.subtitle : ""}` : ""}>
                    <span className="cs">{ch.callsign}</span><span className="n num">{ch.num} · {np ? np.subtitle || np.title : ch.name}</span>{on && <span className="onbox">on {on.name}</span>}
                  </button>
                ); })}
            </div>
          </div>
          <div>
            <div className="eyebrow">Channel number</div>
            <div className="entry"><div className="disp num">{entry || <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted-foreground)", letterSpacing: 0 }}>Channel number</span>}</div></div>
            <div className="pad compact">
              {PAD.map((n) => <button key={n} onClick={() => key(String(n))}>{n}</button>)}
              <button onClick={() => key("bs")} aria-label="Backspace">⌫</button><button onClick={() => key("0")}>0</button><button className="go" onClick={() => key("go")}>Go</button>
            </div>
            <div className="actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
              <button className="btn outline sm" onClick={() => onKey("chandown")}>Ch −</button>
              <button className="btn outline sm" onClick={() => onKey("chanup")}>Ch +</button>
              <button className="btn outline sm" onClick={() => onKey("prev")}>Last</button>
            </div>
            <p className="small" style={{ margin: "10px 0 0" }}>{live ? "Sends the change to the DirecTV box." : "Simulated box."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
