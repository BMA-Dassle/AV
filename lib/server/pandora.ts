// Thin client for the Pandora REST API "HDTV" endpoints (the AV-over-IP matrix).
// Spec: https://bma-pandora-api.azurewebsites.net/api-docs/  (tag: HDTV)
import { cfg, HttpError, type Encoder } from "./config";

async function call(method: string, route: string, opts: { body?: unknown; query?: Record<string, string | undefined> } = {}) {
  const url = new URL(cfg.pandora.baseUrl.replace(/\/$/, "") + route);
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) if (v != null) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.pandora.timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.pandora.token}` },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) throw new HttpError(json?.message || `Pandora ${res.status}`, res.status, json);
    return json;
  } finally { clearTimeout(t); }
}

const target = (ips: string[]) => (ips.length === 1 ? { ip: ips[0] } : { ips });
const base = (ips: string[], extra: Record<string, unknown>) => ({ transport: cfg.pandora.transport, ...target(ips), ...extra });

export interface PandoraClient {
  putSource(p: { ips: string[]; encoder?: Encoder; rtspUrl?: string; audio?: boolean; vol?: number; windowId?: number; geometry?: { x: number; y: number; width: number; height: number } }): Promise<any>;
  closeAll(p: { ips: string[] }): Promise<any>;
  setVolume(p: { ips: string[]; vol: number }): Promise<any>;
  status(ip: string): Promise<any>;
  // Raw protocol command to one node or a group; the reply is the node's JSON (group: per-node results)
  command(ips: string[], payload: Record<string, unknown>): Promise<any>;
  scan(locationID: string, method?: string): Promise<any>;
  devices(locationID: string): Promise<any>;
  // DirecTV boxes through Pandora (spec: docs/PANDORA-DIRECTV-SPEC.md, sections 4, 8, 10)
  directvBoxes(locationID: string): Promise<any>;
  directvTune(locationID: string, boxId: string, major: number): Promise<any>;
  directvKey(locationID: string, boxId: string, key: string): Promise<any>;
  // Stateless sweep: which of these receivers answer where (Pandora stores nothing)
  directvDiscover(subnets: string[], receivers: { id: string; receiverId: string }[]): Promise<any>;
  // Raw-ip variants: work without a registry (the app knows the addresses from its site file)
  directvTuned(ip: string, clientAddr?: string): Promise<any>;
  directvTuneIp(ip: string, major: number, clientAddr?: string): Promise<any>;
  directvKeyIp(ip: string, key: string, clientAddr?: string): Promise<any>;
  // Projector power through Pandora (stateless, spec section 12)
  projectorPower(ip: string, on: boolean, protocol?: string, port?: number): Promise<any>;
  projectorStatus(ip: string, protocol?: string, port?: number): Promise<any>;
}

export const pandora: PandoraClient = {
  // Put an encoder (a DirecTV box's encoder, music, signage) full screen on decoders and open its audio on the same window.
  putSource: ({ ips, encoder, rtspUrl, audio = true, vol, windowId = 0, geometry }) =>
    call("POST", "/hdtv/source", { body: base(ips, { windowId, ...(encoder ? { encoder } : { rtspUrl }), audio, ...(vol != null ? { vol } : {}), ...(geometry || {}) }) }),
  closeAll: ({ ips }) => call("POST", "/hdtv/window/close", { body: base(ips, { all: true }) }),
  setVolume: ({ ips, vol }) => call("POST", "/hdtv/audio/volume", { body: base(ips, { vol }) }),
  status: (ip) => call("GET", `/hdtv/status/${ip}`, { query: { transport: cfg.pandora.transport } }),
  command: (ips, payload) => call("POST", "/hdtv/command", { body: base(ips, { payload }) }),
  scan: (locationID, method = "auto") => call("POST", "/hdtv/scan", { body: { locationID, method } }),
  devices: (locationID) => call("GET", `/hdtv/devices/${locationID}`),
  directvBoxes: (locationID) => call("GET", `/directv/boxes/${locationID}`),
  directvTune: (locationID, boxId, major) => call("POST", "/directv/tune", { body: { locationID, boxId, major } }),
  directvKey: (locationID, boxId, key) => call("POST", "/directv/key", { body: { locationID, boxId, key, hold: "keyPress" } }),
  directvDiscover: (subnets, receivers) => call("POST", "/directv/discover", { body: { subnets, receivers } }),
  directvTuned: (ip, clientAddr = "0") => call("GET", `/directv/tuned/${ip}`, { query: { clientAddr } }),
  directvTuneIp: (ip, major, clientAddr = "0") => call("POST", "/directv/tune", { body: { ip, major, clientAddr } }),
  directvKeyIp: (ip, key, clientAddr = "0") => call("POST", "/directv/key", { body: { ip, key, hold: "keyPress", clientAddr } }),
  projectorPower: (ip, on, protocol = "optoma", port) => call("POST", "/projector/power", { body: { ip, on, protocol, ...(port ? { port } : {}) } }),
  projectorStatus: (ip, protocol = "optoma", port) => call("GET", `/projector/status/${ip}`, { query: { protocol, port: port ? String(port) : undefined } }),
};
