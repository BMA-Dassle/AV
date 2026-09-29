'use strict';
// In-memory model of one location's floor: which source is on each TV, what each DirecTV box is tuned to.
// One instance per site (see createSite). Talks to hardware through the Pandora client (matrix) and the
// SHEF client (boxes); in mock mode both are simulated.
const EventEmitter = require('events');
const cfg = require('./config');
const channels = require('./channels');
const mock = require('./mock');
const realPandora = require('./pandora');
const realShef = require('./shef');

const httpError = (message, status) => Object.assign(new Error(message), { status });

function createSite(site) {
  const events = new EventEmitter();
  events.setMaxListeners(200);

  const tvs = new Map(site.tvs.map((t) => [t.id, { ...t, sourceId: cfg.mock ? mock.SEED_TVS[t.id] ?? null : null, lastChange: null, error: null }]));
  const boxes = new Map(site.boxes.map((b) => [b.id, { ...b, tuned: null, online: null, error: null }]));
  const others = new Map(site.otherSources.map((s) => [s.id, s]));
  const pandora = cfg.mock ? mock.makeMockPandora() : realPandora;
  const mockShef = cfg.mock ? mock.makeMockShef(site.boxes) : null;

  // Direct-from-LAN preview stream for a box: an explicit URL per box, or <gateway>/api/stream.mp4?src=<boxId>
  // when the site has a preview gateway (go2rtc). The page connects to it itself; nothing goes through Pandora.
  function previewUrl(b) {
    if (b.preview) return b.preview;
    const gw = site.site.previewGateway;
    if (gw && !/REPLACE_WITH/.test(gw)) return `${gw.replace(/\/$/, '')}/api/stream.mp4?src=${encodeURIComponent(b.id)}`;
    return null;
  }

  function snapshot() {
    const tvList = [...tvs.values()].map((t) => ({ id: t.id, name: t.name, zone: t.zone, map: t.map, sourceId: t.sourceId, lastChange: t.lastChange, error: t.error, configured: Boolean(t.decoder?.ip) || cfg.mock }));
    const counts = {};
    for (const t of tvList) if (t.sourceId) counts[t.sourceId] = (counts[t.sourceId] || 0) + 1;
    return {
      site: { slug: site.site.slug, name: site.site.name, shortName: site.site.shortName, squareLocationIDs: site.site.squareLocationIDs, timezone: site.site.timezone, mock: cfg.mock, time: Date.now() },
      zones: site.zones,
      tvs: tvList,
      boxes: [...boxes.values()].map((b) => ({ id: b.id, name: b.name, color: b.color, receiverId: b.receiverId || null, online: b.online, error: b.error, tuned: b.tuned, tvCount: counts[b.id] || 0, configured: Boolean(b.shef?.ip) || cfg.mock, preview: previewUrl(b) })),
      otherSources: [...others.values()].map((s) => ({ id: s.id, name: s.name, kind: s.kind, tvCount: counts[s.id] || 0 })),
    };
  }
  const emit = () => events.emit('change', snapshot());

  // ---- Boxes (SHEF) ----
  async function refreshBox(box) {
    try {
      let raw;
      if (cfg.mock) raw = await mockShef.getTuned(box.id);
      else if (!box.shef?.ip) { box.online = null; box.error = 'no SHEF address configured'; return; }
      else raw = await realShef.getTuned(box.shef.ip, box.shef.clientAddr || '0');
      const ch = channels.find(raw.major);
      box.tuned = {
        channel: raw.major, minor: raw.minor === 65535 ? null : raw.minor,
        callsign: raw.callsign || ch?.callsign || '', channelName: ch?.name || raw.callsign || `Channel ${raw.major}`,
        title: raw.title || '', episodeTitle: raw.episodeTitle || '',
        startTime: raw.startTime || null, duration: raw.duration || null, isRecording: Boolean(raw.isRecording), at: Date.now(),
      };
      box.online = true; box.error = null;
    } catch (e) { box.online = false; box.error = e.message; }
  }
  async function refreshAllBoxes() { await Promise.all([...boxes.values()].map(refreshBox)); emit(); }

  async function tuneBox(boxId, channel) {
    const box = boxes.get(boxId);
    if (!box) throw httpError(`Unknown box ${boxId}`, 404);
    const major = Number(channel);
    if (!Number.isInteger(major) || major < 1 || major > 9999) throw httpError('Channel must be 1-9999', 400);
    if (cfg.mock) await mockShef.tune(boxId, major);
    else {
      if (!box.shef?.ip) throw httpError(`${box.name} has no SHEF address configured`, 409);
      await realShef.tune(box.shef.ip, major, undefined, box.shef.clientAddr || '0');
    }
    const ch = channels.find(major);
    box.tuned = { ...(box.tuned || {}), channel: major, callsign: ch?.callsign || '', channelName: ch?.name || `Channel ${major}`, title: '', pending: true };
    emit();
    setTimeout(() => refreshBox(box).then(emit), 1500);
    return { box: box.id, channel: major, affectedTvs: [...tvs.values()].filter((t) => t.sourceId === boxId).map((t) => t.name) };
  }

  async function sendKey(boxId, key) {
    const box = boxes.get(boxId);
    if (!box) throw httpError(`Unknown box ${boxId}`, 404);
    if (cfg.mock) await mockShef.processKey(boxId, key);
    else {
      if (!box.shef?.ip) throw httpError(`${box.name} has no SHEF address configured`, 409);
      await realShef.processKey(box.shef.ip, key, 'keyPress', box.shef.clientAddr || '0');
    }
    setTimeout(() => refreshBox(box).then(emit), 1200);
    return { box: box.id, key };
  }

  // ---- TVs (Pandora HDTV) ----
  function encoderFor(sourceId) {
    const src = boxes.get(sourceId) || others.get(sourceId);
    if (!src) throw httpError(`Unknown source ${sourceId}`, 404);
    const enc = src.encoder;
    if (!cfg.mock && (!enc?.ip || enc?.devid === '')) throw httpError(`${src.name} has no encoder configured`, 409);
    return enc?.ip ? { ip: enc.ip, devid: enc.devid } : { ip: '0.0.0.0', devid: 0 };
  }
  const decoderIp = (t) => t.decoder?.ip || `mock-${t.id}`;

  async function setTvSource(tvIds, sourceId, { audio = true, vol } = {}) {
    const targets = tvIds.map((id) => tvs.get(id)).filter(Boolean);
    if (!targets.length) throw httpError('No TVs given', 400);
    const results = [];
    const ready = targets.filter((t) => cfg.mock || t.decoder?.ip);
    for (const t of targets) if (!ready.includes(t)) { t.error = 'no decoder configured'; results.push({ tv: t.id, ok: false, error: t.error }); }
    if (sourceId === null) {
      if (ready.length) await pandora.closeAll({ ips: ready.map(decoderIp) });
      for (const t of ready) { t.sourceId = null; t.lastChange = Date.now(); t.error = null; results.push({ tv: t.id, ok: true }); }
      emit(); return results;
    }
    const encoder = encoderFor(sourceId);
    if (ready.length) {
      try {
        await pandora.putSource({ ips: ready.map(decoderIp), encoder, audio, vol });
        for (const t of ready) { t.sourceId = sourceId; t.lastChange = Date.now(); t.error = null; results.push({ tv: t.id, ok: true }); }
      } catch (e) {
        const per = e.body?.error?.results;
        for (const t of ready) {
          const r = Array.isArray(per) ? per.find((x) => x.ip === t.decoder?.ip) : null;
          const ok = r ? r.ok : false;
          if (ok) { t.sourceId = sourceId; t.lastChange = Date.now(); t.error = null; } else t.error = r?.error || e.message;
          results.push({ tv: t.id, ok, error: t.error });
        }
      }
    }
    emit(); return results;
  }

  async function tvStatus(tvId) {
    const t = tvs.get(tvId);
    if (!t) throw httpError(`Unknown TV ${tvId}`, 404);
    if (!cfg.mock && !t.decoder?.ip) throw httpError('no decoder configured', 409);
    return pandora.status(decoderIp(t));
  }

  function start() { refreshAllBoxes(); setInterval(refreshAllBoxes, cfg.shef.pollMs).unref(); }

  return { site, events, snapshot, tuneBox, sendKey, setTvSource, tvStatus, refreshAllBoxes, start, pandora };
}

const instances = new Map(cfg.sites.map((s) => [s.site.slug, createSite(s)]));
function forKey(key) { const s = cfg.findSite(key); return s ? instances.get(s.site.slug) : null; }

module.exports = { instances, forKey, startAll: () => instances.forEach((i) => i.start()) };
