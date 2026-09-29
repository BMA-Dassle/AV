// Live sports out of the guide: games and events (anything with teams or a league), one entry per event even when
// several channels carry it, sorted the way a bartender looks for them: live broadcasts first, then what starts soon.
import type { GuideChannel, Program } from "@/lib/server/guide";
import { shortCallsign, tvsOn, type GuideIndex, type Model } from "./model";

export type SportEvent = {
  key: string; p: Program; c: GuideChannel;               // the best channel for it (on a box, else live, else lowest number)
  channels: GuideChannel[];                                // every channel carrying it at that time
  league: string; matchup: string; show: string;           // "College Football", "Colorado at Baylor", "College Football"
  state: "live" | "replay" | "soon" | "later" | "rerun";   // rerun = an upcoming airing that is not live
  onBoxes: string[];                                       // box ids already on one of its channels
};

// League labels staff recognise, from TV Media's league code and the show title.
export function leagueOf(p: Program): string {
  const l = (p.league || "").toUpperCase(); const t = `${p.title} ${p.subtitle}`;
  if (l === "NFL" || /\bNFL\b/.test(t)) return "NFL";
  if (l === "NCAA" || /college/i.test(t)) {
    if (/football/i.test(t)) return "College Football";
    if (/basketball/i.test(t)) return "College Basketball";
    if (/baseball|softball/i.test(t)) return "College Baseball";
    if (/soccer/i.test(t)) return "College Soccer";
    if (/volleyball/i.test(t)) return "College Volleyball";
    if (/hockey/i.test(t)) return "College Hockey";
    return "College";
  }
  if (l === "MLB" || /\bMLB\b|baseball/i.test(t)) return "MLB";
  if (l === "NBA" || /\bNBA\b/.test(t)) return "NBA";
  if (l === "WNBA") return "WNBA";
  if (l === "NHL" || /\bNHL\b|hockey/i.test(t)) return "NHL";
  if (/^(MLS|EPL|UEFA|FIFA|CONCACAF|FEF|LIGA|LMX|SERIE|BUND|UCL|NWSL)/.test(l) || /soccer|f[uú]tbol|premier league|champions league/i.test(t)) return "Soccer";
  if (/^(PGA|LPGA|LIV|DPW)/.test(l) || /golf/i.test(t)) return "Golf";
  if (/^(ATP|WTA)/.test(l) || /tennis/i.test(t)) return "Tennis";
  if (/^(NASCAR|NHRA|F1|INDY|IMSA|MOTO)/.test(l) || /racing|nascar|formula 1|indycar|motogp/i.test(t)) return "Racing";
  if (/^(UFC|PFL|BOX)/.test(l) || /\bUFC\b|boxing|\bMMA\b|wrestling/i.test(t)) return "Fighting";
  if (l === "WPT" || /poker/i.test(t)) return "Poker";
  if (l === "AFL") return "Aussie Rules";
  if (l === "NPB") return "Baseball";
  return p.league || "Sports";
}

// An event is a real game or competition, not a studio show: it has teams, or a league on a sports listing.
export const isEvent = (p: Program) => !p.filler && p.sport && Boolean((p.teams && p.teams.length) || p.league);

export function matchupOf(p: Program): string {
  if (p.subtitle && p.teams?.length) return p.subtitle;
  if (p.teams && p.teams.length === 2) return `${p.teams[0]} vs. ${p.teams[1]}`;
  return p.subtitle || p.title;
}

const SOON_MS = 2 * 3600000;

export function sportEvents(m: Model, gi: GuideIndex, now = Date.now(), horizonMs = 12 * 3600000): SportEvent[] {
  const byKey = new Map<string, SportEvent>();
  const boxOn = (num: number) => m.boxes.filter((b) => b.channel === num).map((b) => b.id);
  for (const c of gi.guide?.channels || []) {
    for (const p of c.programs) {
      if (!isEvent(p) || p.end <= now || p.start > now + horizonMs) continue;
      const key = `${p.title}|${p.subtitle}|${p.start}`;
      const live = p.start <= now;
      const state: SportEvent["state"] = live ? (p.liveBroadcast ? "live" : "replay") : !p.liveBroadcast ? "rerun" : p.start - now <= SOON_MS ? "soon" : "later";
      const ev = byKey.get(key);
      if (ev) { ev.channels.push(c); ev.onBoxes.push(...boxOn(c.num)); if (p.liveBroadcast && !ev.p.liveBroadcast) { ev.p = p; ev.state = state; } continue; }
      byKey.set(key, { key, p, c, channels: [c], league: leagueOf(p), matchup: matchupOf(p), show: p.title, state, onBoxes: boxOn(c.num) });
    }
  }
  const list = [...byKey.values()];
  for (const ev of list) {
    // show it on the channel a box already has, else the lowest-numbered one (the main network before the alternates)
    const onBox = ev.channels.find((c) => m.boxes.some((b) => b.channel === c.num));
    ev.c = onBox || [...ev.channels].sort((a, b) => a.num - b.num)[0];
    ev.onBoxes = [...new Set(ev.onBoxes)];
  }
  const rank = { live: 0, soon: 1, later: 2, replay: 3, rerun: 4 } as const;
  return list.sort((a, b) => rank[a.state] - rank[b.state] || (a.state === "live" || a.state === "replay" ? b.onBoxes.length - a.onBoxes.length || a.p.end - b.p.end : a.p.start - b.p.start) || a.c.num - b.c.num);
}

// Search over what staff type: team, show, league, callsign or channel number.
export function matches(q: string, ...fields: (string | number | null | undefined | string[])[]) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return true;
  const hay = fields.flat().filter((x) => x != null).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}
export const eventMatches = (q: string, e: SportEvent) => matches(q, e.matchup, e.show, e.league, e.p.teams || [], e.channels.map((c) => [shortCallsign(c.callsign), String(c.num)]).flat());

export function leagueCounts(events: SportEvent[]) {
  const n = new Map<string, number>(); for (const e of events) n.set(e.league, (n.get(e.league) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]);
}

// Sunday Ticket (and its mixes / RedZone) as the guide names them.
export const isSundayTicket = (c: GuideChannel) => /^NFLST\d+/i.test(c.callsign) || c.programs.some((p) => /sunday ticket|redzone/i.test(p.title));

export function minsLeft(p: Program, now = Date.now()) { const m = Math.max(0, Math.round((p.end - now) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min left` : `${m} min left`; }
export function startsIn(p: Program, now = Date.now()) { const m = Math.round((p.start - now) / 60000); return m <= 0 ? "now" : m < 60 ? `in ${m} min` : ""; }
export const screensOn = (m: Model, boxIds: string[]) => boxIds.reduce((n, id) => n + tvsOn(m, id).length, 0);
