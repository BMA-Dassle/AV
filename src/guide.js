'use strict';
// TV guide providers behind GET /api/guide?from=&hours=&filter=
//
//   -> { lineupId, provider, from, to, channels: [ { num, callsign, name, logo, cat, programs: [ { start, end, title, subtitle, sport, live, league, teams } ] } ] }
//
// Providers:
//   tvmedia  TV Media / TVPassport listings API (http://api.tvmedia.ca/tv/v4). Commercial plan "Intro":
//            1,000 calls/month, 5 days ahead. We fetch one 6-hour window per hour and cache it, ~720 calls/month.
//            DirecTV Fort Myers-Naples lineup id: 36463D (found via /lineups?postalCode=33912 on 2026-09-28).
//   mock     canned data for development.
const cfg = require('./config');
const channels = require('./channels');

// ---------------------------------------------------------------------------
// Channel classification (the lineup does not carry categories on the brief listings)
// ---------------------------------------------------------------------------
const SPORTS_CALLSIGNS = /^(ESPN|ESPN2|ESPNU|ESPNW|ESPNN|FS1|FS2|NFLN|NFL|MLB|NBA|NHL|GOLF|TENNIS|CBSSN|B10|BTN|SEC|SEC-A|ACCN|FDS|FDSFL|FDSSUN|BSSUN|TUDN|NBCSN|PAC12|OLY|MAVTV|FSP|LONGHORN|LHN|MSG|YES)/i;
const NEWS_CALLSIGNS = /^(CNN|FNC|MSNBC|CNBC|HLN|BBCA|NEWSMAX|NEWSN|WEATHER|TWC|BLOOM|FBN|CSPAN)/i;
function classify(num, callsign) {
  if (num >= 9000) return 'package';           // commercial NFL Sunday Ticket block (9555+), other event channels
  if (num >= 700 && num < 800) return 'package'; // residential Sunday Ticket / League Pass / Extra Innings
  if (num < 100) return 'local';
  if (SPORTS_CALLSIGNS.test(callsign)) return 'sports';
  if (NEWS_CALLSIGNS.test(callsign)) return 'news';
  return 'entertainment';
}
const FILLER = /^(local programming|to be announced|paid programming|off air|channel no longer available)$/i;
const SPORT_WORDS = /\b(football|baseball|basketball|hockey|soccer|golf|tennis|nascar|racing|boxing|ufc|mma|wrestling|volleyball|lacrosse|rugby|cricket|motogp|indycar|formula|olympic|sportscenter|pregame|postgame|gameday|kickoff)\b/i;

// ---------------------------------------------------------------------------
// TV Media provider
// ---------------------------------------------------------------------------
const TVMEDIA_BASE = 'http://api.tvmedia.ca/tv/v4';
const TVMEDIA_LOGO = 'http://cdn.tvpassport.com/image/station/100x100/';
const WINDOW_HOURS = 6;          // one fetch covers this much
const CACHE_TTL_MS = 60 * 60000; // refetch a window after an hour (listings change rarely)
const MONTHLY_CALL_CAP = Number(process.env.TVMEDIA_MONTHLY_CAP || 900);

const tvmediaCache = new Map(); // key: lineup|window start -> { fetchedAt, rows, from, to }
const callLog = { month: '', calls: 0 };
function countCall() {
  const m = new Date().toISOString().slice(0, 7);
  if (callLog.month !== m) { callLog.month = m; callLog.calls = 0; }
  callLog.calls += 1;
}

const hourFloor = (ms) => { const d = new Date(ms); d.setUTCMinutes(0, 0, 0); return d.getTime(); };
const isoNoMs = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

async function tvmediaFetchWindow(fromMs, toMs, lineup, timezone) {
  if (!cfg.guide.tvmedia.apiKey) throw Object.assign(new Error('TVMEDIA_API_KEY is not set'), { status: 500 });
  if (callLog.calls >= MONTHLY_CALL_CAP && callLog.month === new Date().toISOString().slice(0, 7)) {
    throw Object.assign(new Error(`TV Media monthly call cap (${MONTHLY_CALL_CAP}) reached; serving nothing new until next month`), { status: 503 });
  }
  const url = new URL(`${TVMEDIA_BASE}/lineups/${lineup}/listings`);
  url.searchParams.set('api_key', cfg.guide.tvmedia.apiKey);
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('start', isoNoMs(fromMs));
  url.searchParams.set('end', isoNoMs(toMs));
  url.searchParams.set('detail', 'brief');
  countCall();
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw Object.assign(new Error(`TV Media ${res.status}`), { status: 502, body: await res.text().catch(() => '') });
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json.listings || json.data || []);
    return rows;
  } finally { clearTimeout(t); }
}

// listDateTime is local time in the requested timezone ("2026-09-28 19:00:00"); convert to epoch ms.
function localToMs(str, tz) {
  const [date, time] = str.split(' ');
  const [y, mo, d] = date.split('-').map(Number); const [h, mi, s] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  // offset of tz at that instant
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess));
  const get = (k) => Number(parts.find((p) => p.type === k).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return guess - (asUtc - guess);
}

async function tvmediaProvider(fromMs, toMs, lineup, timezone) {
  // Serve from one cached window when it covers the request, else fetch a fresh 6-hour window starting at the hour.
  const now = Date.now();
  for (const [k, w] of tvmediaCache) {
    if (k.startsWith(lineup + '|') && w.from <= fromMs && w.to >= toMs && now - w.fetchedAt < CACHE_TTL_MS) return w.rows;
  }
  const start = hourFloor(fromMs);
  const end = Math.max(start + WINDOW_HOURS * 3600000, toMs);
  const rows = await tvmediaFetchWindow(start, end, lineup, timezone);
  tvmediaCache.set(`${lineup}|${start}`, { fetchedAt: now, rows, from: start, to: end });
  for (const [k, w] of tvmediaCache) if (now - w.fetchedAt > 24 * 3600000) tvmediaCache.delete(k);
  return rows;
}

function tvmediaShape(rows, fromMs, toMs, filter, tz) {
  const now = Date.now();
  const byNum = new Map();
  for (const r of rows) {
    const num = Number(r.channelNumber); if (!Number.isFinite(num)) continue;
    if (/no longer available/i.test(r.showName || '')) continue;
    let ch = byNum.get(num);
    const callsign = r.callsign || `CH ${num}`;
    if (!ch) { ch = { num, callsign, name: callsign, logo: r.logoFilename ? TVMEDIA_LOGO + r.logoFilename : null, cat: classify(num, r.callsign || ''), programs: [] }; byNum.set(num, ch); }
    const start = localToMs(r.listDateTime, tz); const end = start + Number(r.duration || 0) * 60000;
    if (end <= fromMs || start >= toMs) continue;
    const filler = FILLER.test(r.showName || '');
    const sport = !filler && (Boolean(r.league) || r.showTypeID === 'O' || SPORT_WORDS.test(r.showName || ''));
    ch.programs.push({
      start, end, title: r.showName || '', subtitle: r.episodeTitle || '',
      sport, live: start <= now && end > now,        // airing right now
      liveBroadcast: Boolean(r.live),                // TV Media's flag: a live (not taped) broadcast
      league: r.league || null, teams: r.team1 || r.team2 ? [r.team1, r.team2].filter(Boolean) : null,
      isNew: Boolean(r.new), repeat: Boolean(r.repeat), hd: Boolean(r.hd), listingId: r.listingID, filler,
    });
  }
  let list = [...byNum.values()].sort((a, b) => a.num - b.num);
  for (const ch of list) {
    ch.programs.sort((a, b) => a.start - b.start);
    // The brief listing includes alternate-feed placeholders ("Local Programming", "To Be Announced") that
    // overlap real programs. Drop a filler row whenever a real program overlaps it.
    const real = ch.programs.filter((p) => !p.filler);
    ch.programs = ch.programs.filter((p) => !p.filler || !real.some((q) => q.start < p.end && q.end > p.start));
  }
  if (filter && filter !== 'all') list = list.filter((c) => c.cat === filter || (filter === 'sports' && c.programs.some((p) => p.sport)));
  return list;
}

// ---------------------------------------------------------------------------
// Mock provider (development without a key)
// ---------------------------------------------------------------------------
const MOCK_TITLES = {
  sports: [['NFL Football', 'Dolphins at Jets', 'NFL'], ['College Football', 'Utah at Arizona State', 'NCAA'], ['MLB Baseball', 'Dodgers at Yankees', 'MLB'], ['SportsCenter', '', ''], ['NASCAR Cup Series', 'Playoffs from Kansas', 'NASCAR'], ['PGA Tour Golf', 'Final round', 'PGA']],
  local: [['NFL Football', 'Cowboys at Packers', 'NFL'], ['Sunday Night Football', 'Ravens at Bills', 'NFL'], ['Local News', '', ''], ['60 Minutes', '', '']],
  package: [['NFL Sunday Ticket', 'Game feed', 'NFL'], ['NFL Sunday Ticket', 'Off air', '']],
  news: [['Newsroom', '', ''], ['Evening Report', '', '']],
  entertainment: [['Sitcom block', '', ''], ['Movie', '', '']],
};
function mockShape(fromMs, toMs, filter) {
  const now = Date.now();
  return channels.CHANNELS.filter((c) => filter === 'all' || !filter || c.cat === filter).map((c) => {
    const titles = MOCK_TITLES[c.cat] || MOCK_TITLES.entertainment; const programs = [];
    let t = hourFloor(fromMs) - 3600000; let i = c.num % titles.length;
    while (t < toMs) {
      const [title, subtitle, league] = titles[i % titles.length]; const dur = c.cat === 'news' || c.cat === 'entertainment' ? 60 : 180;
      const end = t + dur * 60000; const sport = Boolean(league);
      if (end > fromMs) programs.push({ start: t, end, title, subtitle, sport, live: sport && t <= now && end > now, league: league || null, teams: null });
      t = end; i++;
    }
    return { num: c.num, callsign: c.callsign, name: c.name, logo: null, cat: c.cat, programs };
  });
}

// ---------------------------------------------------------------------------
async function getGuide({ from = Date.now(), hours = 3, filter = 'all', lineup, timezone } = {}) {
  const fromMs = Number(from) || Date.parse(from) || Date.now();
  const toMs = fromMs + Math.min(24, Number(hours) || 3) * 3600000;
  const provider = cfg.guide.provider;
  const lu = lineup || cfg.guide.tvmedia.lineup; const tz = timezone || cfg.guide.timezone;
  let list;
  if (provider === 'tvmedia') list = tvmediaShape(await tvmediaProvider(fromMs, toMs, lu, tz), fromMs, toMs, filter, tz);
  else if (provider === 'mock') list = mockShape(fromMs, toMs, filter);
  else throw Object.assign(new Error(`Guide provider "${provider}" is not implemented`), { status: 501 });
  return { lineupId: provider === 'tvmedia' ? lu : 'mock', provider, from: fromMs, to: toMs, timezone: tz, channels: list, calls: provider === 'tvmedia' ? { ...callLog, cap: MONTHLY_CALL_CAP } : undefined };
}

module.exports = { getGuide, classify };
