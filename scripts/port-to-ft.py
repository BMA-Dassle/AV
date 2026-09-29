"""Port the AV app (this repo) into the FastTrax monorepo's apps/web, served at headpinz.com/av.

Re-runnable: overwrites the ported files each time. Usage:  python scripts/port-to-ft.py <path-to-FT-repo-root>
  src/features/av/{server,client,config/sites}   <- lib/server, lib/client, config/sites
  src/components/features/av/                     <- components
  app/av/{layout.tsx,page.tsx,av.css}             <- app/layout.tsx, app/page.tsx, app/globals.css (scoped under .av-app)
  app/api/av/**                                   <- app/api/**
  public/av/{brand,go2rtc}                        <- public/*
  docs/av/                                        <- docs (research + specs)
"""
import os, re, shutil, sys

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FT = sys.argv[1] if len(sys.argv) > 1 else r"C:\GIT\Tools-Website-FT"
W = os.path.join(FT, "apps", "web")

def rd(p): return open(p, encoding="utf8").read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf8", newline="\n").write(s)

def rewrite_ts(s: str) -> str:
    s = s.replace('"@/lib/server/', '"~/features/av/server/').replace("'@/lib/server/", "'~/features/av/server/")
    s = s.replace('"@/lib/client/', '"~/features/av/client/').replace("'@/lib/client/", "'~/features/av/client/")
    s = s.replace('"@/config/sites/', '"~/features/av/config/sites/')
    s = s.replace('"@/components/', '"~/components/features/av/')
    # served under /av on the website
    s = re.sub(r'(["`])/api/(?!av/)', r'\1/api/av/', s)
    s = s.replace('"/brand/', '"/av/brand/').replace('"/go2rtc/', '"/av/go2rtc/')
    # env names that must not collide in the shared FastTrax project
    s = s.replace("process.env.MOCK", "process.env.AV_MOCK")
    return s

# ---- server, client, config, components ----
for sub, dst in [("lib/server", "src/features/av/server"), ("lib/client", "src/features/av/client"), ("components", "src/components/features/av")]:
    d = os.path.join(W, dst)
    if os.path.isdir(d): shutil.rmtree(d)
    for f in os.listdir(os.path.join(SRC, sub)):
        if f.endswith((".ts", ".tsx")): wr(os.path.join(d, f), rewrite_ts(rd(os.path.join(SRC, sub, f))))
cfg = os.path.join(W, "src/features/av/config/sites")
if os.path.isdir(cfg): shutil.rmtree(cfg)
for f in os.listdir(os.path.join(SRC, "config/sites")):
    wr(os.path.join(cfg, f), rd(os.path.join(SRC, "config/sites", f)).replace('"/brand/', '"/av/brand/'))

# ---- API routes -> app/api/av ----
api_dst = os.path.join(W, "app/api/av")
if os.path.isdir(api_dst): shutil.rmtree(api_dst)
for root, _, files in os.walk(os.path.join(SRC, "app/api")):
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), os.path.join(SRC, "app/api"))
        wr(os.path.join(api_dst, rel), rewrite_ts(rd(os.path.join(root, f))))

# ---- page + layout ----
wr(os.path.join(W, "app/av/page.tsx"), '''import AVControl from "~/components/features/av/AVControl";

// HeadPinz AV control (TV sources, DirecTV boxes, guide, schedule). Token-gated by AV_APP_TOKENS through ?token=,
// which the page keeps in localStorage. Chrome-free: see isAvPath in ~/lib/constants/chrome-routes.
export const dynamic = "force-dynamic";

export default function AvPage() {
  return <AVControl />;
}
''')
wr(os.path.join(W, "app/av/layout.tsx"), '''import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";
import "./av.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--av-font-poppins", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--av-font-anton", display: "swap" });

export const metadata: Metadata = {
  title: "HeadPinz AV Control",
  description: "Put the right game on the right screens.",
  robots: { index: false, follow: false },
  icons: { icon: "/av/brand/headpinz-logo-520.png" },
};
export const viewport: Viewport = { themeColor: "#0e1729", width: "device-width", initialScale: 1, viewportFit: "cover" };

/** Staff AV control. Everything it styles lives under .av-app (app/av/av.css) so nothing leaks into the site. */
export default function AvLayout({ children }: { children: React.ReactNode }) {
  return <div className={`av-app ${poppins.variable} ${anton.variable}`}>{children}</div>;
}
''')

# ---- scope the stylesheet under .av-app ----
css = rd(os.path.join(SRC, "app/globals.css"))
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
css = css.replace('url("/brand/', 'url("/av/brand/')
css = re.sub(r"@keyframes\s+pulse\b", "@keyframes av-pulse", css)
css = re.sub(r"@keyframes\s+slideIn\b", "@keyframes av-slideIn", css)
css = re.sub(r"(animation:[^;}]*?)\bpulse\b", r"\1av-pulse", css)
css = re.sub(r"(animation:[^;}]*?)\bslideIn\b", r"\1av-slideIn", css)
css = css.replace('--font:"Poppins"', '--font:var(--av-font-poppins),"Poppins"').replace('--display:"Anton"', '--display:var(--av-font-anton),"Anton"')

def scope_selector(sel: str) -> str:
    out = []
    for part in sel.split(","):
        p = part.strip()
        if not p: continue
        if p in (":root", "html", "body"): out.append(".av-app")
        elif p.startswith(("html ", "body ")): out.append(".av-app " + p.split(" ", 1)[1])
        else: out.append(".av-app " + p)
    return ",".join(dict.fromkeys(out))

def scope(block: str) -> str:
    res, i, n = [], 0, len(block)
    while i < n:
        j = block.find("{", i)
        if j < 0: res.append(block[i:]); break
        head = block[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if block[k] == "{": depth += 1
            elif block[k] == "}": depth -= 1
            k += 1
        body = block[j + 1:k - 1]
        if head.startswith("@keyframes") or head.startswith("@font-face"): res.append(f"{head}{{{body}}}")
        elif head.startswith("@"): res.append(f"{head}{{{scope(body)}}}")
        elif head: res.append(f"{scope_selector(head)}{{{body}}}")
        i = k
    return "\n".join(res)

scoped = scope(css)
# the wrapper is the page: full screen, isolated from the site's own html/body
scoped = (".av-app{position:fixed;inset:0;overflow:hidden;z-index:0}\n"
          ".av-app,.av-app *{box-sizing:border-box}\n" + scoped)
wr(os.path.join(W, "app/av/av.css"), "/* HeadPinz AV control, scoped under .av-app (generated from the AV app's globals.css by scripts/port-to-ft.py). */\n" + scoped + "\n")

# ---- public assets ----
pub = os.path.join(W, "public/av")
if os.path.isdir(pub): shutil.rmtree(pub)
shutil.copytree(os.path.join(SRC, "public"), pub)

# ---- docs ----
dd = os.path.join(FT, "docs/av")
os.makedirs(dd, exist_ok=True)
for f in ["RESEARCH.md", "VIDEO-WALLS.md", "SCHEDULE.md", "PANDORA-DIRECTV-SPEC.md", "GUIDE-PROVIDERS.md", "PREVIEW-GATEWAY.md", "go2rtc.yaml"]:
    p = os.path.join(SRC, "docs", f)
    if os.path.exists(p): shutil.copy(p, os.path.join(dd, f))
readme = rd(os.path.join(SRC, "README.md"))
wr(os.path.join(W, "src/features/av/README.md"), readme)
shutil.copy(os.path.join(SRC, "scripts/migrate-to-ft-neon.mjs"), os.path.join(W, "scripts/av-migrate-neon.mjs"))
print("ported into", W)
