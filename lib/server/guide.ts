// TV guide providers behind /api/guide?from=&hours=&filter=
//   tvmedia  TV Media / TVPassport listings API (http://api.tvmedia.ca/tv/v4), Intro plan: 1,000 calls/month, 5 days.
//            One 24-hour window every 3 hours per lineup, cached in memory and in the shared store, hard monthly cap. Lineup 36463D = DirecTV Fort Myers-Naples.
//   mock     canned data for development.
import { cfg, HttpError } from "./config";
import { gzipSync, gunzipSync } from "node:zlib";
import { CHANNELS } from "./channels";
import { hasStore, store } from "./store";

export type Program = { start: number; end: number; title: string; subtitle: string; sport: boolean; live: boolean; liveBroadcast?: boolean; league: string | null; teams: string[] | null; isNew?: boolean; repeat?: boolean; hd?: boolean; listingId?: number; filler?: boolean };
export type GuideChannel = { num: number; callsign: string; name: string; logo: string | null; cat: string; programs: Program[] };
export type Guide = { lineupId: string; provider: string; from: number; to: number; timezone: string; channels: GuideChannel[]; calls?: { month: string; calls: number; cap: number } };

const SPORTS_CALLSIGNS = /^(ESPN|ESPN2|ESPNU|ESPNW|ESPNN|FS1|FS2|NFLN|NFL|MLB|NBA|NHL|GOLF|TENN|TENNIS|CBSSN|B10|BTN|SEC|SEC-A|ACCN|FDS|FDSFL|FDSSUN|BSSUN|TUDN|NBCSN|PAC12|OLY|MAVTV|FSP|LONGHORN|LHN|MSG|YES|RACER)/i;
const NEWS_CALLSIGNS = /^(CNN|FNC|MSNBC|CNBC|HLN|BBCA|NEWSMAX|NEWSN|WEATHER|TWC|BLOOM|FBN|CSPAN)/i;
const FILLER = /^(local programming|to be announced|paid programming|off air|channel no longer available)$/i;
const SPORT_WORDS = /\b(football|baseball|basketball|hockey|soccer|golf|tennis|nascar|racing|boxing|ufc|mma|wrestling|volleyball|lacrosse|rugby|cricket|motogp|indycar|formula|olympic|sportscenter|pregame|postgame|gameday|kickoff)\b/i;

export function classify(num: number, callsign: string) {
  if (num >= 9000) return "package";
  if (num >= 700 && num < 800) return "package";
  if (num < 100) return "local";
  if (SPORTS_CALLSIGNS.test(callsign)) return "sports";
  if (NEWS_CALLSIGNS.test(callsign)) return "news";
  return "entertainment";
}

const TVMEDIA_BASE = "http://api.tvmedia.ca/tv/v4";
const TVMEDIA_LOGO = "http://cdn.tvpassport.com/image/station/100x100/";
const WINDOW_HOURS = 24;                 // one call returns a whole day (~10k listings, ~2 s)
const CACHE_TTL_MS = 3 * 60 * 60000;
const DAILY_CAP = 20;                    // ~2.5x normal use; 20 x 31 = 620, still under the 1,000/month plan     // refresh every 3 h: ~240 calls/month for the whole app, whatever the tablet count

// Listings kept small: only the fields the app reads (a 24 h window is ~2 MB this way, ~400 KB gzipped).
type Row = { n: string; c: string; l: string | null; t: string; d: number; s: string; e: string; g: string | null; y: string; v: boolean; a: string | null; b: string | null; w: boolean; r: boolean; h: boolean; i: number };
const slim = (x: any): Row => ({ n: x.channelNumber, c: x.callsign, l: x.logoFilename || null, t: x.listDateTime, d: Number(x.duration || 0), s: x.showName || "", e: x.episodeTitle || "", g: x.league || null, y: x.showTypeID || "", v: Boolean(x.live), a: x.team1 || null, b: x.team2 || null, w: Boolean(x.new), r: Boolean(x.repeat), h: Boolean(x.hd), i: x.listingID });

type Win = { fetchedAt: number; rows: Row[]; from: number; to: number };
const g = globalThis as unknown as { __tvmediaCache?: Map<string, Win>; __tvmediaCalls?: { month: string; calls: number }; __tvmediaInflight?: Map<string, Promise<Row[]>> };
const cache = (g.__tvmediaCache ??= new Map());
const inflight = (g.__tvmediaInflight ??= new Map());
const callLog = (g.__tvmediaCalls ??= { month: "", calls: 0 });
const monthNow = () => new Date().toISOString().slice(0, 7);

const hourFloor = (ms: number) => { const d = new Date(ms); d.setUTCMinutes(0, 0, 0); return d.getTime(); };
const isoNoMs = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

async function tvmediaFetchWindow(fromMs: number, toMs: number, lineup: string, timezone: string): Promise<Row[]> {
  if (!cfg.guide.tvmedia.apiKey) throw new HttpError("TVMEDIA_API_KEY is not set", 500);
  const m = monthNow();
  if (callLog.month !== m) { callLog.month = m; callLog.calls = 0; }
  // The cap is counted in the shared store when there is one (every instance spends the same budget), else in memory.
  const used = hasStore() ? await store.guideCalls(m).catch(() => callLog.calls) : callLog.calls;
  if (used >= cfg.guide.tvmedia.monthlyCap) throw new HttpError(`TV Media monthly call cap (${cfg.guide.tvmedia.monthlyCap}) reached`, 503);
  // Safety net: normal use is ~8 calls a day (one 24 h window every 3 h). A bug or a cache outage stops here instead
  // of spending the month's budget in a day.
  const day = new Date().toISOString().slice(0, 10);
  const today = hasStore() ? await store.guideCalls(day).catch(() => 0) : 0;
  if (today >= DAILY_CAP) throw new HttpError(`TV Media daily safety cap (${DAILY_CAP}) reached; the guide shows the last listings`, 503);
  const url = new URL(`${TVMEDIA_BASE}/lineups/${lineup}/listings`);
  url.searchParams.set("api_key", cfg.guide.tvmedia.apiKey);
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("start", isoNoMs(fromMs));
  url.searchParams.set("end", isoNoMs(toMs));
  url.searchParams.set("detail", "brief");
  callLog.calls = hasStore() ? await store.bumpGuideCalls(m).catch(() => callLog.calls + 1) : callLog.calls + 1;
  if (hasStore()) await store.bumpGuideCalls(day).catch(() => 0);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new HttpError(`TV Media ${res.status}`, 502, await res.text().catch(() => ""));
    const json: any = await res.json();
    return (Array.isArray(json) ? json : json.listings || json.data || []).map(slim);
  } finally { clearTimeout(t); }
}

// listDateTime is local time in the requested timezone ("2026-09-28 19:00:00"); convert to epoch ms.
function localToMs(str: string, tz: string) {
  const [date, time] = str.split(" ");
  const [y, mo, d] = date.split("-").map(Number); const [h, mi, s] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess));
  const get = (k: string) => Number(parts.find((p) => p.type === k)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return guess - (asUtc - guess);
}

// Memory, then the shared store, then one TV Media call for the next 24 h (deduplicated while in flight).
async function tvmediaRows(fromMs: number, toMs: number, lineup: string, timezone: string): Promise<Row[]> {
  const now = Date.now();
  for (const [k, w] of cache) if (k.startsWith(lineup + "|") && w.from <= fromMs && w.to >= toMs && now - w.fetchedAt < CACHE_TTL_MS) return w.rows;
  const start = hourFloor(fromMs);
  const key = `${lineup}|${start}`;
  const running = inflight.get(key); if (running) return running;
  const work = (async () => {
    if (hasStore()) {
      try {
        const hit = await store.loadGuideWindow(lineup, fromMs, toMs, CACHE_TTL_MS);
        if (hit) { const rows = JSON.parse(gunzipSync(Buffer.from(hit.blob, "base64")).toString("utf8")) as Row[]; cache.set(`${lineup}|${hit.from}`, { fetchedAt: hit.fetchedAt, rows, from: hit.from, to: hit.to }); return rows; }
      } catch (e: any) { console.warn("guide cache read failed:", e?.message); }
    }
    const end = Math.max(start + WINDOW_HOURS * 3600000, toMs);
    let rows: Row[];
    try { rows = await tvmediaFetchWindow(start, end, lineup, timezone); }
    catch (e) {
      // cap reached or TV Media down: keep serving the newest listings we still have that cover "now"
      const old = [...cache.values()].filter((w) => w.from <= fromMs && w.to > fromMs).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
      if (old) return old.rows;
      if (hasStore()) { const hit = await store.loadGuideWindow(lineup, fromMs, fromMs, 2 * 24 * 3600000).catch(() => null); if (hit) return JSON.parse(gunzipSync(Buffer.from(hit.blob, "base64")).toString("utf8")) as Row[]; }
      throw e;
    }
    cache.set(key, { fetchedAt: Date.now(), rows, from: start, to: end });
    for (const [k, w] of cache) if (Date.now() - w.fetchedAt > CACHE_TTL_MS * 2) cache.delete(k);
    if (hasStore()) await store.saveGuideWindow(lineup, start, end, gzipSync(JSON.stringify(rows)).toString("base64")).catch((e) => console.warn("guide cache save failed:", e?.message));
    return rows;
  })().finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}

function tvmediaShape(rows: Row[], fromMs: number, toMs: number, filter: string, tz: string): GuideChannel[] {
  const now = Date.now();
  const byNum = new Map<number, GuideChannel>();
  for (const r of rows) {
    const num = Number(r.n); if (!Number.isFinite(num)) continue;
    if (/no longer available/i.test(r.s)) continue;
    const callsign = r.c || `CH ${num}`;
    let ch = byNum.get(num);
    if (!ch) { ch = { num, callsign, name: callsign, logo: r.l ? TVMEDIA_LOGO + r.l : null, cat: classify(num, r.c || ""), programs: [] }; byNum.set(num, ch); }
    const start = localToMs(r.t, tz); const end = start + r.d * 60000;
    if (end <= fromMs || start >= toMs) continue;
    const filler = FILLER.test(r.s);
    const sport = !filler && (Boolean(r.g) || r.y === "O" || SPORT_WORDS.test(r.s));
    ch.programs.push({ start, end, title: r.s, subtitle: r.e, sport, live: start <= now && end > now, liveBroadcast: r.v, league: r.g, teams: r.a || r.b ? [r.a, r.b].filter((x): x is string => Boolean(x)) : null, isNew: r.w, repeat: r.r, hd: r.h, listingId: r.i, filler });
  }
  let list = [...byNum.values()].sort((a, b) => a.num - b.num);
  for (const ch of list) {
    ch.programs.sort((a, b) => a.start - b.start);
    const real = ch.programs.filter((p) => !p.filler);
    ch.programs = ch.programs.filter((p) => !p.filler || !real.some((q) => q.start < p.end && q.end > p.start));
  }
  if (filter && filter !== "all") list = list.filter((c) => c.cat === filter || (filter === "sports" && c.programs.some((p) => p.sport)));
  return list;
}

const MOCK_TITLES: Record<string, [string, string, string][]> = {
  sports: [["NFL Football", "Dolphins at Jets", "NFL"], ["College Football", "Utah at Arizona State", "NCAA"], ["MLB Baseball", "Dodgers at Yankees", "MLB"], ["SportsCenter", "", ""], ["NASCAR Cup Series", "Playoffs from Kansas", "NASCAR"], ["PGA Tour Golf", "Final round", "PGA"]],
  local: [["NFL Football", "Cowboys at Packers", "NFL"], ["Sunday Night Football", "Ravens at Bills", "NFL"], ["Local News", "", ""], ["60 Minutes", "", ""]],
  package: [["NFL Sunday Ticket", "Game feed", "NFL"], ["NFL Sunday Ticket", "Off air", ""]],
  news: [["Newsroom", "", ""], ["Evening Report", "", ""]],
  entertainment: [["Sitcom block", "", ""], ["Movie", "", ""]],
};
function mockShape(fromMs: number, toMs: number, filter: string): GuideChannel[] {
  const now = Date.now();
  return CHANNELS.filter((c) => filter === "all" || !filter || c.cat === filter).map((c) => {
    const titles = MOCK_TITLES[c.cat] || MOCK_TITLES.entertainment; const programs: Program[] = [];
    let t = hourFloor(fromMs) - 3600000; let i = c.num % titles.length;
    while (t < toMs) {
      const [title, subtitle, league] = titles[i % titles.length]; const dur = c.cat === "news" || c.cat === "entertainment" ? 60 : 180;
      const end = t + dur * 60000; const sport = Boolean(league);
      if (end > fromMs) programs.push({ start: t, end, title, subtitle, sport, live: t <= now && end > now, league: league || null, teams: null });
      t = end; i++;
    }
    return { num: c.num, callsign: c.callsign, name: c.name, logo: null, cat: c.cat, programs };
  });
}

export async function getGuide(q: { from?: string | number | null; hours?: string | number | null; filter?: string | null; lineup?: string; timezone?: string }): Promise<Guide> {
  const fromMs = Number(q.from) || (q.from ? Date.parse(String(q.from)) : 0) || Date.now();
  const toMs = fromMs + Math.min(24, Number(q.hours) || 3) * 3600000;
  const filter = q.filter || "all";
  const lineup = q.lineup || cfg.guide.tvmedia.lineup; const tz = q.timezone || cfg.guide.timezone;
  const provider = cfg.guide.provider;
  let channels: GuideChannel[];
  if (provider === "tvmedia") channels = tvmediaShape(await tvmediaRows(fromMs, toMs, lineup, tz), fromMs, toMs, filter, tz);
  else if (provider === "mock") channels = mockShape(fromMs, toMs, filter);
  else throw new HttpError(`Guide provider "${provider}" is not implemented`, 501);
  return { lineupId: provider === "tvmedia" ? lineup : "mock", provider, from: fromMs, to: toMs, timezone: tz, channels, calls: provider === "tvmedia" ? { month: callLog.month, calls: callLog.calls, cap: cfg.guide.tvmedia.monthlyCap } : undefined };
}
