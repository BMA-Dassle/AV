// TV guide providers behind /api/guide?from=&hours=&filter=
//   tvmedia  TV Media / TVPassport listings API (http://api.tvmedia.ca/tv/v4), Intro plan: 1,000 calls/month, 5 days.
//            One 6-hour window per hour per lineup, cached, hard monthly cap. Lineup 36463D = DirecTV Fort Myers-Naples.
//   mock     canned data for development.
import { cfg, HttpError } from "./config";
import { CHANNELS } from "./channels";

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
const WINDOW_HOURS = 6;
const CACHE_TTL_MS = 60 * 60000;

type Win = { fetchedAt: number; rows: any[]; from: number; to: number };
const g = globalThis as unknown as { __tvmediaCache?: Map<string, Win>; __tvmediaCalls?: { month: string; calls: number } };
const cache = (g.__tvmediaCache ??= new Map());
const callLog = (g.__tvmediaCalls ??= { month: "", calls: 0 });
function countCall() { const m = new Date().toISOString().slice(0, 7); if (callLog.month !== m) { callLog.month = m; callLog.calls = 0; } callLog.calls += 1; }

const hourFloor = (ms: number) => { const d = new Date(ms); d.setUTCMinutes(0, 0, 0); return d.getTime(); };
const isoNoMs = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

async function tvmediaFetchWindow(fromMs: number, toMs: number, lineup: string, timezone: string): Promise<any[]> {
  if (!cfg.guide.tvmedia.apiKey) throw new HttpError("TVMEDIA_API_KEY is not set", 500);
  const m = new Date().toISOString().slice(0, 7);
  if (callLog.month === m && callLog.calls >= cfg.guide.tvmedia.monthlyCap) throw new HttpError(`TV Media monthly call cap (${cfg.guide.tvmedia.monthlyCap}) reached`, 503);
  const url = new URL(`${TVMEDIA_BASE}/lineups/${lineup}/listings`);
  url.searchParams.set("api_key", cfg.guide.tvmedia.apiKey);
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("start", isoNoMs(fromMs));
  url.searchParams.set("end", isoNoMs(toMs));
  url.searchParams.set("detail", "brief");
  countCall();
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new HttpError(`TV Media ${res.status}`, 502, await res.text().catch(() => ""));
    const json: any = await res.json();
    return Array.isArray(json) ? json : json.listings || json.data || [];
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

async function tvmediaRows(fromMs: number, toMs: number, lineup: string, timezone: string) {
  const now = Date.now();
  for (const [k, w] of cache) if (k.startsWith(lineup + "|") && w.from <= fromMs && w.to >= toMs && now - w.fetchedAt < CACHE_TTL_MS) return w.rows;
  const start = hourFloor(fromMs);
  const end = Math.max(start + WINDOW_HOURS * 3600000, toMs);
  const rows = await tvmediaFetchWindow(start, end, lineup, timezone);
  cache.set(`${lineup}|${start}`, { fetchedAt: now, rows, from: start, to: end });
  for (const [k, w] of cache) if (now - w.fetchedAt > 24 * 3600000) cache.delete(k);
  return rows;
}

function tvmediaShape(rows: any[], fromMs: number, toMs: number, filter: string, tz: string): GuideChannel[] {
  const now = Date.now();
  const byNum = new Map<number, GuideChannel>();
  for (const r of rows) {
    const num = Number(r.channelNumber); if (!Number.isFinite(num)) continue;
    if (/no longer available/i.test(r.showName || "")) continue;
    const callsign = r.callsign || `CH ${num}`;
    let ch = byNum.get(num);
    if (!ch) { ch = { num, callsign, name: callsign, logo: r.logoFilename ? TVMEDIA_LOGO + r.logoFilename : null, cat: classify(num, r.callsign || ""), programs: [] }; byNum.set(num, ch); }
    const start = localToMs(r.listDateTime, tz); const end = start + Number(r.duration || 0) * 60000;
    if (end <= fromMs || start >= toMs) continue;
    const filler = FILLER.test(r.showName || "");
    const sport = !filler && (Boolean(r.league) || r.showTypeID === "O" || SPORT_WORDS.test(r.showName || ""));
    ch.programs.push({ start, end, title: r.showName || "", subtitle: r.episodeTitle || "", sport, live: start <= now && end > now, liveBroadcast: Boolean(r.live), league: r.league || null, teams: r.team1 || r.team2 ? [r.team1, r.team2].filter(Boolean) : null, isNew: Boolean(r.new), repeat: Boolean(r.repeat), hd: Boolean(r.hd), listingId: r.listingID, filler });
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
  return { lineupId: provider === "tvmedia" ? lineup : "mock", provider, from: fromMs, to: toMs, timezone: tz, channels, calls: provider === "tvmedia" ? { ...callLog, cap: cfg.guide.tvmedia.monthlyCap } : undefined };
}
