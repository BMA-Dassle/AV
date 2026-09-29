"use client";
// Box preview direct from the venue LAN with retries; placeholder when unreachable (docs/PREVIEW-GATEWAY.md).
// A go2rtc gateway URL (…/api/stream.mp4?src=NAME) is played through go2rtc's own <video-stream> element over
// WebSocket (MSE, then WebRTC), which is the path the encoders' RTSP works with. Any other URL plays in a plain
// <video> (or <img> for MJPEG / snapshots).
import { useEffect, useRef, useState } from "react";

const MAX = 3, TIMEOUT = 12000, GAP = 1500;
const loadedScripts = new Set<string>();

function parseGo2rtc(url: string): { origin: string; name: string } | null {
  try { const u = new URL(url); const m = u.pathname.match(/\/api\/stream\.(mp4|m3u8|mjpeg)$/); const name = u.searchParams.get("src"); return m && name ? { origin: u.origin, name } : null; } catch { return null; }
}
function loadScript(src: string) {
  if (loadedScripts.has(src) || customElements.get("video-stream")) return Promise.resolve();
  return new Promise<void>((resolve, reject) => { const s = document.createElement("script"); s.type = "module"; s.src = src; s.onload = () => { loadedScripts.add(src); resolve(); }; s.onerror = () => reject(new Error("player script")); document.head.appendChild(s); });
}

export default function Preview({ url, name }: { url: string | null; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState(`Preview · ${name}`);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(false);
    if (!url) { setTag("No preview gateway configured"); return; }
    let alive = true; let attempt = 0; let timer: ReturnType<typeof setTimeout> | undefined; let el: HTMLElement | null = null;
    const g = parseGo2rtc(url); const isImg = !g && /mjpeg|\.jpe?g|snapshot/i.test(url);
    const cleanup = () => { clearTimeout(timer); if (el) { try { const v = el instanceof HTMLVideoElement ? el : el.querySelector?.("video"); if (v) { v.pause(); v.removeAttribute("src"); v.load(); } if (el instanceof HTMLImageElement) el.src = ""; } catch { /* ignore */ } el.remove(); el = null; } };
    const go = async () => {
      if (!alive) return;
      attempt++; setTag(`Connecting… ${attempt}/${MAX}`); cleanup();
      let settled = false;
      const ok = () => { if (settled || !alive) return; settled = true; clearTimeout(timer); setOn(true); setTag(`Live preview · ${name}`); };
      const fail = () => { if (settled || !alive) return; settled = true; clearTimeout(timer); if (attempt < MAX) timer = setTimeout(go, GAP); else { cleanup(); setOn(false); setTag(`Preview · ${name} · not reachable from this device`); } };
      timer = setTimeout(fail, TIMEOUT);
      if (g) {
        try { await loadScript(`${g.origin}/video-stream.js`); } catch { fail(); return; }
        if (!alive) return;
        const vs = document.createElement("video-stream") as HTMLElement & { src?: string; mode?: string; background?: boolean };
        vs.className = "pvmedia";
        vs.setAttribute("mode", "mse,webrtc,hls");
        vs.setAttribute("background", "");
        vs.setAttribute("src", `${g.origin.replace(/^http/, "ws")}/api/ws?src=${encodeURIComponent(g.name)}`);
        el = vs; host.current?.appendChild(vs);
        // the element creates its own <video>; first frame = playing
        const watch = () => { const v = vs.querySelector("video"); if (v) { v.muted = true; v.addEventListener("playing", ok, { once: true }); v.addEventListener("error", fail, { once: true }); if (!v.paused && v.readyState >= 2) ok(); } else if (!settled) setTimeout(watch, 200); };
        watch();
      } else if (isImg) {
        const img = new Image(); img.className = "pvmedia"; img.alt = ""; img.onload = () => { host.current?.appendChild(img); ok(); }; img.onerror = fail; img.src = url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(); el = img;
      } else {
        const v = document.createElement("video"); v.className = "pvmedia"; v.muted = true; v.autoplay = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto";
        v.addEventListener("loadeddata", () => { host.current?.appendChild(v); ok(); v.play().catch(() => {}); }, { once: true }); v.addEventListener("error", fail, { once: true }); v.src = url; v.load(); el = v;
      }
    };
    void go();
    return () => { alive = false; cleanup(); };
  }, [url, name]);

  return (
    <>
      <div className={`pv ${on ? "on" : ""}`} ref={host} />
      {on && <span className="live"><i />LIVE</span>}<span className="tag">{tag}</span>
    </>
  );
}
