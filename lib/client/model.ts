// Client-side view model derived from the API snapshot, plus channel/program lookups against the guide.
import type { Snapshot, TunedView, WallView } from "@/lib/server/state";
import type { PlanConfig } from "@/lib/server/config";
import type { Guide, GuideChannel, Program } from "@/lib/server/guide";
import type { Catalog } from "./api";

export type Box = { id: string; name: string; color: string; channel: number | null; tuned: TunedView | null; online: boolean | null; error: string | null; offlineSince: number | null; pending: boolean; preview: string | null; powerControl: boolean };
export type Tv = { id: string; name: string; zone: string; src: string | null; x: number; y: number; error: string | null; display: { kind: string; power: boolean | null } | null; wallId: string | null };
export type Wall = WallView;
export type Other = { id: string; name: string; kind: string };
export type Zone = { id: string; name: string };
export type Model = { site: string; siteSlug: string; zones: Zone[]; tvs: Tv[]; boxes: Box[]; other: Other[]; time: number; plan: PlanConfig; walls: Wall[] };

export function toModel(snap: Snapshot): Model {
  return {
    site: snap.site.shortName, siteSlug: snap.site.slug, time: snap.site.time, zones: snap.zones, plan: snap.site.plan || { panels: [], tile: [120, 70] },
    tvs: snap.tvs.map((t) => ({ id: t.id, name: t.name, zone: t.zone, src: t.sourceId, x: t.map?.[0] ?? 0, y: t.map?.[1] ?? 0, error: t.error, display: t.display ?? null, wallId: t.wallId ?? null })),
    walls: snap.walls || [],
    boxes: snap.boxes.map((b) => ({ id: b.id, name: b.name, color: b.color, channel: b.tuned?.channel ?? null, tuned: b.tuned, online: b.online, error: b.error, offlineSince: b.offlineSince ?? null, pending: Boolean(b.tuned?.pending), preview: b.preview, powerControl: Boolean(b.powerControl) })),
    other: snap.otherSources.map((o) => ({ id: o.id, name: o.name, kind: o.kind ? o.kind[0].toUpperCase() + o.kind.slice(1) : "" })),
  };
}

export const EMPTY: Model = { site: "", siteSlug: "", zones: [], tvs: [], boxes: [], other: [], time: 0, plan: { panels: [], tile: [120, 70] }, walls: [] };

export const boxById = (m: Model, id: string | null | undefined) => m.boxes.find((b) => b.id === id) || null;
export const tvById = (m: Model, id: string) => m.tvs.find((t) => t.id === id) || null;
export const tvsOn = (m: Model, id: string | null) => m.tvs.filter((t) => t.src === id);
export const srcName = (m: Model, id: string | null) => boxById(m, id)?.name || m.other.find((o) => o.id === id)?.name || (id ? id : "Off");
export const srcColor = (m: Model, id: string | null) => boxById(m, id)?.color || (id ? "#98a2b3" : "#323e53");
export const fmtT = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export function since(ms: number | null) { if (!ms) return ""; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }
// Names for a set of screens; a whole video wall reads as its name ("Video Wall 1") instead of six screen names.
export function groupNames(m: Model, ids: string[]): string[] {
  const left = new Set(ids); const out: string[] = [];
  for (const w of m.walls) { const tiles = w.rows.flat(); if (tiles.every((id) => left.has(id))) { out.push(`${w.name} (${tiles.length} screens)`); tiles.forEach((id) => left.delete(id)); } }
  for (const id of ids) if (left.has(id)) out.push(tvById(m, id)?.name || id);
  return out;
}
export function label(m: Model, ids: string[]) { const n = groupNames(m, ids); return n.length <= 3 ? n.join(", ") : `${n.slice(0, 2).join(", ")} +${n.length - 2} more`; }
export const wallById = (m: Model, id: string | null | undefined) => m.walls.find((w) => w.id === id) || null;
export function halfHourFloor(ms: number) { const d = new Date(ms); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); }

// ---- guide lookups ----
export type GuideIndex = { guide: Guide | null; byNum: Map<number, GuideChannel> };
export const indexGuide = (g: Guide | null): GuideIndex => ({ guide: g, byNum: new Map((g?.channels || []).map((c) => [c.num, c])) });

// Station callsigns from the guide carry broadcast suffixes (WZVN-TV, WINK-DT); staff know them without.
export const shortCallsign = (cs: string) => String(cs || "").replace(/-(TV|DT|CD|LD|LP)$/i, "");
export type ChanInfo = { num: number; cs: string; name: string; cat: string; logo?: string | null };
export function chan(gi: GuideIndex, cat: Catalog, num: number | null): ChanInfo {
  if (num == null) return { num: 0, cs: "—", name: "", cat: "other" };
  const g = gi.byNum.get(Number(num)); if (g) return { num: g.num, cs: shortCallsign(g.callsign), name: g.name, cat: g.cat, logo: g.logo };
  const c = cat.all.find((c) => c.num === Number(num)); if (c) return { num: c.num, cs: shortCallsign(c.callsign), name: c.name, cat: c.cat };
  return { num, cs: "CH " + num, name: "Channel " + num, cat: "other" };
}
export function progAt(gi: GuideIndex, num: number | null, t = Date.now()): Program | null {
  if (num == null) return null;
  return gi.byNum.get(Number(num))?.programs.find((p) => p.start <= t && p.end > t) || null;
}
export type NowInfo = { title: string; sub: string; start: number | null; end: number | null };
export function boxNow(gi: GuideIndex, b: Box): NowInfo | null {
  const p = progAt(gi, b.channel);
  if (p) return p.filler ? { title: "Nothing scheduled", sub: "", start: p.start, end: p.end } : { title: p.title, sub: p.subtitle, start: p.start, end: p.end };
  if (b.tuned?.title) return { title: b.tuned.title, sub: b.tuned.episodeTitle || "", start: b.tuned.startTime ? b.tuned.startTime * 1000 : null, end: b.tuned.startTime && b.tuned.duration ? (b.tuned.startTime + b.tuned.duration) * 1000 : null };
  return null;
}
// Pick the box to tune for a channel: one already on it, else a free one, else the one with fewest screens.
export function suggestBox(m: Model, num: number) {
  const on = m.boxes.find((b) => b.channel === num); if (on) return { box: on, reason: "already on it" };
  const free = m.boxes.find((b) => tvsOn(m, b.id).length === 0 && b.online !== false); if (free) return { box: free, reason: "not on any screen" };
  const least = [...m.boxes].sort((a, b) => tvsOn(m, a.id).length - tvsOn(m, b.id).length)[0]; return { box: least, reason: `fewest screens (${tvsOn(m, least.id).length})` };
}
