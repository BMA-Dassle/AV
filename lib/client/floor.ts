// Floor-plan geometry: panels in the old controller's coordinate space, tile placement and overlap resolution.
import type { PlanPanel } from "@/lib/server/config";
import type { Model, Tv } from "./model";

const SHORT: [string, string][] = [["Axe Throwing", "Axe"], ["Pool Table", "Pool"], ["Projector", "Proj"], ["Neoverse", "Neo"], ["Terrace", "Terr"], ["Shuffly", "Shuf"], ["Meeting Room", "Meeting"], ["Front Desk", "Desk"]];
const CODE: Record<string, string> = { bar: "B", pool: "PT", axe: "AX", patio: "PA", terrace: "TE", vip: "V", lanes: "PJ", neoverse: "N", shuffly: "SH", nemos: "NM", videowall: "W", videowall2: "W", other: "" };

export const shortName = (n: string) => { for (const [a, b] of SHORT) if (n.startsWith(a)) return n.replace(a, b); return n; };
export const codeName = (t: Tv) => { const n = t.name.match(/\d+$/); return t.zone === "other" ? (t.id === "meeting" ? "MR" : "FD") : (CODE[t.zone] ?? t.zone.slice(0, 2).toUpperCase()) + (n ? n[0] : ""); };

// Tile centre in plan units: tvs[].map is the old button's top-left.
export const centre = (m: Model, t: Tv): [number, number] => [t.x + m.plan.tile[0] / 2, t.y + m.plan.tile[1] / 2];
export function panelOf(m: Model, t: Tv): PlanPanel | null {
  const [cx, cy] = centre(m, t);
  return m.plan.panels.find((p) => cx >= p.x0 && cx <= p.x1 && cy >= p.y0 && cy <= p.y1) || m.plan.panels[0] || null;
}

export type Box2 = { x0: number; y0: number; x1: number; y1: number };
// Crop around one zone's tiles, padded and widened to a sane aspect, clamped to its panel.
export function zoneBox(m: Model, zid: string): { bb: Box2; panel: PlanPanel } | null {
  const l = m.tvs.filter((t) => t.zone === zid); if (!l.length) return null;
  const panel = panelOf(m, l[0]); if (!panel) return null;
  const [tw, th] = m.plan.tile;
  const xs = l.map((t) => t.x), ys = l.map((t) => t.y);
  let x0 = Math.min(...xs) - 90, y0 = Math.min(...ys) - 110, x1 = Math.max(...xs) + tw + 90, y1 = Math.max(...ys) + th + 90;
  const minW = Math.min(720, panel.x1 - panel.x0); if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  const minH = (x1 - x0) * 0.55; if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  return { bb: { x0: Math.max(panel.x0, x0), y0: Math.max(panel.y0, y0), x1: Math.min(panel.x1, x1), y1: Math.min(panel.y1, y1) }, panel };
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
