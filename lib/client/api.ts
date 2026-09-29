"use client";
// Browser-side API access: ?location= and ?token= come from the URL; the token is remembered per device.
import type { Snapshot } from "@/lib/server/state";
import type { Guide } from "@/lib/server/guide";
import type { Channel } from "@/lib/server/channels";

export type Catalog = { favorites: Channel[]; all: Channel[] };
export type LocationInfo = { slug: string; name: string; shortName: string; squareLocationIDs: string[] };

let LOC = "";
let TOKEN = "";
let initialized = false;

export function initClient() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const p = new URLSearchParams(window.location.search);
  LOC = p.get("location") || "";
  TOKEN = p.get("token") || "";
  try { if (TOKEN) localStorage.setItem("hp-token", TOKEN); else TOKEN = localStorage.getItem("hp-token") || ""; } catch { /* private mode */ }
  if (p.has("token")) { p.delete("token"); history.replaceState(null, "", window.location.pathname + (p.toString() ? "?" + p : "") + window.location.hash); }
}
export const currentLocation = () => LOC;
export const hasToken = () => Boolean(TOKEN);

export function apiUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const u = new URL(path, window.location.origin);
  if (LOC) u.searchParams.set("location", LOC);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
  return u.pathname + u.search;
}
const headers = (): Record<string, string> => (TOKEN ? { authorization: "Bearer " + TOKEN } : {});

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

async function getJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const r = await fetch(apiUrl(path, params), { cache: "no-store", headers: headers() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j?.message || `${r.status}`, r.status);
  return j as T;
}
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(apiUrl(path), { method: "POST", headers: { "content-type": "application/json", ...headers() }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.success === false) throw new ApiError(j?.message || `${r.status} ${r.statusText}`, r.status);
  return j as T;
}

export const api = {
  state: () => getJson<Snapshot>("/api/state"),
  locations: () => getJson<LocationInfo[]>("/api/locations"),
  channels: () => getJson<Catalog>("/api/channels"),
  guide: (from: number, hours: number) => getJson<Guide>("/api/guide", { from, hours, filter: "all" }),
  setSource: (tvIds: string[], sourceId: string | null) => postJson<{ success: boolean; results: { tv: string; ok: boolean; error?: string | null }[] }>("/api/tvs/source", { tvIds, sourceId }),
  tune: (boxId: string, channel: number) => postJson<{ affectedTvs: string[] }>(`/api/boxes/${boxId}/tune`, { channel }),
  key: (boxId: string, key: string) => postJson<unknown>(`/api/boxes/${boxId}/key`, { key }),
  recover: (boxId: string, action: "retry" | "wake" | "cycle" | "move", toBoxId?: string) => postJson<{ success: boolean; online?: boolean | null; error?: string | null; to?: string; toName?: string; sameChannel?: boolean; moved?: { tv: string; ok: boolean }[]; simulated?: boolean }>(`/api/boxes/${boxId}/recover`, { action, toBoxId }),
  eventsUrl: () => apiUrl("/api/events", TOKEN ? { token: TOKEN } : {}),
};
