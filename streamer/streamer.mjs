#!/usr/bin/env node
// Web page -> RTSP streamer for the AV-over-IP receivers.
//
// Renders a web page (default https://headpinz.com) in headless Chrome/Edge at 1920x1080, encodes it to H.264 with
// ffmpeg and serves it over RTSP (MediaMTX) on this PC:  rtsp://<this-pc>:8554/headpinz
// A receiver shows it through Pandora POST /hdtv/source { ip, rtspUrl } (window type 2), or from the AV Control app
// once the site file's "web" source has this url.
//
//   npm install && npm run setup        (once: puppeteer-core, ffmpeg, MediaMTX)
//   npm start                           (or: node streamer.mjs --url=https://headpinz.com --fps=30)
//
// Settings: command-line --name=value or STREAM_NAME environment variables. See README.md.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import ffmpegPath from "ffmpeg-static";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k.toLowerCase(), v.length ? v.join("=") : "1"]; }));
// environment variables carry a STREAM_ prefix (STREAM_URL, STREAM_FPS...) so they never collide with PATH & co.
const opt = (name, def) => argv[name] ?? process.env["STREAM_" + name.toUpperCase().replace(/-/g, "_")] ?? def;

const C = {
  urls: String(opt("url", "https://headpinz.com")).split(",").map((s) => s.trim()).filter(Boolean),
  rotateSec: Number(opt("rotate-sec", 0)),          // >0: cycle through the urls
  reloadMin: Number(opt("reload-min", 30)),         // reload the page this often (fresh content, recover from errors)
  scrollPxPerSec: Number(opt("scroll", 0)),         // >0: slowly scroll the page and loop back to the top
  width: Number(opt("width", 1920)), height: Number(opt("height", 1080)),
  fps: Number(opt("fps", 30)),                          // 60 for smoother scrolling/video (more CPU)
  scale: Number(opt("scale", 0)),                        // CSS pixel ratio; 0 = auto (2 at 4K so the page is laid out like 1080p)
  quality: Number(opt("quality", 95)),                   // JPEG quality of captured frames before encoding
  preset: String(opt("preset", "veryfast")),             // x264/x265 preset: veryfast (default, real time on modest PCs) .. medium (sharper, more CPU)
  bitrate: String(opt("bitrate", "8M")),               // 8 Mbps keeps small text crisp at 1080p; 4K: ~20M with h265
  codec: String(opt("codec", "h264")),              // h264 | h265
  profile: String(opt("profile", "high")),          // h264 profile: baseline | main | high
  audio: opt("audio", "0") === "1",                 // add a silent AAC track (some receivers want one)
  streamPath: String(opt("name", "headpinz")).replace(/[^\w.-]/g, ""),   // rtsp://<pc>:8554/<name>
  rtspPort: Number(opt("rtsp-port", 8554)),
  statusPort: Number(opt("status-port", 8090)),
  push: String(opt("push", "")),                    // push to an existing RTSP server instead of the bundled MediaMTX
  browser: String(opt("browser", "")),              // path to chrome/msedge/chromium; auto-detected when empty
  css: String(opt("css", "")),                      // extra CSS, e.g. to hide a cookie banner: ".cookie{display:none!important}"
};
if (!C.scale) C.scale = C.width >= 3000 ? 2 : 1;
const target = C.push || `rtsp://127.0.0.1:${C.rtspPort}/${C.streamPath}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- state shared with the status page ----------
const S = { started: Date.now(), url: C.urls[0], urlIndex: 0, lastFrame: null, lastFrameAt: 0, framesIn: 0, framesOut: 0, ffmpeg: "starting", browser: "starting", mediamtx: C.push ? "external" : "starting", restarts: { ffmpeg: 0, browser: 0, mediamtx: 0 }, lastError: "" };

// ---------- MediaMTX (RTSP server) ----------
function mediamtxBin() {
  const exe = process.platform === "win32" ? "mediamtx.exe" : "mediamtx";
  const p = path.join(here, "bin", exe);
  return existsSync(p) ? p : null;
}
let mtx = null;
function startMediamtx() {
  if (C.push) return;
  const bin = mediamtxBin();
  if (!bin) { console.error("MediaMTX not found in streamer/bin. Run: npm run setup"); process.exit(1); }
  mtx = spawn(bin, [path.join(here, "mediamtx.yml")], { cwd: here, env: { ...process.env, MTX_RTSPADDRESS: `:${C.rtspPort}` } });
  S.mediamtx = "running";
  const pipe = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => { if (!/\bDEB\b/.test(l)) log("[rtsp]", l.replace(/^\S+ \S+ /, "")); });
  mtx.stdout.on("data", pipe); mtx.stderr.on("data", pipe);
  mtx.on("exit", (code) => { S.mediamtx = `exited (${code})`; S.restarts.mediamtx++; log("[rtsp] MediaMTX exited", code, "- restarting in 2 s"); setTimeout(startMediamtx, 2000); });
}

// ---------- ffmpeg (JPEG frames in, H.264/H.265 RTSP out) ----------
let ff = null; let ffReady = false;
function ffmpegArgs() {
  const bps = C.bitrate; const n = Number(String(bps).replace(/[^\d.]/g, "")) * (/m/i.test(bps) ? 1e6 : /k/i.test(bps) ? 1e3 : 1);
  const v = C.codec === "h265"
    ? ["-c:v", "libx265", "-preset", C.preset, "-tune", "zerolatency", "-x265-params", `keyint=${C.fps}:min-keyint=${C.fps}:bframes=0:repeat-headers=1:log-level=error`]
    : ["-c:v", "libx264", "-preset", C.preset, "-tune", "zerolatency", "-profile:v", C.profile, "-level", C.width * C.height > 2073600 || C.fps > 30 ? "5.1" : "4.1", "-bf", "0", "-x264-params", "repeat-headers=1"];
  return [
    "-hide_banner", "-loglevel", "warning",
    "-f", "image2pipe", "-framerate", String(C.fps), "-c:v", "mjpeg", "-i", "-",
    ...(C.audio ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : []),
    "-map", "0:v", ...(C.audio ? ["-map", "1:a", "-c:a", "aac", "-b:a", "96k"] : []),
    "-vf", `scale=${C.width}:${C.height}:flags=bicubic:in_range=pc:out_range=tv,format=yuv420p`, "-r", String(C.fps),
    ...v,
    "-g", String(C.fps), "-keyint_min", String(C.fps), "-sc_threshold", "0",
    "-b:v", String(bps), "-maxrate", String(bps), "-bufsize", String(Math.round(n * 2)),
    "-f", "rtsp", "-rtsp_transport", "tcp", target,
  ];
}
function startFfmpeg() {
  ff = spawn(ffmpegPath, ffmpegArgs(), { stdio: ["pipe", "ignore", "pipe"] }); clock0 = 0;
  ffReady = true; S.ffmpeg = "running";
  ff.stdin.on("error", () => { ffReady = false; });
  ff.stderr.on("data", (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => { S.lastError = l; log("[ffmpeg]", l); }));
  ff.on("exit", (code) => { ffReady = false; S.ffmpeg = `exited (${code})`; S.restarts.ffmpeg++; log("[ffmpeg] exited", code, "- restarting in 2 s"); setTimeout(startFfmpeg, 2000); });
}
// Constant frame rate locked to the wall clock: repeat the latest frame (the browser only paints on change) and
// write however many frames the elapsed time calls for. A plain 33 ms timer runs slow on Windows (~16 ms ticks),
// which made the stream clock fall behind real time.
let clock0 = 0, written = 0;
const MAX_BACKLOG = 16 * 1024 * 1024;   // ~2-3 s of frames queued for ffmpeg: beyond that, drop instead of buffering
setInterval(() => {
  if (!ff || !ffReady || !S.lastFrame) { clock0 = 0; return; }
  const now = performance.now();
  if (!clock0) { clock0 = now; written = 0; }
  const due = Math.floor(((now - clock0) / 1000) * C.fps) + 1;
  if (due - written > C.fps) { clock0 = now; written = 0; return; }   // stalled a second or more: re-sync, don't burst
  while (written < due) {
    written++;
    if (ff.stdin.writableLength > MAX_BACKLOG) { S.dropped = (S.dropped || 0) + 1; continue; }
    ff.stdin.write(S.lastFrame); S.framesOut++;
  }
}, 5);

// ---------- browser ----------
function findBrowser() {
  if (C.browser) return C.browser;
  const c = process.platform === "win32"
    ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]
    : process.platform === "darwin" ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium", "/usr/bin/microsoft-edge"];
  const hit = c.find((p) => existsSync(p));
  if (!hit) { console.error("No Chrome, Edge or Chromium found. Install one or pass --browser=<path>."); process.exit(1); }
  return hit;
}
let browser = null; let page = null; let cdp = null;
async function startBrowser() {
  S.browser = "starting";
  browser = await puppeteer.launch({
    executablePath: findBrowser(), headless: true, defaultViewport: { width: Math.round(C.width / C.scale), height: Math.round(C.height / C.scale), deviceScaleFactor: C.scale },
    args: [`--window-size=${Math.round(C.width / C.scale)},${Math.round(C.height / C.scale)}`, "--hide-scrollbars", "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--no-first-run", "--no-default-browser-check"],
  });
  browser.on("disconnected", () => { S.browser = "disconnected"; S.restarts.browser++; log("[browser] disconnected - restarting in 3 s"); setTimeout(() => startBrowser().catch(fail), 3000); });
  page = (await browser.pages())[0] || (await browser.newPage());
  page.on("pageerror", (e) => log("[page] error:", String(e?.message || e).slice(0, 160)));
  cdp = await page.createCDPSession();
  cdp.on("Page.screencastFrame", async (f) => {
    S.lastFrame = Buffer.from(f.data, "base64"); S.lastFrameAt = Date.now(); S.framesIn++;
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch { /* page navigating */ }
  });
  await show(S.urlIndex);
  S.browser = "running";
}
async function show(i) {
  S.urlIndex = i % C.urls.length; S.url = C.urls[S.urlIndex];
  log("[browser] loading", S.url);
  try { await cdp.send("Page.stopScreencast"); } catch { /* not started */ }
  try { await page.goto(S.url, { waitUntil: "networkidle2", timeout: 60000 }); }
  catch (e) { log("[browser] load problem (showing what loaded):", String(e?.message || e).slice(0, 120)); }
  await page.addStyleTag({ content: `html,body{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}${C.css}` }).catch(() => {});
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: C.quality, maxWidth: C.width, maxHeight: C.height, everyNthFrame: 1 });
  await grab();   // a first frame straight away, even for a page that never repaints
}
async function grab() {
  try { const b = await page.screenshot({ type: "jpeg", quality: C.quality }); S.lastFrame = Buffer.from(b); S.lastFrameAt = Date.now(); } catch { /* navigating */ }
}
// A static page stops producing screencast frames; refresh the still every few seconds so clocks/tickers stay current.
setInterval(() => { if (page && Date.now() - S.lastFrameAt > 3000) void grab(); }, 1000);
// Optional slow scroll, looping back to the top.
if (C.scrollPxPerSec > 0) setInterval(() => { page?.evaluate((px) => { const max = document.documentElement.scrollHeight - innerHeight; if (scrollY >= max - 2) scrollTo(0, 0); else scrollBy(0, px); }, C.scrollPxPerSec / 10).catch(() => {}); }, 100);
if (C.rotateSec > 0 && C.urls.length > 1) setInterval(() => { void show(S.urlIndex + 1); }, C.rotateSec * 1000);
if (C.reloadMin > 0) setInterval(() => { void show(S.urlIndex); }, C.reloadMin * 60000);

// ---------- status page ----------
const lanIps = () => Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address);
const streamUrls = () => (C.push ? [C.push] : lanIps().map((ip) => `rtsp://${ip}:${C.rtspPort}/${C.streamPath}`));
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/snapshot.jpg") { if (!S.lastFrame) { res.writeHead(503); return res.end(); } res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "no-store" }); return res.end(S.lastFrame); }
  if (u.pathname === "/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: S.ffmpeg === "running" && S.browser === "running" && Date.now() - S.lastFrameAt < 15000, ...S, lastFrame: undefined, streams: streamUrls(), config: C }, null, 2)); }
  if (u.pathname === "/next" && req.method === "POST") { void show(S.urlIndex + 1); res.writeHead(204); return res.end(); }
  if (u.pathname === "/reload" && req.method === "POST") { void show(S.urlIndex); res.writeHead(204); return res.end(); }
  const up = Math.round((Date.now() - S.started) / 60000);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Web to RTSP</title>
<style>body{margin:0;background:#0e1729;color:#e2e8f0;font:14px/1.5 system-ui,sans-serif;padding:16px}code{background:#223452;padding:2px 6px;border-radius:4px}img{width:100%;max-width:960px;border:1px solid #323e53;border-radius:8px;display:block;margin:12px 0}td{padding:2px 12px 2px 0}button{background:#3b82f6;color:#fff;border:0;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer}</style>
<h2 style="margin:0 0 8px">Web page to RTSP</h2>
<table><tr><td>Page</td><td>${S.url}</td></tr><tr><td>Stream</td><td>${streamUrls().map((s) => `<code>${s}</code>`).join("<br>")}</td></tr>
<tr><td>Video</td><td>${C.width}x${C.height} ${C.fps} fps ${C.codec.toUpperCase()} ${C.bitrate}${C.audio ? " + silent audio" : ""}</td></tr>
<tr><td>Status</td><td>browser ${S.browser} · encoder ${S.ffmpeg} · rtsp server ${S.mediamtx} · up ${up} min · restarts ${JSON.stringify(S.restarts)}</td></tr></table>
<img id="s" src="/snapshot.jpg" alt="current frame"><button onclick="fetch('/reload',{method:'POST'})">Reload page</button> ${C.urls.length > 1 ? `<button onclick="fetch('/next',{method:'POST'})">Next page</button>` : ""}
<script>setInterval(()=>{document.getElementById('s').src='/snapshot.jpg?'+Date.now()},2000)</script>`);
}).listen(C.statusPort, () => log(`[status] http://localhost:${C.statusPort}`));

// ---------- go ----------
function fail(e) { S.lastError = String(e?.message || e); log("[error]", S.lastError); }
process.on("unhandledRejection", fail);
const stop = () => { try { ff?.kill(); } catch {} try { mtx?.kill(); } catch {} try { browser?.close(); } catch {} process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

startMediamtx();
setTimeout(() => {
  startFfmpeg();
  startBrowser().catch((e) => { fail(e); process.exit(1); });
  log("Streaming", C.urls.join(", "), "->");
  for (const u of streamUrls()) log("   ", u);
}, C.push ? 0 : 1500);
