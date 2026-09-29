"use client";
import { useMemo, useState } from "react";
import { chan, fmtT, label, suggestBox, tvById, tvsOn, type GuideIndex, type Model } from "@/lib/client/model";
import type { Catalog } from "@/lib/client/api";
import type { GuideChannel, Program } from "@/lib/server/guide";
import SportsList from "./SportsList";
import { eventMatches, isEvent, isSundayTicket, leagueCounts, matches, matchupOf, sportEvents } from "@/lib/client/sports";

const GF: [string, string][] = [["fav", "Favorites"], ["sports", "Sports"], ["package", "Sunday Ticket"], ["local", "Locals"], ["news", "News"], ["all", "All"]];
const SLOTS = 6;                       // 30-minute columns shown
const SPAN = SLOTS * 30 * 60000;       // 3 hours

type Props = { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; gridStart: number; onProgram: (c: GuideChannel, p: Program) => void };

export function GuideGrid({ m, gi, cat, sel, gridStart, onProgram }: Props) {
  const [view, setView] = useState<"sports" | "grid">(() => { try { return localStorage.getItem("hp-gview") === "grid" ? "grid" : "sports"; } catch { return "sports"; } });
  const pickView = (v: "sports" | "grid") => { setView(v); try { localStorage.setItem("hp-gview", v); } catch { /* private mode */ } };
  const [filter, setFilter] = useState("sports");
  const [league, setLeague] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const gridEnd = gridStart + SPAN; const now = Date.now();
  const favNums = new Set(cat.favoriteNums || cat.favorites.map((c) => c.num));
  // ---- live sports ----
  const events = useMemo(() => sportEvents(m, gi), [m, gi]);
  const searched = q ? events.filter((e) => eventMatches(q, e)) : events;
  const leagues = leagueCounts(searched);
  const shownEvents = league ? searched.filter((e) => e.league === league) : searched;
  // ---- grid ----
  let rows = gi.guide?.channels || [];
  if (filter === "fav") rows = rows.filter((c) => favNums.has(c.num));
  else if (filter === "sports") rows = rows.filter((c) => c.cat === "sports" || (c.cat === "local" && c.programs.some((p) => p.sport)));
  else if (filter === "package") rows = rows.filter(isSundayTicket);
  else if (filter !== "all") rows = rows.filter((c) => c.cat === filter);
  const inWin = (c: GuideChannel) => c.programs.filter((p) => p.end > gridStart && p.start < gridEnd);
  rows = rows.filter((c) => inWin(c).some((p) => !p.filler) || (filter === "fav" || filter === "package"));
  if (q) rows = rows.filter((c) => matches(q, c.callsign, c.name, String(c.num), inWin(c).map((p) => [p.title, p.subtitle, ...(p.teams || [])]).flat()));
  rows = [...rows].sort((a, b) => a.num - b.num);
  const pct = Math.max(0, Math.min(100, ((now - gridStart) / SPAN) * 100));
  const selNote = sel.size ? `${sel.size} screen${sel.size > 1 ? "s" : ""} selected: ${label(m, [...sel])}. Tap a game to put it on them.` : "Tap a game, then choose where it goes.";
  return (
    <>
      <div className="gtools">
        <div className="tabs" role="tablist" aria-label="Guide view">
          <button role="tab" aria-selected={view === "sports"} onClick={() => pickView("sports")}>Live sports</button>
          <button role="tab" aria-selected={view === "grid"} onClick={() => pickView("grid")}>Guide grid</button>
        </div>
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === "sports" ? "Search a team, league or channel" : "Search channels or shows"} aria-label="Search the guide" />
        <div className="legend" style={{ marginLeft: "auto" }}>{m.boxes.filter((b) => tvsOn(m, b.id).length).map((b) => <span key={b.id} style={{ "--c": b.color } as React.CSSProperties}><i />{b.name}</span>)}</div>
      </div>
      {view === "sports" ? (
        <>
          <div className="chips lgchips">
            <button className="tog" aria-pressed={!league} onClick={() => setLeague(null)}>All sports <span className="n">{searched.length}</span></button>
            {leagues.map(([l, n]) => <button key={l} className="tog" aria-pressed={league === l} onClick={() => setLeague(league === l ? null : l)}>{l} <span className="n">{n}</span></button>)}
          </div>
          <div className="small" style={{ margin: "8px 0" }}>{selNote}</div>
          <SportsList m={m} events={shownEvents} onPick={(e) => onProgram(e.c, e.p)}
            empty={!gi.guide ? "Loading the guide…" : q || league ? "No games match. Clear the search or pick All sports." : "No games in the next 12 hours of the guide. Use the Guide grid to browse every channel."} />
        </>
      ) : (
        <>
          <div className="chips" style={{ marginBottom: 8 }}>{GF.map(([k, l]) => <button key={k} className="tog" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
          <div className="small" style={{ marginBottom: 8 }}>{sel.size ? `${sel.size} screen${sel.size > 1 ? "s" : ""} selected on the TVs page: ${label(m, [...sel])}` : "No screens selected. Pick a program, then choose where it goes."}</div>
      <div className="guide card">
        <div className="gin">
        <div className="gthead">
          <div className="th first">Channel</div>
          <div className="th track">{Array.from({ length: SLOTS }, (_, i) => <span key={i} style={{ left: `${(i / SLOTS) * 100}%` }}>{fmtT(gridStart + i * 30 * 60000)}</span>)}</div>
        </div>
        <div className="gbody">
          {rows.map((c) => {
            const on = m.boxes.filter((b) => b.channel === c.num);
            const ci = chan(gi, cat, c.num);
            return (
              <div key={c.num} className="grow">
                <div className="chn" style={{ "--c": on[0]?.color || "" } as React.CSSProperties}>
                  <span className="cs">{ci.cs}<small className="num">{c.num}</small></span><span className="small">{c.name}</span>
                  {on.length > 0 && <span className="on">{on.map((b) => <span key={b.id} className="chip c" style={{ "--c": b.color } as React.CSSProperties}>{b.name} · {tvsOn(m, b.id).length}</span>)}</span>}
                </div>
                <div className="track">
                  {c.programs.filter((p) => p.end > gridStart && p.start < gridEnd).map((p) => {
                    const s = Math.max(gridStart, p.start), e = Math.min(gridEnd, p.end);
                    const left = ((s - gridStart) / SPAN) * 100, width = Math.max(((e - s) / SPAN) * 100, 1.5);
                    const live = p.start <= now && p.end > now; const past = p.end <= now;
                    return (
                      <button key={p.start} className={`prog ${p.sport ? "sport" : ""} ${live ? "live" : ""} ${past ? "past" : ""} ${on.length && live ? "onbox" : ""} ${p.start < gridStart ? "cut" : ""}`}
                        style={{ left: `${left}%`, width: `${width}%`, "--c": on[0]?.color || "" } as React.CSSProperties} disabled={past} onClick={() => onProgram(c, p)}
                        title={`${p.title}${p.subtitle ? " · " + p.subtitle : ""} · ${fmtT(p.start)}–${fmtT(p.end)}`}>
                        <span className="t">{p.filler ? "Nothing scheduled" : isEvent(p) ? matchupOf(p) : p.title}</span>
                        <span className="s">{isEvent(p) ? p.title : p.subtitle || ""}{(isEvent(p) ? p.title : p.subtitle) ? " · " : ""}{fmtT(p.start)}–{fmtT(p.end)}{live ? " · LIVE" : ""}{p.league ? ` · ${p.league}` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="nowline" style={{ left: `calc(var(--chw) + (100% - var(--chw)) * ${pct / 100})` }} />
        </div>
        </div>
      </div>
      <div className="foot">
        <span>{gi.guide?.provider === "tvmedia" ? `Guide: TV Media lineup ${gi.guide.lineupId} · ${rows.length} channels` : "Guide: mock data"}</span>
        <span>Channels already on a box are tagged with the box colour</span>
      </div>
        </>
      )}
    </>
  );
}

export function ProgramDialog({ m, gi, cat, sel, c, p, onClose, onTuneBox, onSend, onPick }: { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; c: GuideChannel; p: Program; onClose: () => void; onTuneBox: (boxId: string, num: number) => Promise<void>; onSend: (ids: string[], boxId: string) => Promise<void>; onPick: (boxName: string, title: string) => void }) {
  const ci = chan(gi, cat, c.num); const on = m.boxes.filter((b) => b.channel === c.num); const sug = suggestBox(m, c.num);
  const selected = [...sel]; const live = p.start <= Date.now() && p.end > Date.now();
  const title = p.filler ? "Nothing scheduled" : isEvent(p) ? matchupOf(p) : p.title;
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true">
        <div className="hd"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="now"><div className="big">{ci.cs}<small className="num">{ci.num}</small></div><div className="t">{isEvent(p) ? p.title : p.subtitle || ci.name}{p.liveBroadcast && isEvent(p) ? " · live broadcast" : ""}</div><div className="m">{fmtT(p.start)} – {fmtT(p.end)}{live ? " · live now" : " · starts later"}</div></div>
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
            <button className="btn primary" onClick={async () => { onClose(); onPick(on[0]?.name || sug.box.name, p.subtitle || title); if (!on.length) await onTuneBox(sug.box.id, c.num); }}>Choose screens…</button>
          )}
        </div>
      </div>
    </div>
  );
}
