// DirecTV SHEF client: "Set-top box HTTP Exported Functionality" (DTV-MD-0359 rev 1.3.C), port 8080 on the box.
// Only reachable from an on-site host; the Vercel deployment goes through Pandora's /v2/directv/* instead.
import { cfg, HttpError } from "./config";

export const SHEF_KEYS = ["power", "poweron", "poweroff", "format", "pause", "rew", "replay", "stop", "advance", "ffwd", "record",
  "play", "guide", "active", "list", "exit", "back", "menu", "info", "up", "down", "left", "right", "select", "red", "green",
  "yellow", "blue", "chanup", "chandown", "prev", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "dash", "enter"] as const;
export type ShefKey = (typeof SHEF_KEYS)[number];

export type Tuned = { major: number; minor: number; callsign?: string; title?: string; episodeTitle?: string; startTime?: number; duration?: number; isRecording?: boolean; [k: string]: unknown };

async function get(ip: string, route: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`http://${ip}:${cfg.shef.port}${route}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") url.searchParams.set(k, String(v));
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.shef.timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    const json: any = await res.json().catch(() => ({}));
    const code = json?.status?.code ?? res.status;
    if (!res.ok || code !== 200) throw new HttpError(json?.status?.msg || `SHEF ${code}`, code === 403 ? 502 : code, json);
    return json;
  } finally { clearTimeout(t); }
}

export interface ShefClient {
  getTuned(ip: string, clientAddr?: string): Promise<Tuned>;
  tune(ip: string, major: number, minor?: number, clientAddr?: string): Promise<any>;
  processKey(ip: string, key: string, hold?: string, clientAddr?: string): Promise<any>;
  getProgInfo(ip: string, major: number, minor?: number, time?: number, clientAddr?: string): Promise<any>;
  getVersion(ip: string): Promise<any>;
  getOptions(ip: string): Promise<any>;
  mode(ip: string, clientAddr?: string): Promise<any>;
  getLocations(ip: string): Promise<any>;
}

export const shef: ShefClient = {
  getTuned: (ip, clientAddr = "0") => get(ip, "/tv/getTuned", { clientAddr }),
  tune: (ip, major, minor, clientAddr = "0") => get(ip, "/tv/tune", { major, minor, clientAddr }),
  processKey: (ip, key, hold = "keyPress", clientAddr = "0") => {
    if (!(SHEF_KEYS as readonly string[]).includes(key)) throw new HttpError(`Unknown key "${key}"`, 400);
    return get(ip, "/remote/processKey", { key, hold, clientAddr });
  },
  getProgInfo: (ip, major, minor, time, clientAddr = "0") => get(ip, "/tv/getProgInfo", { major, minor, time, clientAddr }),
  getVersion: (ip) => get(ip, "/info/getVersion"),
  getOptions: (ip) => get(ip, "/info/getOptions"),
  mode: (ip, clientAddr = "0") => get(ip, "/info/mode", { clientAddr }),
  getLocations: (ip) => get(ip, "/info/getLocations"),
};
