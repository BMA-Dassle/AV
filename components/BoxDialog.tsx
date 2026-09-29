"use client";
import { useMemo, useState } from "react";
import { boxNow, chan, fmtT, groupNames, schedForBox, tuneOf, tvsOn, untilText, type Box, type GuideIndex, type Model } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";
import type { Channel } from "@/lib/server/channels";
import Preview from "./Preview";
import SportsList from "./SportsList";
import ChannelList, { type Row } from "./ChannelList";
import { eventMatches, isSundayTicket, matches, sportEvents } from "@/lib/client/sports";
import { RecoveryPanel, type RecoverFn } from "./Recovery";

const CATS: [string, string][] = [["live", "Live sports"], ["fav", "Favorites"], ["sports", "Sports"], ["local", "Locals"], ["st", "Sunday Ticket"], ["all", "All"]];
const PAD = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function BoxDialog({ m, gi, cat, box, live, onTune, onKey, onClose, onRecover, onFav, onCancelSchedule }: { m: Model; gi: GuideIndex; cat: Catalog; box: Box; live: boolean; onTune: (num: number) => void; onKey: (key: string) => void; onClose: () => void; onRecover: RecoverFn; onFav: (num: number, on: boolean) => void; onCancelSchedule: (id: string) => Promise<void> }) {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("hp-boxtab") || "live"; } catch { return "live"; } });
  const pickTab = (k: string) => { setTab(k); try { localStorage.setItem("hp-boxtab", k); } catch { /* private mode */ } };
  const [q, setQ] = useState("");
  const [entry, setEntry] = useState("");
  const [pvLive, setPvLive] = useState(false);
  const feeds = tvsOn(m, box.id); const c = chan(gi, cat, box.channel); const p = boxNow(gi, box);
  const prog = p && p.start && p.end ? Math.min(100, Math.max(0, Math.round((Date.now() - p.start) / (p.end - p.start) * 100))) : 0;
  const favNums = cat.favoriteNums || cat.favorites.map((c) => c.num);
  const favs = useMemo(() => new Set(favNums), [favNums]);
  const rowFor = (num: number, fb?: Channel): Row => { const g = gi.byNum.get(num); return { num, callsign: g?.callsign || fb?.callsign || "", name: g?.name || fb?.name || "", ch: g || null }; };
  const guideCh = gi.guide?.channels || [];
  const events = useMemo(() => sportEvents(m, gi), [m, gi]);
  const rows: Row[] = tab === "fav" ? favNums.map((n) => rowFor(n, cat.favorites.find((c) => c.num === n)))
    : tab === "sports" ? (guideCh.length ? guideCh.filter((c) => c.cat === "sports").map((c) => rowFor(c.num)) : cat.all.filter((c) => c.cat === "sports").map((c) => rowFor(c.num, c)))
    : tab === "local" ? (guideCh.length ? guideCh.filter((c) => c.cat === "local").map((c) => rowFor(c.num)) : cat.all.filter((c) => c.cat === "local").map((c) => rowFor(c.num, c)))
    : tab === "st" ? guideCh.filter(isSundayTicket).map((c) => rowFor(c.num))
    : tab === "all" ? (guideCh.length ? guideCh.map((c) => rowFor(c.num)) : cat.all.map((c) => rowFor(c.num, c))) : [];
  const now = Date.now();
  const shown = q ? rows.filter((r) => matches(q, r.callsign, r.name, String(r.num), (r.ch?.programs || []).filter((p) => p.end > now).slice(0, 3).map((p) => [p.title, p.subtitle, ...(p.teams || [])]).flat())) : rows;
  // game channels (NFLST1-14) all on filler = no games now; the Mix channels always carry a placeholder listing
  const stGames = rows.filter((r) => /^NFLST\d+/i.test(r.callsign));
  const stQuiet = tab === "st" && stGames.length > 0 && stGames.every((r) => { const p = r.ch?.programs.find((x) => x.start <= now && x.end > now); return !p || p.filler; });
  const key = (k: string) => { if (k === "bs") setEntry((e) => e.slice(0, -1)); else if (k === "go") { if (entry) { onTune(Number(entry)); setEntry(""); } } else if (entry.length < 4) setEntry((e) => e + k); };

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
              <Preview url={box.preview} name={box.name} onLive={setPvLive} />
              {!pvLive && <>
                <div className="cs">{box.channel ? c.cs : "—"}<small className="num">{box.channel || ""}</small></div>
                <div className="tt">{p ? <>{p.title}{p.sub ? ` · ${p.sub}` : ""}</> : c.name}</div>
                <div className="clock num">{fmtT(Date.now())}</div>
                <div className="bar"><i /></div>
              </>}
            </div>
            <div className="now slim">
              <div className="big">{box.channel ? c.cs : "—"}<small className="num">{box.channel || ""}</small></div>
              <div className="t">{p ? p.sub || p.title : c.name}</div>
              <div className="m">{p && p.start && p.end ? `${fmtT(p.start)} – ${fmtT(p.end)}` : ""}{box.pending ? " · tuning…" : ""}</div>
            </div>
            {schedForBox(m, box.id).length > 0 && (
              <div className="alert info"><span className="ico">⏱</span><div><b>Scheduled for this box</b>
                {schedForBox(m, box.id).slice(0, 4).map((i) => { const t = tuneOf(i); return (
                  <div key={i.id} className="schedline"><span><b className="num">{fmtT(i.runAt)}</b> → {chan(gi, cat, t?.channel ?? null).cs} {t?.channel} · {i.label} <small>({untilText(i.runAt)})</small></span>
                    <button className="btn ghost sm" onClick={() => void onCancelSchedule(i.id)} aria-label={`Cancel ${i.label}`}>Cancel</button></div>); })}
              </div></div>
            )}
            {box.online === false && <RecoveryPanel m={m} box={box} onRecover={onRecover} />}
            {feeds.length ? (
              <div className="alert warn"><span className="ico">⚠</span><div><b>Feeds {feeds.length} screen{feeds.length > 1 ? "s" : ""}.</b> Changing the channel changes all of them.
                <div className="feeds">{groupNames(m, feeds.map((t) => t.id)).map((n) => <span key={n} className="pill">{n}</span>)}</div></div></div>
            ) : (
              <div className="alert ok"><span className="ico">✓</span><div><b>No screens are watching this box.</b> Safe to change.</div></div>
            )}
          </div>
          <div>
            <div className="chtools">
              <div className="chips">{CATS.map(([k, l]) => <button key={k} className="tog" aria-pressed={tab === k} onClick={() => pickTab(k)}>{l}</button>)}</div>
              <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "live" ? "Search teams or leagues" : "Search channels or shows"} aria-label="Search" />
            </div>
            <div className="chscroll">
              {tab === "live" ? (
                <SportsList m={m} compact currentNum={box.channel} events={q ? events.filter((e) => eventMatches(q, e)) : events} onPick={(e) => onTune(e.c.num)}
                  empty={q ? "No games match that search." : "No games in the guide right now. Try Sports or All."} />
              ) : (
                <>
                  {stQuiet && !q && <div className="alert warn" style={{ marginBottom: 8 }}><span className="ico">ⓘ</span><div><b>No Sunday Ticket games on right now.</b> Games are listed on these channels on Sundays.</div></div>}
                  <ChannelList m={m} gi={gi} rows={shown} favs={favs} onFav={onFav} onTune={onTune} currentNum={box.channel} boxId={box.id}
                    empty={tab === "fav" && !q ? "No favorites yet. Tap the star on any channel to add it." : tab === "st" && !guideCh.length ? "Waiting for the guide…" : "No channels match."} />
                </>
              )}
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
