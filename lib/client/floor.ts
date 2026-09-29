// Floor-plan geometry: the venue drawing's coordinate space, zone labels, tile placement and overlap resolution.
import type { Model, Tv } from "./model";

export const MAPW = 1470, MAPH = 2400;
export const ZONE_LABELS: [number, number, string][] = [[487, 1370, "Bar"], [770, 1511, "Patio"], [113, 943, "Pool Tables"], [801, 69, "VIP"], [1087, 701, "Terrace"], [545, 2215, "Lanes"], [1150, 1800, "Neoverse"], [840, 1395, "Shuffly"], [474, 985, "Axe Throwing"]];
const SHORT: [string, string][] = [["Axe Throwing", "Axe"], ["Pool Table", "Pool"], ["Projector", "Proj"], ["Neoverse", "Neo"], ["Terrace", "Terr"], ["Shuffly", "Shuf"], ["Meeting Room", "Meeting"], ["Front Desk", "Desk"]];
const CODE: Record<string, string> = { bar: "B", pool: "PT", axe: "AX", patio: "PA", terrace: "TE", vip: "V", lanes: "PJ", neoverse: "N", shuffly: "SH", other: "" };

export const shortName = (n: string) => { for (const [a, b] of SHORT) if (n.startsWith(a)) return n.replace(a, b); return n; };
export const codeName = (t: Tv) => { const n = t.name.match(/\d+$/); return t.zone === "other" ? (t.id === "meeting" ? "MR" : "FD") : (CODE[t.zone] ?? t.zone.slice(0, 2).toUpperCase()) + (n ? n[0] : ""); };

export type Box2 = { x0: number; y0: number; x1: number; y1: number };
export function zoneBox(m: Model, zid: string): Box2 {
  const l = m.tvs.filter((t) => t.zone === zid); const xs = l.map((t) => t.x), ys = l.map((t) => t.y);
  let x0 = Math.min(...xs) - 90, y0 = Math.min(...ys) - 110, x1 = Math.max(...xs) + 220, y1 = Math.max(...ys) + 160;
  const minW = 720; if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  const minH = (x1 - x0) * 0.55; if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(MAPW, x1), y1: Math.min(MAPH, y1) };
}

export type Placed = { t: Tv; cx: number; cy: number };
// Push overlapping tiles apart along the axis with the smaller overlap.
export function resolveOverlaps(items: Placed[], w: number, h: number, pad: number) {
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

export type LayoutMode = "phone" | "landscape" | "upright";
export const layoutMode = (): LayoutMode => (typeof window === "undefined" ? "landscape" : window.innerWidth < 700 ? "phone" : window.innerWidth > window.innerHeight ? "landscape" : "upright");
