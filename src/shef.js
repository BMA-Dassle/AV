'use strict';
// DirecTV SHEF client: "Set-top box HTTP Exported Functionality".
// Reference: DIRECTV SHEF Command Set, DTV-MD-0359 rev 1.3.C (Oct 2011). Port 8080 on the receiver.
// The receiver must have External Device Access set to Allow
// (Menu > Settings > Whole-Home > External Device > Allow).
const cfg = require('./config');

const KEYS = ['power', 'poweron', 'poweroff', 'format', 'pause', 'rew', 'replay', 'stop', 'advance', 'ffwd', 'record',
  'play', 'guide', 'active', 'list', 'exit', 'back', 'menu', 'info', 'up', 'down', 'left', 'right', 'select', 'red', 'green',
  'yellow', 'blue', 'chanup', 'chandown', 'prev', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'dash', 'enter'];

class ShefError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

async function get(ip, route, params = {}) {
  const url = new URL(`http://${ip}:${cfg.shef.port}${route}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.shef.timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    const json = await res.json().catch(() => ({}));
    const code = json?.status?.code ?? res.status;
    if (!res.ok || code !== 200) throw new ShefError(json?.status?.msg || `SHEF ${code}`, code, json);
    return json;
  } finally { clearTimeout(t); }
}

module.exports = {
  KEYS, ShefError,
  // What is on right now: major/minor, callsign, title, episodeTitle, startTime, duration, isRecording...
  getTuned: (ip, clientAddr = '0') => get(ip, '/tv/getTuned', { clientAddr }),
  getProgInfo: (ip, major, minor, clientAddr = '0') => get(ip, '/tv/getProgInfo', { major, minor, clientAddr }),
  // Change channel directly. minor omitted = 65535 (none).
  tune: (ip, major, minor, clientAddr = '0') => get(ip, '/tv/tune', { major, minor, clientAddr }),
  // Simulate a remote key. hold: keyPress (default) | keyDown | keyUp.
  processKey: (ip, key, hold = 'keyPress', clientAddr = '0') => {
    if (!KEYS.includes(String(key))) throw new ShefError(`Unknown key "${key}"`, 400);
    return get(ip, '/remote/processKey', { key, hold, clientAddr });
  },
  getVersion: (ip) => get(ip, '/info/getVersion'),
  getOptions: (ip) => get(ip, '/info/getOptions'),
  mode: (ip, clientAddr = '0') => get(ip, '/info/mode', { clientAddr }),
  // Genie servers (HR34/HR44/HR54) list their mini clients here; each has a clientAddr (MAC hex, no colons).
  getLocations: (ip) => get(ip, '/info/getLocations'),
};
