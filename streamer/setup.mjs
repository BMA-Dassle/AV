#!/usr/bin/env node
// Downloads MediaMTX (the RTSP server, MIT licensed) into streamer/bin for this platform.
// ffmpeg comes from the ffmpeg-static npm package; the browser is the Chrome/Edge already on the PC.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = process.env.MEDIAMTX_VERSION || "v1.9.3";
const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, "bin");
const exe = path.join(bin, process.platform === "win32" ? "mediamtx.exe" : "mediamtx");
if (existsSync(exe) && !process.argv.includes("--force")) { console.log("MediaMTX already in", exe); process.exit(0); }

const arch = process.arch === "arm64" ? "arm64" : process.arch === "arm" ? "armv7" : "amd64";
const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux";
const ext = os === "windows" ? "zip" : "tar.gz";
const name = `mediamtx_${VERSION}_${os}_${arch}.${ext}`;
const url = `https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/${name}`;
mkdirSync(bin, { recursive: true });
console.log("Downloading", url);
const res = await fetch(url);
if (!res.ok) { console.error("Download failed:", res.status, res.statusText); process.exit(1); }
const file = path.join(bin, name);
writeFileSync(file, Buffer.from(await res.arrayBuffer()));
if (ext === "zip") execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Force -LiteralPath '${file}' -DestinationPath '${bin}'`], { stdio: "inherit" });
else execFileSync("tar", ["-xzf", file, "-C", bin], { stdio: "inherit" });
rmSync(file);
// the archive ships its own mediamtx.yml; ours (streamer/mediamtx.yml) is the one used
rmSync(path.join(bin, "mediamtx.yml"), { force: true });
console.log(existsSync(exe) ? `MediaMTX ${VERSION} installed: ${exe}` : "Extracted, but mediamtx binary not found");
