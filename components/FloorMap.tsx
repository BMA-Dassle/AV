"use client";
import { useEffect, useState } from "react";
import { chan, srcColor, srcName, type Model, type Tv, type GuideIndex } from "@/lib/client/model";
import { centre, codeName, layoutMode, panelOf, resolveOverlaps, shortName, zoneBox, type LayoutMode, type Placed } from "@/lib/client/floor";
import type { Catalog } from "@/lib/client/api";
import type { PlanPanel } from "@/lib/server/config";

type Props = {
  m: Model; gi: GuideIndex; cat: Catalog; sel: Set<string>; hl: string | null; busy: Set<string>;
  zoneZoom: string | null; onToggle: (id: string) => void; onZone: (zone: string | null) => void; onZoneAll: (zone: string) => void;
};

// The panel's background drawing, in plan units.
function PanelImage({ p }: { p: PlanPanel }) {
  if (!p.image || !p.imageBox) return null;
  const [ix, iy, iw, ih] = p.imageBox;
  return <image href={p.image} x={ix} y={iy} width={iw} height={ih} preserveAspectRatio="none" />;
}

// How a panel is drawn on screen: a rotation (landscape only) or plan coordinates as they are.
type View = { viewBox: string; VW: number; VH: number; P: (x: number, y: number) => [number, number]; img: React.ReactNode; rotated: boolean };
function viewFor(p: PlanPanel, landscape: boolean): View {
  const PW = p.x1 - p.x0, PH = p.y1 - p.y0;
  if (landscape && p.rotate === "cw") {
    return { viewBox: `0 0 ${PH} ${PW}`, VW: PH, VH: PW, rotated: true, P: (x, y) => [PH - (y - p.y0), x - p.x0],
      img: <g transform={`matrix(0 1 -1 0 ${PH} 0) translate(${-p.x0} ${-p.y0})`}><PanelImage p={p} /></g> };
  }
  if (landscape && p.rotate === "ccw") {
    return { viewBox: `0 0 ${PH} ${PW}`, VW: PH, VH: PW, rotated: true, P: (x, y) => [y - p.y0, PW - (x - p.x0)],
      img: <g transform={`matrix(0 -1 1 0 0 ${PW}) translate(${-p.x0} ${-p.y0})`}><PanelImage p={p} /></g> };
  }
  return { viewBox: `${p.x0} ${p.y0} ${PW} ${PH}`, VW: PW, VH: PH, rotated: false, P: (x, y) => [x, y], img: <PanelImage p={p} /> };
}

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
  const panels = m.plan.panels;
  const [tw0, th0] = m.plan.tile;

  if (!m.tvs.length) return <div className="card" style={{ padding: 20 }}><b>No screens are set up for this location yet.</b><div className="small">Add them to its site file in config/sites.</div></div>;
  if (!panels.length) return <div className="card" style={{ padding: 20 }}><b>No floor plan for this location yet.</b></div>;

  const csSize = (cs: string, TW: number) => (cs.length <= 4 ? 21 : cs.length <= 6 ? 17 : cs.length <= 8 ? 14 : 12) * (TW / 104);
  const zoneLabels = (items: Placed[], TH: number) => m.zones.map((z) => {
    const its = items.filter((i) => i.t.zone === z.id); if (!its.length) return null;
    const x = its.reduce((s, i) => s + i.cx, 0) / its.length; const y = Math.min(...its.map((i) => i.cy)) - TH / 2 - 12;
    return <text key={z.id} className="zl" x={x} y={y} textAnchor="middle">{z.name}</text>;
  });
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
  const titled = panels.length > 1;

  // ---- tablets and desktops ----
  if (mode !== "phone") {
    const landscape = mode === "landscape";
    const views = panels.map((p) => viewFor(p, landscape));
    // Side by side at equal height: each column's share is its drawn aspect ratio.
    const row = landscape && m.plan.landscape === "row" && panels.length > 1;
    const style: React.CSSProperties = row ? { display: "grid", gridTemplateColumns: views.map((v) => `${(v.VW / v.VH).toFixed(3)}fr`).join(" "), gap: 12, alignItems: "start" } : {};
    return (
      <div className={row ? "" : "panels"} style={style}>
        {panels.map((p, idx) => {
          const v = views[idx];
          const tvs = m.tvs.filter((t) => panelOf(m, t) === p);
          const TW = v.rotated ? Math.round(tw0 * 0.8) : Math.round(tw0 * 0.93);
          const TH = v.rotated ? Math.round(th0 * 0.89) : Math.round(th0 * 0.92);
          const short = TW < 125;
          const items = resolveOverlaps(tvs.map((t) => { const [cx, cy] = v.P(...centre(m, t)); return { t, cx, cy }; }), TW, TH, 14);
          return (
            <div key={p.id} className="panel" style={{ minWidth: 0 }}>
              {titled && <div className="ptl">{p.name || p.id}</div>}
              <div className="mapwrap"><div className="map card">
                <svg viewBox={v.viewBox} preserveAspectRatio="xMidYMid meet" role="group" aria-label={p.name || "Floor map"} style={row ? undefined : { maxWidth: v.VW, margin: "0 auto" }}>
                  {v.img}
                  {zoneLabels(items, TH)}
                  {items.map((i) => tile(i.t, i.cx, i.cy, TW, TH, short))}
                </svg>
              </div></div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- phone: one area zoomed with full-size tiles ----
  if (zoneZoom) {
    const z = m.zones.find((z) => z.id === zoneZoom); const zb = z ? zoneBox(m, z.id) : null;
    if (!z || !zb) return null;
    const { bb, panel } = zb;
    const TW = Math.round(Math.max(170, (bb.x1 - bb.x0) / 5.2)), TH = Math.round(TW * 0.54);
    const items = resolveOverlaps(m.tvs.filter((t) => t.zone === z.id).map((t) => { const [cx, cy] = centre(m, t); return { t, cx, cy }; }), TW, TH, 10);
    items.forEach((i) => { i.cx = Math.max(bb.x0 + TW / 2 + 6, Math.min(bb.x1 - TW / 2 - 6, i.cx)); i.cy = Math.max(bb.y0 + TH / 2 + 6, Math.min(bb.y1 - TH / 2 - 6, i.cy)); });
    const ghosts = m.tvs.filter((t) => { if (t.zone === z.id) return false; const [cx, cy] = centre(m, t); return cx > bb.x0 && cx < bb.x1 && cy > bb.y0 && cy < bb.y1; });
    return (
      <div className="mapwrap">
        <div className="zoomctl">
          <button className="btn outline sm" onClick={() => props.onZone(null)}>‹ Whole floor</button>
          <span className="zname">{z.name}</span>
          <button className="btn outline sm" onClick={() => props.onZoneAll(z.id)}>Select all here</button>
        </div>
        <div className="map card">
          <svg viewBox={`${bb.x0} ${bb.y0} ${bb.x1 - bb.x0} ${bb.y1 - bb.y0}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`${z.name} screens`}>
            <PanelImage p={panel} />
            {ghosts.map((t) => { const [cx, cy] = centre(m, t); return <g key={t.id} className="dot dimmed" style={{ "--c": srcColor(m, t.src) } as React.CSSProperties} transform={`translate(${cx},${cy})`} onClick={() => props.onZone(t.zone)}><circle r={22} /><text>{codeName(t)}</text></g>; })}
            {items.map((i) => tile(i.t, i.cx, i.cy, TW, TH, false))}
          </svg>
        </div>
      </div>
    );
  }

  // ---- phone overview: each panel with colour dots and tappable areas ----
  return (
    <div className="panels">
      {panels.map((p) => {
        const PW = p.x1 - p.x0, PH = p.y1 - p.y0;
        const tvs = m.tvs.filter((t) => panelOf(m, t) === p);
        const zones = m.zones.filter((z) => tvs.some((t) => t.zone === z.id));
        const r = Math.max(30, PW / 40);
        return (
          <div key={p.id} className="panel">
            {titled && <div className="ptl">{p.name || p.id}</div>}
            <div className="mapwrap"><div className="map card">
              <svg viewBox={`${p.x0} ${p.y0} ${PW} ${PH}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor overview: tap an area to zoom in">
                <PanelImage p={p} />
                {zones.map((z) => { const zb = zoneBox(m, z.id); if (!zb) return null; const { bb } = zb; return <rect key={z.id} className="zhit" x={bb.x0} y={bb.y0} width={bb.x1 - bb.x0} height={bb.y1 - bb.y0} onClick={() => props.onZone(z.id)} />; })}
                {tvs.map((t) => { const [cx, cy] = centre(m, t); const isSel = sel.has(t.id); const dim = Boolean(hl && t.src !== hl);
                  return <g key={t.id} className={`dot ${isSel ? "sel" : ""} ${dim ? "dimmed" : ""} ${t.src ? "" : "off"}`} style={{ "--c": srcColor(m, t.src) } as React.CSSProperties} transform={`translate(${cx},${cy}) scale(${r / 30})`} role="button" aria-label={t.name} onClick={() => props.onZone(t.zone)}><circle r={30} /><text>{codeName(t)}</text></g>; })}
                {zones.map((z) => { const its = tvs.filter((t) => t.zone === z.id).map((t) => centre(m, t)); const x = its.reduce((s, c) => s + c[0], 0) / its.length; const y = Math.min(...its.map((c) => c[1])) - r - 14; return <text key={z.id} className="zl big" x={x} y={y} textAnchor="middle" pointerEvents="none">{z.name}</text>; })}
              </svg>
            </div></div>
          </div>
        );
      })}
    </div>
  );
}
