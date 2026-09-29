"use client";
// Guide-mode channel rows for the box dialog: star, channel, what's on now (with time left) and what's next.
import { fmtT, shortCallsign, type GuideIndex, type Model } from "@/lib/client/model";
import type { GuideChannel, Program } from "@/lib/server/guide";
import { matchupOf, isEvent, minsLeft } from "@/lib/client/sports";

export type Row = { num: number; callsign: string; name: string; ch: GuideChannel | null };

const nowNext = (ch: GuideChannel | null, now: number): [Program | null, Program | null] => {
  if (!ch) return [null, null];
  const i = ch.programs.findIndex((p) => p.start <= now && p.end > now);
  const cur = i >= 0 ? ch.programs[i] : null;
  const next = ch.programs.find((p) => p.start >= (cur?.end ?? now) && !p.filler) || null;
  return [cur, next];
};
const label = (p: Program) => (p.filler ? "Nothing scheduled" : isEvent(p) ? matchupOf(p) : p.title);
const sub = (p: Program) => (p.filler ? "" : isEvent(p) ? p.title : p.subtitle);

export default function ChannelList({ m, rows, favs, onFav, onTune, currentNum, boxId, empty }: { m: Model; gi: GuideIndex; rows: Row[]; favs: Set<number>; onFav: (num: number, on: boolean) => void; onTune: (num: number) => void; currentNum: number | null; boxId: string; empty?: React.ReactNode }) {
  const now = Date.now();
  if (!rows.length) return <div className="sempty">{empty || "No channels match."}</div>;
  return (
    <div className="clist" role="list">
      {rows.map((r) => {
        const [cur, next] = nowNext(r.ch, now); const other = m.boxes.find((b) => b.channel === r.num && b.id !== boxId); const fav = favs.has(r.num);
        return (
          <div key={r.num} role="listitem" className={`crow ${r.num === currentNum ? "cur" : ""} ${cur?.filler || !cur ? "quiet" : ""}`} style={{ "--c": other?.color || "" } as React.CSSProperties}>
            <button className={`star ${fav ? "on" : ""}`} onClick={() => onFav(r.num, !fav)} aria-pressed={fav} aria-label={fav ? `Remove ${r.callsign} from favorites` : `Add ${r.callsign} to favorites`}>{fav ? "★" : "☆"}</button>
            <button className="cmain" onClick={() => onTune(r.num)} aria-label={`Tune to ${r.callsign} ${r.num}`}>
              <span className="cs">{shortCallsign(r.callsign) || `CH ${r.num}`}<small className="num">{r.num}</small></span>
              <span className="nowp">
                {cur ? <><b>{label(cur)}</b>{cur.liveBroadcast && isEvent(cur) ? <span className="chip red">Live</span> : null}<small>{sub(cur) ? `${sub(cur)} · ` : ""}{cur.filler ? "" : minsLeft(cur, now)}</small></> : <small>{r.name || "No listing"}</small>}
              </span>
              <span className="nextp">{next ? <><small>{fmtT(next.start)}</small>{label(next)}</> : null}</span>
              {r.num === currentNum ? <span className="onbox">this box</span> : other ? <span className="onbox">on {other.name}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
