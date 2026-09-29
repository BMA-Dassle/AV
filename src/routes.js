'use strict';
const express = require('express');
const crypto = require('crypto');
const cfg = require('./config');
const state = require('./state');
const channels = require('./channels');
const guide = require('./guide');
const shef = require('./shef');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- Auth: Bearer token, or ?token= for EventSource (which cannot set headers) ----
function tokenOk(given) {
  if (!given) return false;
  const g = Buffer.from(given);
  return cfg.auth.tokens.some((t) => { const b = Buffer.from(t); return b.length === g.length && crypto.timingSafeEqual(b, g); });
}
router.get('/health', (req, res) => res.json({ ok: true, mock: cfg.mock, sites: cfg.sites.map((s) => s.site.slug), auth: cfg.auth.required }));
router.use((req, res, next) => {
  if (!cfg.auth.required) return next();
  const h = req.get('authorization') || '';
  const given = h.startsWith('Bearer ') ? h.slice(7).trim() : (req.query.token || '');
  if (tokenOk(String(given))) return next();
  res.status(401).json({ success: false, message: 'Unauthorized: send Authorization: Bearer <token> (or ?token=)' });
});

// ---- Location: ?location=<slug | Square location id>, header x-location, or the first site ----
router.use((req, res, next) => {
  const key = req.query.location || req.get('x-location') || '';
  const site = state.forKey(key);
  if (!site) return res.status(404).json({ success: false, message: `Unknown location "${key}"`, known: cfg.sites.map((s) => ({ slug: s.site.slug, squareLocationIDs: s.site.squareLocationIDs })) });
  res.locals.site = site;
  next();
});
router.get('/locations', (req, res) => res.json(cfg.sites.map((s) => ({ slug: s.site.slug, name: s.site.name, shortName: s.site.shortName, squareLocationIDs: s.site.squareLocationIDs }))));

// ---- Page 1: TVs and sources ----
router.get('/state', (req, res) => res.json(res.locals.site.snapshot()));

router.get('/events', (req, res) => {
  const site = res.locals.site;
  res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.flushHeaders();
  const send = (snap) => res.write(`data: ${JSON.stringify(snap)}\n\n`);
  send(site.snapshot());
  site.events.on('change', send);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); site.events.off('change', send); });
});

router.post('/tvs/source', wrap(async (req, res) => {
  const { tvIds, sourceId, audio, vol } = req.body || {};
  if (!Array.isArray(tvIds) || !tvIds.length) return res.status(400).json({ success: false, message: 'tvIds[] required' });
  const results = await res.locals.site.setTvSource(tvIds, sourceId ?? null, { audio, vol });
  res.json({ success: results.every((r) => r.ok), results });
}));
router.post('/boxes/:id/tune', wrap(async (req, res) => res.json({ success: true, ...(await res.locals.site.tuneBox(req.params.id, req.body?.channel)) })));
router.post('/boxes/:id/key', wrap(async (req, res) => {
  const key = String(req.body?.key || '');
  if (!shef.KEYS.includes(key)) return res.status(400).json({ success: false, message: `key must be one of ${shef.KEYS.join(', ')}` });
  res.json({ success: true, ...(await res.locals.site.sendKey(req.params.id, key)) });
}));
router.post('/boxes/refresh', wrap(async (req, res) => { await res.locals.site.refreshAllBoxes(); res.json({ success: true }); }));

// ---- Page 2: Guide ----
router.get('/channels', (req, res) => res.json({ favorites: channels.favorites(), all: channels.CHANNELS }));
router.get('/guide', wrap(async (req, res) => res.json(await guide.getGuide({ from: req.query.from, hours: req.query.hours || 3, filter: req.query.filter || 'all', lineup: res.locals.site.site.guideLineup, timezone: res.locals.site.site.timezone }))));

// ---- Installer diagnostics ----
router.get('/admin/config', (req, res) => res.json({ site: res.locals.site.site, mock: cfg.mock }));
router.get('/admin/tv/:id/status', wrap(async (req, res) => res.json(await res.locals.site.tvStatus(req.params.id))));
router.post('/admin/scan', wrap(async (req, res) => res.json(await res.locals.site.pandora.scan(res.locals.site.site.site.squareLocationIDs?.[0], req.body?.method || 'auto'))));
router.get('/admin/devices', wrap(async (req, res) => res.json(await res.locals.site.pandora.devices(res.locals.site.site.site.squareLocationIDs?.[0]))));
router.get('/admin/box/:id/shef/:fn', wrap(async (req, res) => {
  const box = res.locals.site.site.boxes.find((b) => b.id === req.params.id);
  if (!box) return res.status(404).json({ success: false, message: 'unknown box' });
  if (cfg.mock) return res.json({ mock: true, note: 'SHEF diagnostics are not simulated' });
  const fns = {
    version: () => shef.getVersion(box.shef.ip), options: () => shef.getOptions(box.shef.ip), locations: () => shef.getLocations(box.shef.ip),
    mode: () => shef.mode(box.shef.ip, box.shef.clientAddr), tuned: () => shef.getTuned(box.shef.ip, box.shef.clientAddr),
  };
  if (!fns[req.params.fn]) return res.status(400).json({ success: false, message: 'fn must be version|options|locations|mode|tuned' });
  res.json(await fns[req.params.fn]());
}));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
  res.status(status).json({ success: false, message: err.message, detail: err.body || undefined });
});

module.exports = router;
