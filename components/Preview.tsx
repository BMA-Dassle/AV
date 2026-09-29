"use client";
// Box preview direct from the venue LAN with retries; placeholder when unreachable (docs/PREVIEW-GATEWAY.md).
import { useEffect, useRef, useState } from "react";

const MAX = 3, TIMEOUT = 4000, GAP = 1500;

export default function Preview({ url, name }: { url: string | null; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState(`Preview · ${name}`);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(false);
    if (!url) { setTag("No preview gateway configured"); return; }
    let alive = true; let attempt = 0; let timer: ReturnType<typeof setTimeout> | undefined; let el: HTMLVideoElement | HTMLImageElement | null = null;
    const isImg = /mjpeg|\.jpe?g|snapshot/i.test(url);
    const cleanup = () => { clearTimeout(timer); if (el) { try { if (el instanceof HTMLVideoElement) { el.pause(); el.removeAttribute("src"); el.load(); } else el.src = ""; } catch { /* ignore */ } el.remove(); el = null; } };
    const go = () => {
      if (!alive) return;
      attempt++; setTag(`Connecting… ${attempt}/${MAX}`); cleanup();
      let settled = false;
      const ok = () => { if (settled || !alive) return; settled = true; clearTimeout(timer); if (el && host.current) { host.current.appendChild(el); setOn(true); setTag(`Live preview · ${name}`); if (el instanceof HTMLVideoElement) el.play().catch(() => {}); } };
      const fail = () => { if (settled || !alive) return; settled = true; clearTimeout(timer); if (attempt < MAX) timer = setTimeout(go, GAP); else { cleanup(); setOn(false); setTag(`Preview · ${name} · not reachable from this device`); } };
      if (isImg) { const img = new Image(); img.className = "pvmedia"; img.alt = ""; img.onload = ok; img.onerror = fail; img.src = url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(); el = img; }
      else { const v = document.createElement("video"); v.className = "pvmedia"; v.muted = true; v.autoplay = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.addEventListener("loadeddata", ok, { once: true }); v.addEventListener("playing", ok, { once: true }); v.addEventListener("error", fail, { once: true }); v.src = url; v.load(); el = v; }
      timer = setTimeout(fail, TIMEOUT);
    };
    go();
    return () => { alive = false; cleanup(); };
  }, [url, name]);

  return (
    <>
      <div className={`pv ${on ? "on" : ""}`} ref={host} />
      {on && <span className="live"><i />LIVE</span>}<span className="tag">{tag}</span>
    </>
  );
}
