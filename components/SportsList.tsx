"use client";
// Live sports: games and events grouped by Live now / Starting soon / Later / Replays. Used on the guide page
// (tap = choose where it goes) and in the box dialog (tap = tune this box).
import { useState } from "react";
import { boxById, fmtT, schedForProgram, shortCallsign, tuneOf, type Model } from "@/lib/client/model";
import { minsLeft, screensOn, startsIn, type SportEvent } from "@/lib/client/sports";

// Live broadcasts first; replays and re-airs are folded away at the bottom (they are most of the guide at night).
const GROUPS: [SportEvent["state"][], string][] = [[["live"], "Live now"], [["soon"], "Starting soon"], [["later"], "Later today"], [["replay", "rerun"], "Replays & re-airs"]];

export default function SportsList({ m, events, onPick, currentNum, compact, empty }: { m: Model; events: SportEvent[]; onPick: (e: SportEvent) => void; currentNum?: number | null; compact?: boolean; empty?: React.ReactNode }) {
  const now = Date.now();
  const [showRe, setShowRe] = useState(false);
  if (!events.length) return <div className="sempty">{empty || "No games in the guide right now."}</div>;
  return (
    <div className={`sports ${compact ? "compact" : ""}`}>
      {GROUPS.map(([states, title]) => {
        const list = events.filter((e) => states.includes(e.state)); if (!list.length) return null;
        const folded = states.includes("replay") && !showRe;
        const liveCount = events.filter((e) => e.state === "live" || e.state === "soon" || e.state === "later").length;
        return (
          <section key={title} className="sgroup">
            <div className="eyebrow">{title} <span className="n">{list.length}</span>
              {states.includes("replay") && <button className="btn ghost sm" style={{ marginLeft: 8, height: 24 }} onClick={() => setShowRe(!showRe)}>{showRe ? "Hide" : "Show"}</button>}</div>
            {folded ? (liveCount ? null : <div className="sempty">No live games in the guide right now. {list.length} replay{list.length > 1 ? "s" : ""} and re-air{list.length > 1 ? "s" : ""} are hidden. Tap Show to see them.</div>) : (
            <div className="sgrid">
              {list.map((e) => { const state = e.state;
                const box = boxById(m, e.onBoxes[0]); const scr = screensOn(m, e.onBoxes);
                const pct = e.p.start <= now ? Math.min(100, Math.max(0, ((now - e.p.start) / (e.p.end - e.p.start)) * 100)) : 0;
                const cur = currentNum != null && e.channels.some((c) => c.num === currentNum);
                const sch = schedForProgram(m, e.channels.map((c) => c.num), e.p.start); const schBox = sch ? boxById(m, tuneOf(sch)?.boxId) : null;
                return (
                  <button key={e.key} className={`scard ${state} ${box ? "onbox" : ""} ${cur ? "cur" : ""}`} style={{ "--c": box?.color || "" } as React.CSSProperties} onClick={() => onPick(e)}
                    aria-label={`${e.matchup}, ${e.league}, ${shortCallsign(e.c.callsign)} ${e.c.num}`}>
                    <span className="top">
                      <span className="lg">{e.league}</span>
                      {state === "live" && <span className="chip red"><i className="dot" />Live</span>}
                      {state === "replay" && <span className="chip gray">Replay · on now</span>}
                      {state === "rerun" && <span className="chip gray">Re-air · {fmtT(e.p.start)}</span>}
                      {(state === "soon" || state === "later") && <span className="chip">{fmtT(e.p.start)}{!compact && startsIn(e.p, now) ? ` · ${startsIn(e.p, now)}` : ""}</span>}
                      <span className="ch">{shortCallsign(e.c.callsign)} <b className="num">{e.c.num}</b>{e.channels.length > 1 ? <small> +{e.channels.length - 1}</small> : null}</span>
                    </span>
                    <span className="mu">{e.matchup}</span>
                    <span className="meta">{e.show !== e.matchup ? `${e.show} · ` : ""}{e.p.start <= now ? `ends ${fmtT(e.p.end)} · ${minsLeft(e.p, now)}` : `${fmtT(e.p.start)} – ${fmtT(e.p.end)}`}</span>
                    {box ? <span className="onb">{cur ? "On this box" : `On ${e.onBoxes.map((id) => boxById(m, id)?.name).join(", ")}`}{scr ? ` · ${scr} screen${scr > 1 ? "s" : ""}` : " · no screens"}</span> : cur ? <span className="onb">On this box</span> : null}
                    {sch && <span className="onb sched">⏱ {schBox?.name || "A box"} changes to it at {fmtT(sch.runAt)}</span>}
                    {e.p.start <= now && <span className="sbar"><i style={{ width: `${pct}%` }} /></span>}
                  </button>
                );
              })}
            </div>)}
          </section>
        );
      })}
    </div>
  );
}
