"use client";
import { useEffect, useState } from "react";
import { chan, srcColor, srcName, type Model, type Tv, type GuideIndex } from "@/lib/client/model";
import { MAPW, MAPH, ZONE_LABELS, codeName, layoutMode, resolveOverlaps, shortName, zoneBox, type LayoutMode, type Placed } from "@/lib/client/floor";
import type { Catalog } from "@/lib/client/api";

const FLOOR = "/brand/floorplan.png";

type Props = {
  m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; hl: string | null; busy: Set<string>;
  zoneZoom: string | null; onToggle: (id: string) => void; onZone: (zone: string | null) => void; onZoneAll: (zone: string) => void;
};

export default function FloorMap(props: Props) {
  const [mode, setMode] = useState<LayoutMode>("landscape");
  useEffect(() => {
    const apply = () => setMode(layoutMode());
    apply();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(t); t = setTimeout(apply, 120); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, []);
  useEffect(() => { if (mode !== "phone" && props.zoneZoom) props.onZone(null); }, [mode, props]);

  const { m, gi, cat, sel, hl, busy, zoneZoom } = props;
  // Zone labels sit just above each zone's cluster of tiles, so tiles never cover them.
  const zoneLabels = (items: Placed[], TH: number) => m.zones.map((z) => {
    const its = items.filter((i) => i.t.zone === z.id); if (!its.length) return null;
    const x = its.reduce((s, i) => s + i.cx, 0) / its.length; const y = Math.min(...its.map((i) => i.cy)) - TH / 2 - 12;
    return <text key={z.id} className="zl" x={x} y={y} textAnchor="middle">{z.name}</text>;
  });
  const csSize = (cs: string, TW: number) => (cs.length <= 4 ? 21 : cs.length <= 6 ? 17 : cs.length <= 8 ? 14 : 12) * (TW / 104);
  const tile = (t: Tv, cx: number, cy: number, TW: number, TH: number, short: boolean) => {
    const b = m.boxes.find((x) => x.id === t.src);
    const cs = b ? (b.channel ? chan(gi, cat, b.channel).cs : b.name) : t.src ? srcName(m, t.src).replace(/ \d+$/, "") : "Off";
    const isSel = sel.has(t.id), isHl = Boolean(hl && t.src === hl), dim = Boolean(hl && t.src !== hl), isBusy = busy.has(t.id);
    return (
      <g key={t.id} className={`mtv ${isSel ? "sel" : ""} ${isHl ? "hl" : ""} ${dim ? "dimmed" : ""} ${t.src ? "" : "off"} ${isBusy ? "busy" : ""}`}
        style={{ "--c": srcColor(m, t.src) } as React.CSSProperties} transform={`translate(${(cx - TW / 2).toFixed(1)},${(cy - TH / 2).toFixed(1)})`}
        tabIndex={0} role="button" aria-pressed={isSel} aria-label={t.name}
        onClick={() => props.onToggle(t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onToggle(t.id); } }}>
        <rect className="b" width={TW} height={TH} />
        <text className="cs" x={TW - 7} y={Math.round(TH * 0.42)} style={{ fontSize: csSize(cs, TW) }}>{isBusy ? "…" : cs}</text>
        <text className="nm" x={7} y={TH - 9}>{short ? shortName(t.name) : t.name}</text>
        {t.display?.kind === "projector" && t.display.power === false && <text x={TW - 7} y={TH - 9} textAnchor="end" style={{ fontSize: 11, fill: "#f87171", fontWeight: 700 }}>PWR OFF</text>}
        <g className="chk" transform="translate(5,5)"><circle r={9} cx={9} cy={9} fill="#3b82f6" /><path d="M4.5 9.5l3 3L13.5 6.5" stroke="#fff" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
      </g>
    );
  };

  if (mode === "landscape") {
    // Rotate the plan 90° clockwise: lanes on the left, Neoverse at the bottom, VIP top-right. Tiles stay upright.
    const P = (x: number, y: number): [number, number] => [MAPH - y, x]; const TW = 104, TH = 62;
    const items = resolveOverlaps(m.tvs.map((t) => { const [cx, cy] = P(t.x + 65, t.y + 35); return { t, cx, cy }; }), TW, TH, 14);
    return (
      <div className="mapwrap"><div className="map card">
        <svg viewBox={`0 0 ${MAPH} ${MAPW}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor map">
          <image href={FLOOR} x={0} y={0} width={MAPW} height={MAPH} preserveAspectRatio="none" transform={`matrix(0 1 -1 0 ${MAPH} 0)`} />
          {zoneLabels(items, TH)}
          {items.map((i) => tile(i.t, i.cx, i.cy, TW, TH, true))}
        </svg>
      </div></div>
    );
  }
  if (mode === "upright") {
    return (
      <div className="mapwrap"><div className="map card">
        <svg viewBox={`0 0 ${MAPW} ${MAPH}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor map">
          <image href={FLOOR} x={0} y={0} width={MAPW} height={MAPH} preserveAspectRatio="none" />
          {zoneLabels(m.tvs.map((t) => ({ t, cx: t.x + 65, cy: t.y + 35 })), 70)}
          {m.tvs.map((t) => tile(t, t.x + 65, t.y + 35, 130, 70, false))}
        </svg>
      </div></div>
    );
  }
  // phone: overview with area hit targets, or one area zoomed
  if (zoneZoom) {
    const z = m.zones.find((z) => z.id === zoneZoom);
    if (!z) return null;
    const bb = zoneBox(m, z.id); const TW = Math.round(Math.max(170, (bb.x1 - bb.x0) / 5.2)), TH = Math.round(TW * 0.54);
    const items = resolveOverlaps(m.tvs.filter((t) => t.zone === z.id).map((t) => ({ t, cx: t.x + 65, cy: t.y + 35 })), TW, TH, 10);
    items.forEach((i) => { i.cx = Math.max(bb.x0 + TW / 2 + 6, Math.min(bb.x1 - TW / 2 - 6, i.cx)); i.cy = Math.max(bb.y0 + TH / 2 + 6, Math.min(bb.y1 - TH / 2 - 6, i.cy)); });
    const ghosts = m.tvs.filter((t) => t.zone !== z.id && t.x + 65 > bb.x0 && t.x + 65 < bb.x1 && t.y + 35 > bb.y0 && t.y + 35 < bb.y1);
    return (
      <div className="mapwrap">
        <div className="zoomctl">
          <button className="btn outline sm" onClick={() => props.onZone(null)}>‹ Whole floor</button>
          <span className="zname">{z.name}</span>
          <button className="btn outline sm" onClick={() => props.onZoneAll(z.id)}>Select all here</button>
        </div>
        <div className="map card">
          <svg viewBox={`${bb.x0} ${bb.y0} ${bb.x1 - bb.x0} ${bb.y1 - bb.y0}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`${z.name} screens`}>
            <image href={FLOOR} x={0} y={0} width={MAPW} height={MAPH} preserveAspectRatio="none" />
            {ghosts.map((t) => <g key={t.id} className="dot dimmed" style={{ "--c": srcColor(m, t.src) } as React.CSSProperties} transform={`translate(${t.x + 65},${t.y + 35})`} onClick={() => props.onZone(t.zone)}><circle r={22} /><text>{codeName(t)}</text></g>)}
            {items.map((i) => tile(i.t, i.cx, i.cy, TW, TH, false))}
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div className="mapwrap"><div className="map card">
      <svg viewBox={`0 0 ${MAPW} ${MAPH}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor map overview: tap an area to zoom in">
        <image href={FLOOR} x={0} y={0} width={MAPW} height={MAPH} preserveAspectRatio="none" />
        {m.zones.filter((z) => m.tvs.some((t) => t.zone === z.id)).map((z) => { const bb = zoneBox(m, z.id); return <rect key={z.id} className="zhit" x={bb.x0} y={bb.y0} width={bb.x1 - bb.x0} height={bb.y1 - bb.y0} onClick={() => props.onZone(z.id)} />; })}
        {ZONE_LABELS.map(([x, y, l]) => <text key={l} className="zl big" x={x + 64} y={y + 30} textAnchor="middle" pointerEvents="none">{l}</text>)}
        {m.tvs.map((t) => { const isSel = sel.has(t.id); const dim = Boolean(hl && t.src !== hl);
          return <g key={t.id} className={`dot ${isSel ? "sel" : ""} ${dim ? "dimmed" : ""} ${t.src ? "" : "off"}`} style={{ "--c": srcColor(m, t.src) } as React.CSSProperties} transform={`translate(${t.x + 65},${t.y + 35})`} role="button" aria-label={t.name} onClick={() => props.onZone(t.zone)}><circle r={30} /><text>{codeName(t)}</text></g>; })}
      </svg>
    </div></div>
  );
}
