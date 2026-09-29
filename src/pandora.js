'use strict';
// Thin client for the Pandora REST API "HDTV" endpoints (the AV-over-IP matrix).
// Spec: https://bma-pandora-api.azurewebsites.net/api-docs/  (tag: HDTV, v2.4.102)
const cfg = require('./config');

class PandoraError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

async function call(method, route, { body, query } = {}) {
  const url = new URL(cfg.pandora.baseUrl.replace(/\/$/, '') + route);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.pandora.timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.pandora.token}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) throw new PandoraError(json.message || `Pandora ${res.status}`, res.status, json);
    return json;
  } finally { clearTimeout(t); }
}

// Pandora takes `ip` for one node or `ips` for a group (unicast to each; 200 only if all succeed).
const target = (ips) => (ips.length === 1 ? { ip: ips[0] } : { ips });
const base = (ips, extra) => ({ transport: cfg.pandora.transport, ...target(ips), ...extra });

module.exports = {
  PandoraError,
  // Put an encoder (a DirecTV box's encoder, a music player, signage) full screen on decoders and
  // open its audio on the same window. Omitting x/y/width/height = full screen.
  putSource: ({ ips, encoder, rtspUrl, audio = true, vol, windowId = 0 }) =>
    call('POST', '/hdtv/source', { body: base(ips, { windowId, ...(encoder ? { encoder } : { rtspUrl }), audio, ...(vol != null ? { vol } : {}) }) }),
  closeAll: ({ ips }) => call('POST', '/hdtv/window/close', { body: base(ips, { all: true }) }),
  setVolume: ({ ips, vol }) => call('POST', '/hdtv/audio/volume', { body: base(ips, { vol }) }),
  closeAudio: ({ ips }) => call('POST', '/hdtv/audio/close', { body: base(ips, {}) }),
  callScene: ({ ips, id, type = 0 }) => call('POST', '/hdtv/scene/call', { body: base(ips, { id, type }) }),
  saveScene: ({ ips, id }) => call('POST', '/hdtv/scene/save', { body: base(ips, { id }) }),
  status: (ip) => call('GET', `/hdtv/status/${ip}`, { query: { transport: cfg.pandora.transport } }),
  reboot: (ip) => call('POST', '/hdtv/reboot', { body: base([ip], {}) }),
  scan: (locationID, method = 'auto') => call('POST', '/hdtv/scan', { body: { locationID, method } }),
  devices: (locationID) => call('GET', `/hdtv/devices/${locationID}`),
};
