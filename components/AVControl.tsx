"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, currentLocation, initClient, type Catalog, type LocationInfo } from "@/lib/client/api";
import { EMPTY, boxById, chan, halfHourFloor, indexGuide, label, srcName, toModel, tvsOn, type GuideIndex, type Model } from "@/lib/client/model";
import type { GuideChannel, Program } from "@/lib/server/guide";
import { ToastProvider, useToast } from "./Toasts";
import BoxesStrip from "./BoxesStrip";
import FloorMap from "./FloorMap";
import SelectionBar from "./SelectionBar";
import BoxDialog from "./BoxDialog";
import { GuideGrid, ProgramDialog } from "./GuidePage";
import { OfflineBanner } from "./Recovery";
import WallDialog from "./WallDialog";

export default function AVControl() { return <ToastProvider><App /></ToastProvider>; }

function App() {
  const toast = useToast();
  const [m, setM] = useState<Model>(EMPTY);
  const [status, setStatus] = useState<"loading" | "ok" | "unauthorized" | "badlocation" | "down">("loading");
  const [liveDot, setLiveDot] = useState(true);
  const [cat, setCat] = useState<Catalog>({ favorites: [], all: [] });
  const [locs, setLocs] = useState<LocationInfo[]>([]);
  const [gi, setGi] = useState<GuideIndex>(indexGuide(null));
  const [gridStart, setGridStart] = useState(() => halfHourFloor(Date.now()));
  const [tab, setTab] = useState<"tvs" | "guide">("tvs");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hl, setHl] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [zoneZoom, setZoneZoom] = useState<string | null>(null);
  const [openBox, setOpenBox] = useState<string | null>(null);
  const [openProg, setOpenProg] = useState<{ c: GuideChannel; p: Program } | null>(null);
  const [clock, setClock] = useState("");
  const mRef = useRef(m); mRef.current = m;

  const applySnap = useCallback((snap: Parameters<typeof toModel>[0]) => { setM(toModel(snap)); setBusy(new Set()); setLiveDot(true); }, []);

  const loadGuide = useCallback(async () => {
    const gs = halfHourFloor(Date.now()); setGridStart(gs);
    try { setGi(indexGuide(await api.guide(gs - 3600000, 13))); } catch (e: any) { toast(<>Guide data unavailable: {e?.message}</>, "error"); }
  }, [toast]);

  // boot: state, catalog, locations, live updates, guide
  useEffect(() => {
    initClient();
    let es: EventSource | null = null; let poll: ReturnType<typeof setInterval> | null = null; let alive = true;
    // Polling fallback when server-sent events are unavailable (serverless hosts): fast enough to feel live.
    const POLL_MS = 3000;
    const startPolling = () => { if (poll) return; poll = setInterval(async () => { try { applySnap(await api.state()); } catch { setLiveDot(false); } }, POLL_MS); };
    // Boot keeps retrying: a cold start or a deploy switch can fail the first request, and a tablet on the bar
    // should come back by itself instead of sitting on an error until someone reloads it.
    let retry: ReturnType<typeof setTimeout> | undefined;
    const boot = async () => {
      if (!alive) return;
      try {
        applySnap(await api.state());
        setStatus("ok");
        api.channels().then(setCat).catch(() => {});
        api.locations().then(setLocs).catch(() => {});
        try {
          es = new EventSource(api.eventsUrl());
          es.onmessage = (e) => { if (alive) applySnap(JSON.parse(e.data)); };
          es.onerror = () => { setLiveDot(false); if (es?.readyState === EventSource.CLOSED) startPolling(); };
          setTimeout(() => { if (es && es.readyState !== EventSource.OPEN) startPolling(); }, 8000);
        } catch { startPolling(); }
        await loadGuide();
      } catch (e: any) {
        const st = e?.status === 401 ? "unauthorized" : e?.status === 404 ? "badlocation" : "down";
        setStatus(st);
        if (st === "down") retry = setTimeout(boot, 4000);
      }
    };
    void boot();
    const g = setInterval(loadGuide, 10 * 60000);
    const t = setInterval(() => { setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })); const gs = halfHourFloor(Date.now()); setGridStart((cur) => (cur === gs ? cur : gs)); }, 1000);
    try { const saved = localStorage.getItem("hp-tab"); if (saved === "guide") setTab("guide"); } catch { /* private mode */ }
    return () => { alive = false; clearTimeout(retry); es?.close(); if (poll) clearInterval(poll); clearInterval(g); clearInterval(t); };
  }, [applySnap, loadGuide]);

  const switchTab = (t: "tvs" | "guide") => { setTab(t); try { localStorage.setItem("hp-tab", t); } catch { /* private mode */ } };
  const toggleTv = (id: string) => { setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); setHl(null); };
  const zoneAll = (zone: string) => { const list = mRef.current.tvs.filter((t) => t.zone === zone); setSel((s) => { const all = list.every((t) => s.has(t.id)); const n = new Set(s); list.forEach((t) => (all ? n.delete(t.id) : n.add(t.id))); return n; }); setHl(null); };

  const applySource = async (ids: string[], src: string | null) => {
    setBusy(new Set(ids)); setSel(new Set()); setHl(null);
    try {
      const r = await api.setSource(ids, src);
      const failed = (r.results || []).filter((x) => !x.ok);
      const b = boxById(mRef.current, src); const what = b ? <><b>{b.channel ? chan(gi, cat, b.channel).cs : b.name}</b> ({b.name})</> : <b>{srcName(mRef.current, src)}</b>;
      if (failed.length) toast(<>{failed.map((f) => mRef.current.tvs.find((t) => t.id === f.tv)?.name || f.tv).join(", ")} did not switch: {failed[0].error || "error"}</>, "error");
      else toast(<>{label(mRef.current, ids)} → {what}</>);
    } catch (e: any) { setBusy(new Set()); toast(<>Could not switch: {e?.message}</>, "error"); }
    try { applySnap(await api.state()); } catch { /* SSE will catch up */ }
  };
  const tuneBox = async (boxId: string, num: number) => {
    const b = boxById(mRef.current, boxId); if (!b) return; const affected = tvsOn(mRef.current, boxId).length;
    try {
      await api.tune(boxId, num);
      toast(<>{b.name} tuned to <b>{chan(gi, cat, num).cs} {num}</b>{affected ? ` · ${affected} screen${affected > 1 ? "s" : ""} changed` : ""}</>, "info");
    } catch (e: any) { toast(<>{b.name}: {e?.message}</>, "error"); }
    try { applySnap(await api.state()); } catch { /* SSE will catch up */ }
  };
  // Star / unstar a channel for this venue; the list updates at once and is saved for every tablet.
  const setFavorite = async (num: number, on: boolean) => {
    setCat((c) => { const nums = c.favoriteNums || c.favorites.map((x) => x.num); const next = on ? (nums.includes(num) ? nums : [...nums, num]) : nums.filter((n) => n !== num); return { ...c, favoriteNums: next }; });
    try { setCat(await api.setFavorite(num, on)); } catch (e: any) { toast(<>Could not save favorites: {e?.message}</>, "error"); api.channels().then(setCat).catch(() => {}); }
  };
  const sendKey = async (boxId: string, key: string) => {
    const b = boxById(mRef.current, boxId); if (!b) return;
    try { await api.key(boxId, key); } catch (e: any) { toast(<>{b.name}: {e?.message}</>, "error"); }
  };
  const setPower = async (ids: string[], on: boolean) => {
    try {
      const r = await api.power(ids, on);
      const failed = (r.results || []).filter((x) => !x.ok);
      if (failed.length) toast(<>{failed.map((f) => mRef.current.tvs.find((t) => t.id === f.tv)?.name || f.tv).join(", ")} did not respond: {failed[0].error || "error"}</>, "error");
      else toast(<>{ids.length} projector{ids.length > 1 ? "s" : ""} {on ? "powering on (about 10 s to a picture)" : "powering off"}.</>, "info");
    } catch (e: any) { toast(<>Power: {e?.message}</>, "error"); }
    try { applySnap(await api.state()); } catch { /* SSE will catch up */ }
  };
  // ---- video walls ----
  const [wallPick, setWallPick] = useState<string | null>(null);
  const setWallMode = async (wallId: string, mode: "wall" | "screens", sourceId?: string | null) => {
    const w = mRef.current.walls.find((x) => x.id === wallId); if (!w) return;
    toast(<>{w.name}: {mode === "wall" ? "switching to one picture…" : "splitting into separate screens…"}</>, "info");
    try {
      const r = await api.wallMode(wallId, mode, sourceId);
      const b = boxById(mRef.current, r.sourceId);
      toast(mode === "wall" ? <>{w.name} now shows <b>{b ? (b.channel ? chan(gi, cat, b.channel).cs : b.name) : srcName(mRef.current, r.sourceId)}</b> across all {w.rows.flat().length} screens.</> : <>{w.name} is now {w.rows.flat().length} separate screens, each still on its picture. Tap a screen to change it.</>);
    } catch (e: any) { toast(<>{w.name}: {e?.message}</>, "error"); }
    try { applySnap(await api.state()); } catch { /* SSE will catch up */ }
  };
  const onWallMode = (wallId: string, mode: "wall" | "screens") => { if (mode === "wall") setWallPick(wallId); else void setWallMode(wallId, "screens"); };
  const onWallSelect = (wallId: string) => {
    const w = mRef.current.walls.find((x) => x.id === wallId); if (!w) return;
    const tiles = w.rows.flat();
    setSel((s) => { const all = tiles.every((id) => s.has(id)); const n = new Set(s); tiles.forEach((id) => (all ? n.delete(id) : n.add(id))); return n; }); setHl(null);
  };
  const onBoxCard = (id: string) => { if (sel.size) void applySource([...sel], id); else { setHl(id); setOpenBox(id); } };
  const recover = async (boxId: string, action: "retry" | "wake" | "cycle" | "move", toBoxId?: string) => {
    const b = boxById(mRef.current, boxId); if (!b) return;
    try {
      const r = await api.recover(boxId, action, toBoxId);
      if (action === "retry") toast(r.online ? <>{b.name} is answering again.</> : <>{b.name} still not responding{r.error ? `: ${r.error}` : ""}.</>, r.online ? "success" : "error");
      else if (action === "wake") toast(<>Power-on sent to {b.name}. Checking again in a few seconds.</>, "info");
      else if (action === "cycle") toast(<>{b.name} is power cycling{r.simulated ? " (simulated)" : ""}. It takes about a minute to come back.</>, "info");
      else if (action === "move") { const failed = (r.moved || []).filter((x) => !x.ok).length; toast(failed ? <>Moved to {r.toName}, but {failed} screen{failed > 1 ? "s" : ""} did not switch.</> : <>Screens moved to <b>{r.toName}</b>{r.sameChannel ? " (same channel, nobody notices)" : ""}.</>, failed ? "error" : "success"); }
    } catch (e: any) { toast(<>{b.name}: {e?.message}</>, "error"); }
    try { applySnap(await api.state()); } catch { /* SSE will catch up */ }
  };

  if (status === "unauthorized") return <Shell clock={clock} tab={tab} onTab={switchTab} locs={locs} m={m} liveDot={false}><div className="alert warn" style={{ marginTop: 20 }}><span className="ico">⚠</span><div><b>Sign-in required.</b> Open this page with the link that includes the access token.</div></div></Shell>;
  if (status === "badlocation") return <Shell clock={clock} tab={tab} onTab={switchTab} locs={locs} m={m} liveDot={false}><div className="alert warn" style={{ marginTop: 20 }}><span className="ico">⚠</span><div><b>Unknown location.</b> Check the location in the address bar.</div></div></Shell>;
  if (status === "down") return <Shell clock={clock} tab={tab} onTab={switchTab} locs={locs} m={m} liveDot={false}><div className="alert warn" style={{ marginTop: 20 }}><span className="ico">⚠</span><div><b>Can't reach the control service.</b> Reconnecting automatically…</div></div></Shell>;

  const openBoxObj = openBox ? boxById(m, openBox) : null;
  return (
    <Shell clock={clock} tab={tab} onTab={switchTab} locs={locs} m={m} liveDot={liveDot}>
      {tab === "tvs" ? (
        <section className="page">
          <div className="ptitle"><h1>TV Control</h1><span className="sub">{m.site ? `${m.site} · ${m.tvs.length} screens · ${m.boxes.length} DirecTV boxes` : "Loading…"}</span></div>
          <div className="sec"><h2>On the boxes right now</h2><span className="hint">{sel.size ? `Tap a box to show it on the ${sel.size} selected screen${sel.size > 1 ? "s" : ""}` : "Tap a box to change its channel"}</span></div>
          <OfflineBanner m={m} onOpen={(id) => { setHl(id); setOpenBox(id); }} onRecover={recover} />
          <BoxesStrip m={m} gi={gi} cat={cat} armed={sel.size > 0} hl={hl} onBox={onBoxCard} />
          <div className="sec"><h2>Floor plan</h2><span className="hint">Tap screens on the plan, then pick what they show</span></div>
          <FloorMap m={m} gi={gi} cat={cat} sel={sel} hl={hl} busy={busy} zoneZoom={zoneZoom} onToggle={toggleTv} onZone={setZoneZoom} onZoneAll={zoneAll} onWallMode={onWallMode} onWallSelect={onWallSelect} />
          <div className="foot"><span>Boxes: DirecTV SHEF <code>/tv/getTuned</code> every 10 s</span><span>Screens: Pandora <code>POST /hdtv/source</code></span></div>
        </section>
      ) : (
        <section className="page">
          <div className="ptitle"><h1>What&apos;s On</h1><span className="sub">Find a game, then put it on screens</span></div>
          <GuideGrid m={m} gi={gi} cat={cat} sel={sel} gridStart={gridStart} onProgram={(c, p) => setOpenProg({ c, p })} />
        </section>
      )}
      {sel.size > 0 && <style>{`main{padding-bottom:calc(58vh + env(safe-area-inset-bottom,0px))!important}`}</style>}
      <SelectionBar m={m} gi={gi} cat={cat} sel={sel} onClear={() => setSel(new Set())} onPick={(src) => void applySource([...sel], src)} onPower={(ids, on) => void setPower(ids, on)} />
      {openBoxObj && <BoxDialog m={m} gi={gi} cat={cat} box={openBoxObj} live={!m.site || true} onClose={() => { setOpenBox(null); setHl(null); }} onRecover={recover}
        onFav={(num, on) => void setFavorite(num, on)} onTune={async (num) => { await tuneBox(openBoxObj.id, num); }} onKey={async (k) => { await sendKey(openBoxObj.id, k); }} />}
      {wallPick && (() => { const w = m.walls.find((x) => x.id === wallPick); return w ? <WallDialog m={m} gi={gi} cat={cat} wall={w} onClose={() => setWallPick(null)} onConfirm={(src) => { setWallPick(null); void setWallMode(w.id, "wall", src); }} /> : null; })()}
      {openProg && <ProgramDialog m={m} gi={gi} cat={cat} sel={sel} c={openProg.c} p={openProg.p} onClose={() => setOpenProg(null)} onTuneBox={tuneBox} onSend={applySource}
        onPick={(boxName, title) => { switchTab("tvs"); toast(<>Tap the screens that should show <b>{title}</b>, then pick <b>{boxName}</b> in the bar below.</>, "info"); }} />}
    </Shell>
  );
}

function Shell({ children, clock, tab, onTab, locs, m, liveDot }: { children: React.ReactNode; clock: string; tab: "tvs" | "guide"; onTab: (t: "tvs" | "guide") => void; locs: LocationInfo[]; m: Model; liveDot: boolean }) {
  const loc = currentLocation();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const q = window.matchMedia("(max-width: 640px)"); const f = () => setNarrow(q.matches); f(); q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, []);
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <div className="app">
        <header className="hdr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/headpinz-logo-520.png" alt="HeadPinz" />
          <span className="sep" />
          <div className="crumb"><span className="pre">Operations</span><span className="pre">/</span><b>AV Control</b></div>
          <div className="grow" />
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "tvs"} onClick={() => onTab("tvs")}>TVs</button>
            <button role="tab" aria-selected={tab === "guide"} onClick={() => onTab("guide")}>Guide</button>
          </div>
          {locs.length > 1 ? (
            <select className="loc" aria-label="Location" value={locs.find((l) => l.slug === loc || l.squareLocationIDs.includes(loc))?.slug || m.siteSlug} onChange={(e) => { const u = new URL(window.location.href); u.searchParams.set("location", e.target.value); window.location.href = u.toString(); }}>
              {locs.map((l) => <option key={l.slug} value={l.slug}>{narrow ? l.shortName : l.name}</option>)}
            </select>
          ) : (
            <span className="loc">{m.site || "…"}</span>
          )}
          <div className="live"><i className={liveDot ? "" : "off"} /><span className="num">{clock}</span></div>
        </header>
        <main>{children}</main>
      </div>
    </>
  );
}
