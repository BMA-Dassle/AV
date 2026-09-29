"use client";
import { useMemo, useState } from "react";
import { boxNow, chan, describeActions, fmtT, label, schedForBox, schedForProgram, suggestBox, tuneOf, tvsOn, untilText, type GuideIndex, type Model, type Scheduled } from "@/lib/client/model";
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
                    const live = p.start <= now && p.end > now; const past = p.end <= now; const sch = schedForProgram(m, [c.num], p.start);
                    return (
                      <button key={p.start} className={`prog ${p.sport ? "sport" : ""} ${live ? "live" : ""} ${past ? "past" : ""} ${on.length && live ? "onbox" : ""} ${p.start < gridStart ? "cut" : ""} ${sch ? "sched" : ""}`}
                        style={{ left: `${left}%`, width: `${width}%`, "--c": on[0]?.color || "" } as React.CSSProperties} disabled={past} onClick={() => onProgram(c, p)}
                        title={`${p.title}${p.subtitle ? " · " + p.subtitle : ""} · ${fmtT(p.start)}–${fmtT(p.end)}`}>
                        <span className="t">{sch ? "⏱ " : ""}{p.filler ? "Nothing scheduled" : isEvent(p) ? matchupOf(p) : p.title}</span>
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

// Program dialog: pick any box, then change it now or automatically when the program starts (a scheduled change).
export type ScheduleReq = { runAt: number; actions: Scheduled["actions"]; label: string; program: Scheduled["program"] };
export function ProgramDialog({ m, gi, cat, sel, c, p, onClose, onTuneBox, onSend, onPick, onSchedule, onCancelSchedule }: { m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; c: GuideChannel; p: Program; onClose: () => void; onTuneBox: (boxId: string, num: number) => Promise<void>; onSend: (ids: string[], boxId: string) => Promise<void>; onPick: (boxName: string, title: string) => void; onSchedule: (r: ScheduleReq) => Promise<boolean>; onCancelSchedule: (id: string) => Promise<void> }) {
  const now = Date.now();
  const ci = chan(gi, cat, c.num); const on = m.boxes.filter((b) => b.channel === c.num); const sug = suggestBox(m, c.num);
  const selected = [...sel]; const live = p.start <= now && p.end > now; const future = p.start > now;
  const title = p.filler ? "Nothing scheduled" : isEvent(p) ? matchupOf(p) : p.title;
  const [boxId, setBoxId] = useState<string>(on[0]?.id ?? sug.box.id);
  const [when, setWhen] = useState<"auto" | "now">(future ? "auto" : "now");
  const [withScreens, setWithScreens] = useState(selected.length > 0);
  const [busy, setBusy] = useState(false);
  const box = m.boxes.find((b) => b.id === boxId) || sug.box;
  const already = schedForProgram(m, [c.num], p.start);
  const boxOnIt = box.channel === c.num;
  const moves = tvsOn(m, box.id).length;
  // other scheduled changes for this box that would fight with this one (between now and the end of the program)
  const clashes = schedForBox(m, box.id).filter((i) => i.id !== already?.id && i.runAt < p.end && (i.program?.end ?? i.runAt) > (when === "auto" ? p.start : now));
  const actions: Scheduled["actions"] = [{ type: "tune", boxId: box.id, channel: c.num }, ...(withScreens && selected.length ? [{ type: "source" as const, tvIds: selected, sourceId: box.id }] : [])];
  const program = { num: c.num, callsign: c.callsign, title: p.title, subtitle: p.subtitle, start: p.start, end: p.end };
  const go = async () => {
    setBusy(true);
    try {
      if (when === "auto") { if (await onSchedule({ runAt: p.start, actions, label: title, program })) onClose(); return; }
      onClose();
      if (!boxOnIt) await onTuneBox(box.id, c.num);
      if (withScreens && selected.length) await onSend(selected, box.id);
    } finally { setBusy(false); }
  };
  const dupe = when === "auto" && already && already.actions.some((a) => a.type === "tune" && a.boxId === box.id);
  const primary = dupe ? `${box.name} is already scheduled` : when === "auto"
    ? `Change ${box.name} at ${fmtT(p.start)}${withScreens && selected.length ? ` + ${selected.length} screen${selected.length > 1 ? "s" : ""}` : ""}`
    : boxOnIt ? (withScreens && selected.length ? `Put on ${selected.length} screen${selected.length > 1 ? "s" : ""}` : `${box.name} is already on it`)
    : `Tune ${box.name} now${withScreens && selected.length ? ` + ${selected.length} screen${selected.length > 1 ? "s" : ""}` : ""}`;
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg pdlg" role="dialog" aria-modal="true" aria-label={title}>
        <div className="hd"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="now"><div className="big">{ci.cs}<small className="num">{ci.num}</small></div><div className="t">{isEvent(p) ? p.title : p.subtitle || ci.name}{p.liveBroadcast && isEvent(p) ? " · live broadcast" : ""}</div>
          <div className="m">{fmtT(p.start)} – {fmtT(p.end)}{live ? " · on now" : future ? ` · starts ${untilText(p.start, now)}` : ""}</div></div>
        {already && (
          <div className="alert info"><span className="ico">⏱</span><div><b>Scheduled:</b> {describeActions(m, gi, cat, already).join(", then ")} at {fmtT(already.runAt)}.
            <button className="btn outline sm" style={{ marginLeft: 8 }} onClick={() => void onCancelSchedule(already.id)}>Cancel it</button></div></div>
        )}
        {future && (
          <div className="seg" role="radiogroup" aria-label="When">
            <button role="radio" aria-checked={when === "auto"} onClick={() => setWhen("auto")}><b>Change automatically</b><small>at {fmtT(p.start)}, when it starts</small></button>
            <button role="radio" aria-checked={when === "now"} onClick={() => setWhen("now")}><b>Change now</b><small>tune the box right away</small></button>
          </div>
        )}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Which box</div>
          <div className="boxpick" role="radiogroup" aria-label="Box">
            {m.boxes.map((b) => {
              const bc = chan(gi, cat, b.channel); const bn = boxNow(gi, b); const n = tvsOn(m, b.id).length; const next = schedForBox(m, b.id)[0];
              return (
                <button key={b.id} role="radio" aria-checked={b.id === box.id} className={`bpick ${b.id === box.id ? "on" : ""}`} style={{ "--c": b.color } as React.CSSProperties} onClick={() => setBoxId(b.id)} disabled={b.online === false}>
                  <span className="r1"><span className="nm">{b.name}</span>
                    {b.channel === c.num ? <span className="chip free">On it</span> : b.online === false ? <span className="chip red">Offline</span> : b.id === sug.box.id ? <span className="chip">Suggested</span> : null}
                    <span className="sc">{n ? `${n} screen${n > 1 ? "s" : ""}` : "free"}</span></span>
                  <span className="r2">{b.channel ? `${bc.cs} ${b.channel}` : "—"}{bn ? ` · ${bn.sub || bn.title}` : ""}</span>
                  {next && <span className="r3">⏱ {fmtT(next.runAt)} → {chan(gi, cat, tuneOf(next)?.channel ?? null).cs}</span>}
                </button>
              );
            })}
          </div>
        </div>
        {moves > 0 && !boxOnIt && <div className="alert warn"><span className="ico">⚠</span><div><b>{box.name} feeds {moves} screen{moves > 1 ? "s" : ""}</b> ({label(m, tvsOn(m, box.id).map((t) => t.id))}). {when === "auto" ? `At ${fmtT(p.start)} they` : "They"} switch to this too.</div></div>}
        {clashes.length > 0 && <div className="alert warn"><span className="ico">⏱</span><div><b>{box.name} already has a scheduled change:</b> {clashes.map((i) => `${fmtT(i.runAt)} ${i.label}`).join(", ")}. Both will run in time order.</div></div>}
        {selected.length > 0 && (
          <label className="check"><input type="checkbox" checked={withScreens} onChange={(e) => setWithScreens(e.target.checked)} />
            <span>Also put it on the {selected.length} selected screen{selected.length > 1 ? "s" : ""}<small>{label(m, selected)}</small></span></label>
        )}
        <div className="actions">
          {when === "now" && !selected.length && <button className="btn outline" onClick={async () => { onClose(); onPick(box.name, title); if (!boxOnIt) await onTuneBox(box.id, c.num); }}>Tune &amp; choose screens…</button>}
          <button className="btn primary" disabled={busy || Boolean(dupe) || (when === "now" && boxOnIt && !(withScreens && selected.length))} onClick={() => void go()}>{primary}</button>
        </div>
      </div>
    </div>
  );
}
