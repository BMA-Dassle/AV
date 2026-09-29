/* Head Pinz TV Control front end.
   Runs against the Node app's /api when it is there (public/index.html), otherwise on the inline mock
   data below (the published mockup). One source for both. */

/* ---------- inline mock data (seeded from the live Fort Myers controller, 2026-09-28) ---------- */
const MOCK = {
  boxes: [
    { id: 'dtv1', name: 'DTV 1', color: '#fb923c', channel: 9562 }, { id: 'dtv2', name: 'DTV 2', color: '#60a5fa', channel: 9561 },
    { id: 'dtv3', name: 'DTV 3', color: '#facc15', channel: 9561 }, { id: 'dtv4', name: 'DTV 4', color: '#4ade80', channel: 9559 },
    { id: 'dtv5', name: 'DTV 5', color: '#f472b6', channel: 9565 }, { id: 'dtv6', name: 'DTV 6', color: '#a78bfa', channel: 218 },
    { id: 'dtv7', name: 'DTV 7', color: '#2dd4bf', channel: 618 }, { id: 'dtv8', name: 'DTV 8', color: '#f87171', channel: 20 },
  ],
  other: [
    { id: 'music1', name: 'Bowling Music 1', kind: 'Music' }, { id: 'music2', name: 'Bowling Music 2', kind: 'Music' },
    { id: 'atmosphere', name: 'Atmosphere', kind: 'Signage' }, { id: 'mms1', name: 'MMS 1', kind: 'Signage' },
  ],
  zones: [
    { id: 'bar', name: 'Bar' }, { id: 'pool', name: 'Pool Tables' }, { id: 'axe', name: 'Axe Throwing' }, { id: 'patio', name: 'Patio' },
    { id: 'terrace', name: 'Terrace' }, { id: 'vip', name: 'VIP' }, { id: 'lanes', name: 'Lanes (Projectors)' }, { id: 'neoverse', name: 'Neoverse' },
    { id: 'shuffly', name: 'Shuffly' }, { id: 'other', name: 'Other' },
  ],
  tvs: [
    ['bar-1','Bar 1','bar','dtv7',774,1326],['bar-2','Bar 2','bar','dtv6',705,1414],['bar-3','Bar 3','bar','dtv8',557,1414],['bar-4','Bar 4','bar','dtv8',409,1414],
    ['bar-5','Bar 5','bar','dtv7',261,1414],['bar-6','Bar 6','bar','dtv5',191,1326],['bar-7','Bar 7','bar','dtv7',181,1239],['bar-8','Bar 8','bar','dtv6',329,1239],
    ['bar-9','Bar 9','bar','dtv8',477,1239],['bar-10','Bar 10','bar','dtv7',625,1239],['bar-11','Bar 11','bar','dtv8',773,1239],
    ['pool-1','Pool Table 1','pool','dtv7',29,1212],['pool-2','Pool Table 2','pool','dtv6',29,732],['pool-3','Pool Table 3','pool','dtv7',178,732],['pool-4','Pool Table 4','pool','dtv8',332,753],['pool-5','Pool Table 5','pool','dtv7',332,923],
    ['axe-1','Axe Throwing 1','axe','dtv8',940,1011],['axe-2','Axe Throwing 2','axe','dtv7',940,1101],['axe-3','Axe Throwing 3','axe','dtv8',474,1101],['axe-4','Axe Throwing 4','axe','dtv7',474,1011],
    ['patio-1','Patio 1','patio','dtv7',374,1621],['patio-2','Patio 2','patio','dtv5',546,1621],['patio-3','Patio 3','patio','dtv7',755,1621],['patio-4','Patio 4','patio','dtv8',926,1621],
    ['terrace-1','Terrace 1','terrace','dtv7',1078,317],['terrace-2','Terrace 2','terrace','dtv8',1078,421],['terrace-3','Terrace 3','terrace','dtv7',1078,525],['terrace-4','Terrace 4','terrace','dtv5',1080,893],
    ['vip-1','VIP 1','vip','dtv7',992,85],['vip-2','VIP 2','vip','dtv6',828,129],['vip-3','VIP 3','vip','dtv7',628,129],
    ['proj-1','Projector 1','lanes','dtv8',162,1841],['proj-2','Projector 2','lanes','music1',312,1841],['proj-3','Projector 3','lanes','dtv8',462,1841],['proj-4','Projector 4','lanes','dtv8',612,1841],['proj-5','Projector 5','lanes','music1',762,1841],['proj-6','Projector 6','lanes','dtv8',912,1841],
    ['neo-1','Neoverse 1','neoverse','dtv7',1150,1841],['neo-2','Neoverse 2','neoverse','dtv7',1300,1841],['neo-3','Neoverse 3','neoverse','dtv7',1150,1931],['neo-4','Neoverse 4','neoverse','dtv7',1300,1931],
    ['shuffly-1','Shuffly 1','shuffly','dtv8',840,1425],['shuffly-2','Shuffly 2','shuffly','dtv7',970,1425],['shuffly-3','Shuffly 3','shuffly','dtv7',1100,1425],
    ['meeting','Meeting Room','other','dtv7',255,520],['frontdesk','Front Desk','other',null,1301,838],
  ].map(([id, name, zone, src, x, y]) => ({ id, name, zone, src, x, y })),
  channels: [
    [11,'WINK','CBS','local'],[20,'WBBH','NBC','local'],[26,'WZVN','ABC','local'],[36,'WFTX','FOX','local'],
    [206,'ESPN','ESPN','sports'],[209,'ESPN2','ESPN2','sports'],[208,'ESPNU','ESPNU','sports'],[219,'FS1','FOX Sports 1','sports'],[618,'FS2','FOX Sports 2','sports'],
    [212,'NFLN','NFL Network','sports'],[213,'MLBN','MLB Network','sports'],[216,'NBATV','NBA TV','sports'],[218,'GOLF','Golf Channel','sports'],[221,'CBSSN','CBS Sports Net','sports'],
    [610,'BTN','Big Ten Network','sports'],[611,'SECN','SEC Network','sports'],[612,'ACCN','ACC Network','sports'],[654,'FDSUN','FanDuel Sports Sun','sports'],
    [245,'TNT','TNT','entertainment'],[247,'TBS','TBS','entertainment'],[202,'CNN','CNN','news'],[360,'FNC','Fox News','news'],
    [9559,'NFLST6','Sunday Ticket 6','package'],[9561,'NFLST8','Sunday Ticket 8','package'],[9562,'NFLST9','Sunday Ticket 9','package'],[9565,'NFLST12','Sunday Ticket 12','package'],[9566,'NFLST13','Sunday Ticket 13','package'],
  ].map(([num, callsign, name, cat]) => ({ num, callsign, name, cat })),
  // per channel: [startOffsetMin from grid start, durationMin, title, subtitle, sport?]
  progs: {
    11:[[-60,180,'NFL Football','Dolphins at Jets',1],[120,180,'NFL Football','Chiefs at Chargers',1],[300,60,'60 Minutes','']],
    20:[[-30,90,'Football Night in America','Pregame',1],[60,210,'Sunday Night Football','Ravens at Bills',1],[270,60,'WBBH News at 11','']],
    26:[[-60,120,"America's Funniest Home Videos",''],[60,120,'Celebrity Wheel of Fortune',''],[180,120,'The Rookie','']],
    36:[[-60,180,'NFL Football','Cowboys at Packers',1],[120,60,'The OT','Postgame',1],[180,120,"The Simpsons / Bob's Burgers",'']],
    206:[[-90,180,'MLB Baseball','Dodgers at Yankees',1],[90,60,'SportsCenter',''],[150,180,'MNF Countdown','',1]],
    209:[[-60,180,'College Football','Louisiana-Monroe at Alabama (replay)',1],[120,120,'NFL PrimeTime','',1],[240,120,'World Series of Poker','']],
    208:[[-60,180,'College Football','Duke at Syracuse',1],[120,240,'College Football','Utah at Arizona State',1]],
    219:[[-60,150,'NASCAR Cup Series','Playoffs from Kansas',1],[90,60,'NASCAR Post-Race',''],[150,210,'WWE SmackDown (replay)','']],
    618:[[-90,180,'MLB Baseball','Dodgers at Yankees',1],[90,90,'Big Noon Kickoff (replay)',''],[180,180,'Drone Racing League','']],
    212:[[-60,120,'NFL RedZone Recap','',1],[60,180,'NFL GameDay Highlights','',1],[240,120,'NFL Total Access','']],
    213:[[-60,180,'MLB Tonight','',1],[120,180,'MLB Baseball','Padres at Giants',1],[300,60,'Quick Pitch','']],
    216:[[-60,240,'NBA Preseason','Lakers at Suns',1],[180,180,'NBA TV Classic','1998 Finals Game 6']],
    218:[[-120,240,'PGA Tour Golf','Procore Championship, final round',1],[120,120,'Golf Central',''],[240,120,'LPGA Tour Golf','Highlights']],
    221:[[-60,180,'College Football','Navy at Air Force',1],[120,180,'Inside College Football','']],
    610:[[-60,180,'College Football','Illinois at Indiana',1],[120,180,'B1G Football & Beyond','']],
    611:[[-60,180,'College Football','Ole Miss at LSU (replay)',1],[120,180,'SEC Football Final','']],
    612:[[-60,180,'College Football','Miami at Florida State (replay)',1],[120,180,'ACC Huddle','']],
    654:[[-60,180,'MLB Baseball','Rays at Orioles',1],[120,60,'Rays Postgame',''],[180,180,'Inside the Rays','']],
    245:[[-60,120,'Law & Order (2)',''],[60,120,'The Big Bang Theory (4)',''],[180,180,'AEW Collision','']],
    247:[[-60,120,'Friends (4)',''],[60,120,'MLB Postseason Preview','',1],[180,180,'Young Sheldon (6)','']],
    202:[[-60,60,'CNN Newsroom',''],[0,120,'State of the Union',''],[120,120,'Anderson Cooper 360','']],
    360:[[-60,60,'Fox News Sunday',''],[0,120,'Life, Liberty & Levin',''],[120,120,'Sunday Night in America','']],
    9559:[[-90,210,'NFL Sunday Ticket','Dolphins at Jets',1],[120,180,'NFL Sunday Ticket','Chiefs at Chargers',1]],
    9561:[[-90,210,'NFL Sunday Ticket','Ravens at Bills',1],[120,180,'Sunday Ticket','Off air']],
    9562:[[-90,210,'IndyCar Racing','Music City Grand Prix',1],[120,180,'Sunday Ticket','Off air']],
    9565:[[-90,210,'NFL Sunday Ticket','Chiefs at Chargers',1],[120,180,'Sunday Ticket','Off air']],
    9566:[[-90,210,'NFL Sunday Ticket','Bears at Raiders',1],[120,180,'Sunday Ticket','Off air']],
  },
};

/* ---------- model + state ---------- */
const M = { live: false, boxes: [], tvs: [], other: [], zones: [], site: 'Fort Myers' };
const S = { sel: new Set(), zoneZoom: null, tab: 'tvs', gfilter: 'sports', hlSource: null, busy: new Set(), pending: new Set() };
let GUIDE = { byNum: new Map(), channels: [], from: 0, to: 0, provider: 'mock' };
let CATALOG = { favorites: [], all: [] };
let gridStart = halfHourFloor(Date.now());

function halfHourFloor(ms) { const d = new Date(ms); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); }
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = (id) => M.tvs.find((t) => t.id === id);
const boxById = (id) => M.boxes.find((b) => b.id === id);
const srcName = (id) => boxById(id)?.name || M.other.find((o) => o.id === id)?.name || (id ? id : 'Off');
const srcColor = (id) => boxById(id)?.color || (id ? '#98a2b3' : '#323e53');
const tvsOn = (id) => M.tvs.filter((t) => t.src === id);
const fmtT = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const label = (ids) => { const n = ids.map((id) => byId(id)?.name || id); return n.length <= 3 ? n.join(', ') : `${n.slice(0, 2).join(', ')} +${n.length - 2} more`; };
function toast(html, kind = 'success') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => t.remove(), kind === 'error' ? 6000 : 3200); }

/* channel + program lookups: guide data first, then the catalog, then a bare number */
function chan(num) {
  const g = GUIDE.byNum.get(Number(num)); if (g) return { num: g.num, cs: g.callsign, name: g.name, cat: g.cat, logo: g.logo };
  const c = CATALOG.all.find((c) => c.num === Number(num)); if (c) return { num: c.num, cs: c.callsign, name: c.name, cat: c.cat };
  return { num, cs: 'CH ' + num, name: 'Channel ' + num, cat: 'other' };
}
function progAt(num, t = Date.now()) { return GUIDE.byNum.get(Number(num))?.programs.find((p) => p.start <= t && p.end > t) || null; }
function boxNow(b) {
  const p = progAt(b.channel);
  if (p) return { title: p.title, sub: p.subtitle, start: p.start, end: p.end, live: p.live };
  if (b.tuned?.title) return { title: b.tuned.title, sub: b.tuned.episodeTitle || '', start: b.tuned.startTime ? b.tuned.startTime * 1000 : null, end: b.tuned.startTime && b.tuned.duration ? (b.tuned.startTime + b.tuned.duration) * 1000 : null };
  return null;
}

/* ---------- URL parameters: ?location=<slug|square id>&token=<app token> ---------- */
const URLP = new URLSearchParams(location.search);
const LOC = URLP.get('location') || '';
let TOKEN = URLP.get('token') || '';
try { if (TOKEN) localStorage.setItem('hp-token', TOKEN); else TOKEN = localStorage.getItem('hp-token') || ''; } catch { /* private mode */ }
if (URLP.has('token')) { URLP.delete('token'); history.replaceState(null, '', location.pathname + (URLP.toString() ? '?' + URLP : '') + location.hash); }
const apiUrl = (path, params = {}) => { const u = new URL(path, location.origin); if (LOC) u.searchParams.set('location', LOC); for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v); return u.pathname + u.search; };
const apiHeaders = () => (TOKEN ? { authorization: 'Bearer ' + TOKEN } : {});

/* ---------- data layer: live API or mock ---------- */
function applySnapshot(snap) {
  M.live = true;
  M.site = snap.site?.shortName || M.site; M.siteSlug = snap.site?.slug;
  M.zones = snap.zones;
  M.tvs = snap.tvs.map((t) => ({ id: t.id, name: t.name, zone: t.zone, src: t.sourceId, x: t.map?.[0] ?? 0, y: t.map?.[1] ?? 0, error: t.error }));
  M.boxes = snap.boxes.map((b) => ({ id: b.id, name: b.name, color: b.color, channel: b.tuned?.channel ?? null, tuned: b.tuned, online: b.online, error: b.error, pending: Boolean(b.tuned?.pending), preview: b.preview || null }));
  M.other = snap.otherSources.map((o) => ({ id: o.id, name: o.name, kind: o.kind ? o.kind[0].toUpperCase() + o.kind.slice(1) : '' }));
  S.busy.clear();
  $('#sitename').textContent = `${M.site} · ${M.tvs.length} screens · ${M.boxes.length} DirecTV boxes`;
}
function renderLocations(locs) {
  const sel = $('#locsel'); if (!sel || !Array.isArray(locs) || locs.length < 2) return;
  sel.innerHTML = locs.map((l) => `<option value="${esc(l.slug)}" ${l.slug === (M.site?.slug || LOC) || l.squareLocationIDs?.includes(LOC) ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  sel.onchange = () => { const u = new URL(location.href); u.searchParams.set('location', sel.value); location.href = u.toString(); };
}
function useMock() {
  M.live = false; M.boxes = MOCK.boxes.map((b) => ({ ...b })); M.other = MOCK.other.map((o) => ({ ...o })); M.zones = MOCK.zones; M.tvs = MOCK.tvs.map((t) => ({ ...t }));
  CATALOG = { favorites: MOCK.channels.filter((c) => c.cat === 'sports' || c.cat === 'local'), all: MOCK.channels };
  $('#sitename').textContent = `Fort Myers · ${M.tvs.length} screens · 8 DirecTV boxes · mockup`;
}
function mockGuide() {
  const channels = MOCK.channels.map((c) => ({ ...c, logo: null, programs: (MOCK.progs[c.num] || []).map(([o, d, title, subtitle, sport]) => { const start = gridStart + o * 60000, end = start + d * 60000; const now = Date.now(); return { start, end, title, subtitle, sport: Boolean(sport), live: start <= now && end > now, league: null, teams: null }; }) }));
  return { provider: 'mock', from: gridStart - 3600000, to: gridStart + 6 * 3600000, channels };
}
function setGuide(g) { GUIDE = { ...g, byNum: new Map(g.channels.map((c) => [c.num, c])) }; }

const api = {
  async post(url, body) {
    const r = await fetch(apiUrl(url), { method: 'POST', headers: { 'content-type': 'application/json', ...apiHeaders() }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.message || `${r.status} ${r.statusText}`);
    return j;
  },
  async init() {
    try {
      const r = await fetch(apiUrl('/api/state'), { cache: 'no-store', headers: apiHeaders() });
      if (r.status === 401) { this.authFailed = true; throw new Error('unauthorized'); }
      if (r.status === 404) { this.badLocation = true; throw new Error('unknown location'); }
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no api');
      applySnapshot(await r.json());
      try { CATALOG = await (await fetch(apiUrl('/api/channels'), { headers: apiHeaders() })).json(); } catch { /* keep empty */ }
      try { const locs = await (await fetch(apiUrl('/api/locations'), { headers: apiHeaders() })).json(); renderLocations(locs); } catch { /* single site */ }
      this.subscribe();
    } catch (e) {
      if (this.authFailed) { document.querySelector('main').innerHTML = '<div class="alert warn" style="margin-top:20px"><span class="ico">⚠</span><div><b>Sign-in required.</b> Open this page with the link that includes the access token.</div></div>'; return; }
      if (this.badLocation) { document.querySelector('main').innerHTML = '<div class="alert warn" style="margin-top:20px"><span class="ico">⚠</span><div><b>Unknown location.</b> Check the location in the address bar.</div></div>'; return; }
      useMock();
    }
    await this.loadGuide();
    setInterval(() => this.loadGuide(), 10 * 60000);
  },
  subscribe() {
    // Server-sent events when the host keeps connections open; otherwise (serverless hosts) poll every 10 s.
    let polling = null;
    const poll = async () => { try { const r = await fetch(apiUrl('/api/state'), { cache: 'no-store', headers: apiHeaders() }); if (r.ok) { applySnapshot(await r.json()); renderAll(); $('#livedot').classList.remove('off'); } else $('#livedot').classList.add('off'); } catch { $('#livedot').classList.add('off'); } };
    const startPolling = () => { if (!polling) polling = setInterval(poll, 10000); };
    try {
      const es = new EventSource(apiUrl('/api/events', TOKEN ? { token: TOKEN } : {}));
      es.onmessage = (e) => { applySnapshot(JSON.parse(e.data)); renderAll(); $('#livedot').classList.remove('off'); };
      es.onerror = () => { $('#livedot').classList.add('off'); if (es.readyState === EventSource.CLOSED) startPolling(); };
      setTimeout(() => { if (es.readyState !== EventSource.OPEN) startPolling(); }, 8000);
    } catch { startPolling(); }
  },
  async loadGuide() {
    gridStart = halfHourFloor(Date.now());
    if (!M.live) { setGuide(mockGuide()); return; }
    try {
      const from = gridStart - 60 * 60000;
      const g = await (await fetch(apiUrl('/api/guide', { from, hours: 7, filter: 'all' }), { headers: apiHeaders() })).json();
      setGuide(g);
    } catch (e) { toast('Guide data unavailable: ' + esc(e.message), 'error'); }
    if (S.tab === 'guide') renderGuide(); renderBoxes();
  },
  async setSource(ids, src) {
    if (!M.live) { ids.forEach((id) => { const t = byId(id); if (t) t.src = src; }); return { results: ids.map((tv) => ({ tv, ok: true })) }; }
    return this.post('/api/tvs/source', { tvIds: ids, sourceId: src });
  },
  async tune(boxId, channel) {
    if (!M.live) { const b = boxById(boxId); b.channel = channel; return { affectedTvs: tvsOn(boxId).map((t) => t.name) }; }
    return this.post(`/api/boxes/${boxId}/tune`, { channel });
  },
  async key(boxId, key) {
    if (!M.live) { const b = boxById(boxId); const list = CATALOG.all.map((c) => c.num).sort((a, c) => a - c); let i = list.indexOf(b.channel); if (i < 0) i = 0; if (key === 'chanup') b.channel = list[(i + 1) % list.length]; if (key === 'chandown') b.channel = list[(i - 1 + list.length) % list.length]; if (key === 'prev' && b.last) [b.channel, b.last] = [b.last, b.channel]; return {}; }
    return this.post(`/api/boxes/${boxId}/key`, { key });
  },
};

/* ---------- boxes strip ---------- */
function renderBoxes() {
  $('#boxes').innerHTML = M.boxes.map((b) => {
    const n = tvsOn(b.id).length, c = chan(b.channel), p = boxNow(b);
    const armed = S.sel.size > 0; const hl = S.hlSource === b.id;
    const status = b.online === false ? `<span class="chip red">Offline</span>` : (n === 0 ? `<span class="chip free">Free</span>` : `<span class="chip c">${n} screen${n > 1 ? 's' : ''}</span>`);
    const chText = b.channel ? `${esc(c.cs)}<small class="num">${c.num}</small>` : `<span style="color:var(--muted-foreground)">—</span>`;
    return `<button class="box card ${armed ? 'armed' : ''} ${hl ? 'hl' : ''} ${n === 0 ? 'free' : ''}" style="--c:${b.color}" data-box="${b.id}" aria-label="${b.name}, channel ${c.num} ${esc(c.name)}, on ${n} screens">
      <div class="top"><span class="name">${b.name}</span>${status}</div>
      <div class="ch">${chText}</div>
      <div class="title">${b.pending ? '<span style="color:var(--primary)">Tuning…</span>' : p ? esc(p.title) + (p.sub ? ' · ' + esc(p.sub) : '') : (b.error ? `<span style="color:var(--red-400)">${esc(b.error)}</span>` : '<span style="color:var(--muted-foreground)">No guide data</span>')}</div>
    </button>`;
  }).join('');
  $('#boxhint').textContent = S.sel.size ? `Tap a box to show it on the ${S.sel.size} selected screen${S.sel.size > 1 ? 's' : ''}` : 'Tap a box to change its channel';
}

/* ---------- floor map ---------- */
const MAPW = 1470, MAPH = 2400;
const ZONE_LABELS = [[487,1370,'Bar'],[770,1511,'Patio'],[113,943,'Pool Tables'],[801,69,'VIP'],[1087,701,'Terrace'],[545,2215,'Lanes'],[1150,1800,'Neoverse'],[840,1395,'Shuffly'],[474,985,'Axe Throwing']];
const SHORT = [['Axe Throwing','Axe'],['Pool Table','Pool'],['Projector','Proj'],['Neoverse','Neo'],['Terrace','Terr'],['Shuffly','Shuf'],['Meeting Room','Meeting'],['Front Desk','Desk']];
const CODE = { bar: 'B', pool: 'PT', axe: 'AX', patio: 'PA', terrace: 'TE', vip: 'V', lanes: 'PJ', neoverse: 'N', shuffly: 'SH', other: '' };
const shortName = (n) => { for (const [a, b] of SHORT) if (n.startsWith(a)) return n.replace(a, b); return n; };
const codeName = (t) => { const n = t.name.match(/\d+$/); return t.zone === 'other' ? (t.id === 'meeting' ? 'MR' : 'FD') : (CODE[t.zone] || t.zone.slice(0, 2).toUpperCase()) + (n ? n[0] : ''); };
function zoneBox(zid) {
  const l = M.tvs.filter((t) => t.zone === zid); const xs = l.map((t) => t.x), ys = l.map((t) => t.y);
  let x0 = Math.min(...xs) - 90, y0 = Math.min(...ys) - 110, x1 = Math.max(...xs) + 220, y1 = Math.max(...ys) + 160;
  const minW = 720; if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  const minH = (x1 - x0) * 0.55; if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(MAPW, x1), y1: Math.min(MAPH, y1) };
}
function resolveOverlaps(items, w, h, pad) {
  const W = w + pad, H = h + pad;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; const dx = b.cx - a.cx, dy = b.cy - a.cy; const ox = W - Math.abs(dx), oy = H - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue; moved = true;
      if (ox < oy) { const sx = (dx >= 0 ? 1 : -1) * ox / 2; a.cx -= sx; b.cx += sx; } else { const sy = (dy >= 0 ? 1 : -1) * oy / 2; a.cy -= sy; b.cy += sy; }
    }
    if (!moved) break;
  }
  return items;
}
const layoutMode = () => (window.innerWidth < 700 ? 'phone' : (window.innerWidth > window.innerHeight ? 'landscape' : 'upright'));
function tileSVG(t, cx, cy, TW, TH, short) {
  const b = boxById(t.src); const cs = b ? (b.channel ? chan(b.channel).cs : b.name) : (t.src ? srcName(t.src).replace(/ \d+$/, '') : 'Off');
  const sel = S.sel.has(t.id); const hl = S.hlSource && t.src === S.hlSource; const dim = S.hlSource && t.src !== S.hlSource; const busy = S.busy.has(t.id);
  return `<g class="mtv ${sel ? 'sel' : ''} ${hl ? 'hl' : ''} ${dim ? 'dimmed' : ''} ${t.src ? '' : 'off'} ${busy ? 'busy' : ''}" style="--c:${srcColor(t.src)}" data-tv="${t.id}" transform="translate(${(cx - TW / 2).toFixed(1)},${(cy - TH / 2).toFixed(1)})" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${esc(t.name)}">
    <rect class="b" width="${TW}" height="${TH}"/><text class="cs" x="${TW - 7}" y="${Math.round(TH * 0.42)}">${busy ? '…' : esc(cs)}</text><text class="nm" x="7" y="${TH - 9}">${esc(short ? shortName(t.name) : t.name)}</text>
    <g class="chk" transform="translate(5,5)"><circle r="9" cx="9" cy="9" fill="#3b82f6"/><path d="M4.5 9.5l3 3L13.5 6.5" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
}
function renderMap() {
  const m = $('#map'); const mode = layoutMode(); const zc = $('#zoomctl');
  if (mode !== 'phone') S.zoneZoom = null;
  zc.hidden = !(mode === 'phone' && S.zoneZoom);
  const img = (t = '') => `<image href="{{FLOOR}}" x="0" y="0" width="${MAPW}" height="${MAPH}" preserveAspectRatio="none"${t}/>`;
  if (mode === 'landscape') {
    const P = (x, y) => [y, MAPW - x]; const TW = 104, TH = 62;
    const items = resolveOverlaps(M.tvs.map((t) => { const [cx, cy] = P(t.x + 65, t.y + 35); return { t, cx, cy }; }), TW, TH, 6);
    const labels = ZONE_LABELS.map(([x, y, l]) => { const [px, py] = P(x + 64, y + 18); return `<text class="zl" x="${px}" y="${py}" text-anchor="middle">${l}</text>`; }).join('');
    m.innerHTML = `<svg viewBox="0 0 ${MAPH} ${MAPW}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor map">${img(' transform="matrix(0 -1 1 0 0 ' + MAPW + ')"')}${labels}${items.map((i) => tileSVG(i.t, i.cx, i.cy, TW, TH, true)).join('')}</svg>`;
    return;
  }
  if (mode === 'upright') {
    const labels = ZONE_LABELS.map(([x, y, l]) => `<text class="zl" x="${x + 64}" y="${y + 18}" text-anchor="middle">${l}</text>`).join('');
    m.innerHTML = `<svg viewBox="0 0 ${MAPW} ${MAPH}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor map">${img()}${labels}${M.tvs.map((t) => tileSVG(t, t.x + 65, t.y + 35, 130, 70, false)).join('')}</svg>`;
    return;
  }
  if (S.zoneZoom) {
    const z = M.zones.find((z) => z.id === S.zoneZoom); const bb = zoneBox(z.id); const TW = Math.round(Math.max(170, (bb.x1 - bb.x0) / 5.2)), TH = Math.round(TW * 0.54);
    $('#zname').textContent = z.name;
    const items = resolveOverlaps(M.tvs.filter((t) => t.zone === z.id).map((t) => ({ t, cx: t.x + 65, cy: t.y + 35 })), TW, TH, 10);
    items.forEach((i) => { i.cx = Math.max(bb.x0 + TW / 2 + 6, Math.min(bb.x1 - TW / 2 - 6, i.cx)); i.cy = Math.max(bb.y0 + TH / 2 + 6, Math.min(bb.y1 - TH / 2 - 6, i.cy)); });
    const ghosts = M.tvs.filter((t) => t.zone !== z.id && t.x + 65 > bb.x0 && t.x + 65 < bb.x1 && t.y + 35 > bb.y0 && t.y + 35 < bb.y1)
      .map((t) => `<g class="dot dimmed" data-zonezoom="${t.zone}" style="--c:${srcColor(t.src)}" transform="translate(${t.x + 65},${t.y + 35})"><circle r="22"/><text>${codeName(t)}</text></g>`).join('');
    m.innerHTML = `<svg viewBox="${bb.x0} ${bb.y0} ${bb.x1 - bb.x0} ${bb.y1 - bb.y0}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="${esc(z.name)} screens">${img()}${ghosts}${items.map((i) => tileSVG(i.t, i.cx, i.cy, TW, TH, false)).join('')}</svg>`;
    return;
  }
  const hits = M.zones.filter((z) => M.tvs.some((t) => t.zone === z.id)).map((z) => { const bb = zoneBox(z.id); return `<rect class="zhit" data-zonezoom="${z.id}" x="${bb.x0}" y="${bb.y0}" width="${bb.x1 - bb.x0}" height="${bb.y1 - bb.y0}"/>`; }).join('');
  const labels = ZONE_LABELS.map(([x, y, l]) => `<text class="zl big" x="${x + 64}" y="${y + 30}" text-anchor="middle" pointer-events="none">${l}</text>`).join('');
  const dots = M.tvs.map((t) => { const sel = S.sel.has(t.id); const dim = S.hlSource && t.src !== S.hlSource;
    return `<g class="dot ${sel ? 'sel' : ''} ${dim ? 'dimmed' : ''} ${t.src ? '' : 'off'}" data-zonezoom="${t.zone}" style="--c:${srcColor(t.src)}" transform="translate(${t.x + 65},${t.y + 35})" role="button" aria-label="${esc(t.name)}"><circle r="30"/><text>${codeName(t)}</text></g>`; }).join('');
  m.innerHTML = `<svg viewBox="0 0 ${MAPW} ${MAPH}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor map overview: tap an area to zoom in">${img()}${hits}${labels}${dots}</svg>`;
}

/* ---------- selection bar ---------- */
function renderSheet() {
  const sh = $('#sheet'); const ids = [...S.sel];
  if (!ids.length) { sh.classList.remove('open'); return; }
  sh.classList.add('open');
  const cur = new Set(ids.map((id) => byId(id)?.src));
  $('#who').innerHTML = `${ids.length} screen${ids.length > 1 ? 's' : ''} selected<small>${esc(label(ids))}</small>`;
  const boxBtns = M.boxes.map((b) => { const c = chan(b.channel), p = boxNow(b), n = tvsOn(b.id).length; const isCur = cur.size === 1 && cur.has(b.id);
    return `<button class="srcbtn ${isCur ? 'cur' : ''}" style="--c:${b.color}" data-src="${b.id}" aria-label="Show ${b.name} on selected screens"><span class="a">${b.channel ? esc(c.cs) : b.name}<small>${b.name}${n ? ' · ' + n : ''}</small></span><span class="b">${esc(p ? (p.sub || p.title) : c.name)}</span></button>`; }).join('');
  const otherBtns = M.other.map((o) => `<button class="srcbtn" data-src="${o.id}"><span class="a">${esc(o.name)}</span><span class="b">${esc(o.kind)}</span></button>`).join('');
  $('#srcs').innerHTML = boxBtns + otherBtns + `<button class="srcbtn off" data-src=""><span class="a">Off</span><span class="b">Blank the screen</span></button>`;
}
function syncModeClass() { document.querySelector('.app').classList.toggle('selecting', S.sel.size > 0); }
function renderAll() { syncModeClass(); renderBoxes(); renderMap(); renderSheet(); if (S.tab === 'guide') renderGuide(); }

/* ---------- actions ---------- */
async function applySource(ids, src) {
  ids.forEach((id) => S.busy.add(id)); S.sel.clear(); S.hlSource = null; renderAll();
  try {
    const r = await api.setSource(ids, src);
    const failed = (r.results || []).filter((x) => !x.ok);
    if (!M.live) { S.busy.clear(); renderAll(); }
    const b = boxById(src); const what = b ? `<b>${esc(b.channel ? chan(b.channel).cs : b.name)}</b> (${b.name})` : `<b>${esc(srcName(src))}</b>`;
    if (failed.length) toast(`${failed.map((f) => esc(byId(f.tv)?.name || f.tv)).join(', ')} did not switch: ${esc(failed[0].error || 'error')}`, 'error');
    else toast(`${esc(label(ids))} → ${what}`);
  } catch (e) { S.busy.clear(); renderAll(); toast('Could not switch: ' + esc(e.message), 'error'); }
}
async function tuneBox(boxId, num) {
  const b = boxById(boxId); const affected = tvsOn(boxId); b.last = b.channel; b.pending = true; renderAll();
  try {
    await api.tune(boxId, num);
    if (!M.live) { b.pending = false; renderAll(); }
    toast(`${b.name} tuned to <b>${esc(chan(num).cs)} ${num}</b>${affected.length ? ` · ${affected.length} screen${affected.length > 1 ? 's' : ''} changed` : ''}`, 'info');
  } catch (e) { b.pending = false; renderAll(); toast(`${b.name}: ${esc(e.message)}`, 'error'); }
}
async function sendKey(boxId, key) {
  const b = boxById(boxId);
  try { await api.key(boxId, key); if (!M.live) renderAll(); } catch (e) { toast(`${b.name}: ${esc(e.message)}`, 'error'); }
}
function suggestBox(num) {
  const on = M.boxes.find((b) => b.channel === num); if (on) return { box: on, reason: 'already on it' };
  const free = M.boxes.find((b) => tvsOn(b.id).length === 0 && b.online !== false); if (free) return { box: free, reason: 'not on any screen' };
  const least = [...M.boxes].sort((a, b) => tvsOn(a.id).length - tvsOn(b.id).length)[0]; return { box: least, reason: `fewest screens (${tvsOn(least.id).length})` };
}

/* ---------- box dialog ---------- */
let entry = '';
function catalogFor(cat) {
  const all = CATALOG.all.length ? CATALOG.all : GUIDE.channels;
  if (cat === 'fav') return CATALOG.favorites.length ? CATALOG.favorites : all.filter((c) => c.cat === 'sports' || c.cat === 'local');
  if (cat === 'all') return all;
  return all.filter((c) => c.cat === cat);
}
function openBox(boxId, opts = {}) {
  const b = boxById(boxId); const feeds = tvsOn(boxId); const c = chan(b.channel); const p = boxNow(b);
  const Mo = $('#modal'), card = $('#mcard'); entry = '';
  const cats = [['fav', 'Favorites'], ['sports', 'Sports'], ['local', 'Locals'], ['package', 'Sunday Ticket'], ['all', 'All']];
  let cat = opts.cat || 'fav';
  const draw = () => {
    const list = catalogFor(cat);
    const prog = p && p.start && p.end ? Math.min(100, Math.max(0, Math.round((Date.now() - p.start) / (p.end - p.start) * 100))) : 0;
    card.className = 'dlg box';
    card.innerHTML = `
      <div class="hd"><h2><span class="swatch" style="--c:${b.color}"></span>${b.name}<span class="chip ${feeds.length ? 'c' : 'free'}" style="--c:${b.color}">${feeds.length ? feeds.length + ' screens' : 'Free'}</span>${b.online === false ? '<span class="chip red">Offline</span>' : ''}</h2><button class="x" data-close aria-label="Close">✕</button></div>
      <div class="boxcols">
        <div class="left">
          <div class="preview" style="--c:${b.color};--p:${prog}%" aria-label="Preview of ${b.name}">
            <div class="scene"></div>
            <div class="pv" id="pv"></div>
            <span class="live"><i></i>LIVE</span><span class="tag" id="pvtag">Preview · ${b.name}</span>
            <div class="cs">${b.channel ? esc(c.cs) : '—'}<small class="num">${b.channel || ''}</small></div>
            <div class="tt">${p ? esc(p.title) + (p.sub ? ' · ' + esc(p.sub) : '') : esc(c.name)}</div>
            <div class="clock num">${fmtT(Date.now())}</div>
            <div class="bar"><i></i></div>
          </div>
          <div class="now slim"><div class="big">${b.channel ? esc(c.cs) : '—'}<small class="num">${b.channel || ''}</small></div><div class="t">${p ? esc(p.sub || p.title) : esc(c.name)}</div>
            <div class="m">${p && p.start && p.end ? `${fmtT(p.start)} – ${fmtT(p.end)}` : ''}${b.pending ? ' · tuning…' : ''}</div></div>
          ${feeds.length ? `<div class="alert warn"><span class="ico">⚠</span><div><b>Feeds ${feeds.length} screen${feeds.length > 1 ? 's' : ''}.</b> Changing the channel changes all of them.
            <div class="feeds">${feeds.map((t) => `<span class="pill">${esc(t.name)}</span>`).join('')}</div></div></div>`
            : `<div class="alert ok"><span class="ico">✓</span><div><b>No screens are watching this box.</b> Safe to change.</div></div>`}
        </div>
        <div>
          <div class="chips" style="margin-bottom:8px">${cats.map(([k, l]) => `<button class="tog" aria-pressed="${cat === k}" data-cat="${k}">${l}</button>`).join('')}</div>
          <div class="favgrid compact">${list.map((ch) => { const on = M.boxes.find((x) => x.channel === ch.num && x.id !== b.id); const np = progAt(ch.num); return `<button class="fav ${ch.num === b.channel ? 'cur' : ''}" data-tune="${ch.num}" style="--c:${on ? on.color : ''}" title="${esc(np ? np.title + (np.subtitle ? ' · ' + np.subtitle : '') : '')}"><span class="cs">${esc(ch.callsign)}</span><span class="n num">${ch.num} · ${esc(np ? (np.subtitle || np.title) : ch.name)}</span>${on ? `<span class="onbox">on ${on.name}</span>` : ''}</button>`; }).join('')}</div>
        </div>
        <div>
          <div class="eyebrow">Channel number</div>
          <div class="entry"><div class="disp num" id="disp">${entry}</div></div>
          <div class="pad compact">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}<button data-key="bs" aria-label="Backspace">⌫</button><button data-key="0">0</button><button class="go" data-key="go">Go</button></div>
          <div class="actions" style="justify-content:flex-start;margin-top:10px"><button class="btn outline sm" data-remote="chandown">Ch −</button><button class="btn outline sm" data-remote="chanup">Ch +</button><button class="btn outline sm" data-remote="prev">Last</button></div>
          <p class="small" style="margin:10px 0 0">${M.live ? 'Sends the change to the DirecTV box through Pandora.' : 'Mockup: simulated box.'}</p>
        </div>
      </div>`;
  };
  draw(); Mo.hidden = false; startPreview(b);
  card.onclick = async (e) => {
    const el = e.target.closest('[data-close],[data-cat],[data-tune],[data-key],[data-remote]'); if (!el) return;
    if (el.dataset.close !== undefined) { Mo.hidden = true; stopPreview(); return; }
    if (el.dataset.cat) { cat = el.dataset.cat; draw(); startPreview(b); return; }
    if (el.dataset.tune) { Mo.hidden = true; stopPreview(); await tuneBox(boxId, +el.dataset.tune); return; }
    if (el.dataset.remote) { Mo.hidden = true; stopPreview(); await sendKey(boxId, el.dataset.remote); return; }
    if (el.dataset.key) { const k = el.dataset.key; if (k === 'bs') entry = entry.slice(0, -1); else if (k === 'go') { if (entry) { const n = +entry; Mo.hidden = true; await tuneBox(boxId, n); } return; } else if (entry.length < 4) entry += k; $('#disp').textContent = entry; }
  };
}

/* ---------- box preview: direct from the LAN, with retries; placeholder when unreachable ----------
   The stream comes from an on-site gateway (see docs/PREVIEW-GATEWAY.md), not through Pandora. The tablet
   has to be on the venue network; off-site the connect fails and the placeholder stays. */
let pvState = { boxId: null, el: null, timer: null, attempt: 0, gen: 0 };
function stopPreview() {
  const gen = pvState.gen + 1;
  clearTimeout(pvState.timer);
  if (pvState.el) { try { pvState.el.pause?.(); pvState.el.removeAttribute('src'); pvState.el.load?.(); } catch { /* ignore */ } }
  pvState = { boxId: null, el: null, timer: null, attempt: 0, gen };
}
function startPreview(b) {
  stopPreview();
  const host = $('#pv'); const tag = $('#pvtag'); if (!host) return;
  if (!b.preview) { if (tag) tag.textContent = `Preview · ${b.name}`; return; }
  const gen = pvState.gen; pvState.boxId = b.id;
  const url = b.preview; const isImg = /mjpeg|\.jpe?g|snapshot/i.test(url);
  const MAX = 3, TIMEOUT = 4000, GAP = 1500;
  const attempt = () => {
    if (gen !== pvState.gen) return;
    pvState.attempt++;
    if (tag) tag.textContent = `Connecting… ${pvState.attempt}/${MAX}`;
    host.innerHTML = '';
    let el;
    if (isImg) { el = new Image(); el.className = 'pvmedia'; el.alt = ''; }
    else { el = document.createElement('video'); el.className = 'pvmedia'; el.muted = true; el.autoplay = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.preload = 'auto'; }
    pvState.el = el;
    let settled = false;
    const ok = () => { if (settled || gen !== pvState.gen) return; settled = true; clearTimeout(pvState.timer); host.appendChild(el); host.classList.add('on'); if (tag) tag.textContent = `Live preview · ${b.name}`; if (!isImg) el.play?.().catch(() => {}); };
    const fail = () => {
      if (settled || gen !== pvState.gen) return; settled = true; clearTimeout(pvState.timer);
      try { el.removeAttribute('src'); el.load?.(); } catch { /* ignore */ }
      if (pvState.attempt < MAX) { pvState.timer = setTimeout(attempt, GAP); }
      else { host.classList.remove('on'); host.innerHTML = ''; if (tag) tag.textContent = `Preview · ${b.name} · not reachable from this device`; }
    };
    if (isImg) { el.onload = ok; el.onerror = fail; el.src = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(); }
    else { el.addEventListener('loadeddata', ok, { once: true }); el.addEventListener('playing', ok, { once: true }); el.addEventListener('error', fail, { once: true }); el.src = url; el.load(); }
    pvState.timer = setTimeout(fail, TIMEOUT);
  };
  attempt();
}

/* ---------- guide ---------- */
const GF = [['sports', 'Sports'], ['package', 'Sunday Ticket'], ['local', 'Locals'], ['news', 'News'], ['all', 'All']];
function guideRows() {
  const f = S.gfilter; let rows = GUIDE.channels;
  if (f === 'sports') rows = rows.filter((c) => c.cat === 'sports' || (c.cat === 'local' && c.programs.some((p) => p.sport)));
  else if (f === 'package') rows = rows.filter((c) => c.cat === 'package');
  else if (f !== 'all') rows = rows.filter((c) => c.cat === f);
  // channels that carry nothing in the window are noise
  return rows.filter((c) => c.programs.length).sort((a, b) => a.num - b.num);
}
function renderGuide() {
  const slots = 6; const gridEnd = gridStart + slots * 30 * 60000; const now = Date.now();
  const list = guideRows();
  $('#gfilters').innerHTML = GF.map(([k, l]) => `<button class="tog" aria-pressed="${S.gfilter === k}" data-gf="${k}">${l}</button>`).join('');
  $('#glegend').innerHTML = M.boxes.filter((b) => tvsOn(b.id).length).map((b) => `<span style="--c:${b.color}"><i></i>${b.name}</span>`).join('');
  $('#gsel').textContent = S.sel.size ? `${S.sel.size} screen${S.sel.size > 1 ? 's' : ''} selected on the TVs page: ${label([...S.sel])}` : 'No screens selected. Pick a program, then choose where it goes.';
  let html = `<div class="th first">Channel</div>` + Array.from({ length: slots }, (_, i) => `<div class="th">${fmtT(gridStart + i * 30 * 60000)}</div>`).join('');
  for (const c of list) {
    const on = M.boxes.filter((b) => b.channel === c.num);
    html += `<div class="chn" style="--c:${on[0]?.color || ''}"><span class="cs">${esc(c.callsign)}<small class="num">${c.num}</small></span><span class="small">${esc(c.name)}</span>${on.length ? `<span class="on">${on.map((b) => `<span class="chip c" style="--c:${b.color}">${b.name} · ${tvsOn(b.id).length}</span>`).join('')}</span>` : ''}</div>`;
    for (const p of c.programs) {
      if (p.end <= gridStart || p.start >= gridEnd) continue;
      const s = Math.max(gridStart, p.start), e = Math.min(gridEnd, p.end);
      const c0 = Math.floor((s - gridStart) / 1800000) + 2, c1 = Math.ceil((e - gridStart) / 1800000) + 2; if (c1 <= c0) continue;
      const live = p.start <= now && p.end > now; const past = p.end <= now;
      html += `<div class="cell" style="grid-column:${c0}/${c1}"><button class="prog ${p.sport ? 'sport' : ''} ${live ? 'live' : ''} ${past ? 'past' : ''} ${on.length && live ? 'onbox' : ''}" style="--c:${on[0]?.color || ''}" data-prog="${c.num}|${p.start}" ${past ? 'disabled' : ''}>
        <span class="t">${esc(p.title)}</span><span class="s">${esc(p.subtitle || '')}${p.subtitle ? ' · ' : ''}${fmtT(p.start)}–${fmtT(p.end)}${live ? ' · LIVE' : ''}${p.league ? ' · ' + esc(p.league) : ''}</span></button></div>`;
    }
  }
  const gg = $('#gg'); gg.style.setProperty('--slots', slots); gg.innerHTML = html;
  const pct = (now - gridStart) / (slots * 30 * 60000); const nl = document.createElement('div'); nl.className = 'nowline'; nl.style.left = `calc(160px + (100% - 160px) * ${pct})`; gg.appendChild(nl);
  $('#gfoot').textContent = GUIDE.provider === 'tvmedia' ? `Guide: TV Media lineup ${GUIDE.lineupId || ''} · ${list.length} channels` : 'Guide: mock data';
}
function openProgram(num, start) {
  const c = chan(num); const p = GUIDE.byNum.get(num)?.programs.find((x) => x.start === start); if (!p) return;
  const on = M.boxes.filter((b) => b.channel === num); const sug = suggestBox(num);
  const selected = [...S.sel]; const Mo = $('#modal'), card = $('#mcard'); card.className = 'dlg';
  const live = p.start <= Date.now() && p.end > Date.now();
  card.innerHTML = `
    <div class="hd"><h2>${esc(p.title)}</h2><button class="x" data-close aria-label="Close">✕</button></div>
    <div class="now"><div class="big">${esc(c.cs)}<small class="num">${c.num}</small></div><div class="t">${esc(p.subtitle || c.name)}${p.league ? ` · ${esc(p.league)}` : ''}</div><div class="m">${fmtT(p.start)} – ${fmtT(p.end)}${live ? ' · live now' : ' · starts later'}</div></div>
    ${on.length ? `<div class="alert ok"><span class="ico">✓</span><div><b>Already on ${on.map((b) => b.name).join(' and ')}</b> (${on.map((b) => tvsOn(b.id).length + ' screens').join(', ')}). Sending screens there changes nothing else.</div></div>`
      : `<div class="alert warn"><span class="ico">⚠</span><div><b>Not on any box yet.</b> Suggested: tune <b>${sug.box.name}</b> (${sug.reason}).${tvsOn(sug.box.id).length ? ` That moves its ${tvsOn(sug.box.id).length} screens too.` : ''}</div></div>`}
    ${selected.length ? `<div><div class="eyebrow">Selected screens</div><div class="feeds">${selected.map((id) => `<span class="pill">${esc(byId(id)?.name)}</span>`).join('')}</div></div>` : ''}
    <div class="actions">
      ${live ? '' : `<button class="btn outline" disabled title="Reminders: future feature">Remind me at ${fmtT(p.start)}</button>`}
      ${on.length ? '' : `<button class="btn outline" data-go="tune">Just tune ${sug.box.name}</button>`}
      ${selected.length ? `<button class="btn primary" data-go="selected">Put on ${selected.length} selected screen${selected.length > 1 ? 's' : ''}</button>` : `<button class="btn primary" data-go="pick">Choose screens…</button>`}
    </div>`;
  Mo.hidden = false;
  card.onclick = async (e) => {
    const el = e.target.closest('[data-close],[data-go]'); if (!el) return;
    if (el.dataset.close !== undefined) { Mo.hidden = true; return; }
    const go = el.dataset.go; Mo.hidden = true;
    if (go === 'tune') { await tuneBox(sug.box.id, num); return; }
    if (go === 'pick') { switchTab('tvs'); toast(`Tap the screens that should show <b>${esc(p.subtitle || p.title)}</b>, then pick <b>${on[0]?.name || sug.box.name}</b> in the bar below.`, 'info'); if (!on.length) await tuneBox(sug.box.id, num); return; }
    if (go === 'selected') { let box = on[0]; if (!box) { await tuneBox(sug.box.id, num); box = sug.box; } await applySource(selected, box.id); }
  };
}

/* ---------- events ---------- */
function switchTab(t) { S.tab = t; document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t)); $('#page-tvs').hidden = t !== 'tvs'; $('#page-guide').hidden = t !== 'guide'; renderAll(); try { localStorage.setItem('hp-tab', t); } catch { /* private mode */ } }
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });
function toggleTv(id) { if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); S.hlSource = null; renderAll(); }
$('#page-tvs').addEventListener('click', (e) => {
  const tv = e.target.closest('[data-tv]'); if (tv) { toggleTv(tv.dataset.tv); return; }
  const zh = e.target.closest('[data-zonezoom]'); if (zh) { S.zoneZoom = zh.dataset.zonezoom; renderAll(); return; }
  const bx = e.target.closest('[data-box]'); if (bx) { const id = bx.dataset.box; if (S.sel.size) applySource([...S.sel], id); else { S.hlSource = S.hlSource === id ? null : id; renderAll(); if (S.hlSource) openBox(id); } }
});
$('#page-tvs').addEventListener('keydown', (e) => { const g = e.target.closest('.mtv'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleTv(g.dataset.tv); } });
$('#zback').onclick = () => { S.zoneZoom = null; renderAll(); };
$('#zall').onclick = () => { const list = M.tvs.filter((t) => t.zone === S.zoneZoom); const all = list.every((t) => S.sel.has(t.id)); list.forEach((t) => (all ? S.sel.delete(t.id) : S.sel.add(t.id))); S.hlSource = null; renderAll(); };
$('#clearsel').onclick = () => { S.sel.clear(); renderAll(); };
$('#srcs').addEventListener('click', (e) => { const b = e.target.closest('[data-src]'); if (!b) return; applySource([...S.sel], b.dataset.src || null); });
$('#modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) { e.currentTarget.hidden = true; stopPreview(); S.hlSource = null; renderAll(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#modal').hidden = true; stopPreview(); } });
$('#page-guide').addEventListener('click', (e) => {
  const f = e.target.closest('[data-gf]'); if (f) { S.gfilter = f.dataset.gf; renderGuide(); return; }
  const p = e.target.closest('[data-prog]'); if (p) { const [num, start] = p.dataset.prog.split('|').map(Number); openProgram(num, start); }
});
let resizeT, lastMode = layoutMode();
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { const l = layoutMode(); if (l !== lastMode) { lastMode = l; renderMap(); } }, 120); });
const tick = () => { $('#clock').textContent = fmtT(Date.now()); }; tick(); setInterval(tick, 1000);
setInterval(() => { if (halfHourFloor(Date.now()) !== gridStart) { gridStart = halfHourFloor(Date.now()); if (S.tab === 'guide') renderGuide(); } renderBoxes(); }, 60000);

(async () => {
  await api.init();
  let startTab = 'tvs'; try { startTab = localStorage.getItem('hp-tab') || 'tvs'; } catch { /* private mode */ }
  switchTab(startTab);
})();
