// Environment settings and the list of sites (one JSON per location in config/sites).
import hpfm from "@/config/sites/hpfm.json";
import ft from "@/config/sites/ft.json";
import hpn from "@/config/sites/hpn.json";

export type Encoder = { ip: string; devid: string | number };
export type BoxConfig = {
  id: string; name: string; legacyDeviceId?: number; color: string; receiverId?: string;
  shef: { ip: string; clientAddr: string }; encoder: Encoder; preview?: string; model?: string; shefIpUnverified?: string;
  // Switched outlet for a hard reboot: a single cycle URL, or off + on URLs with a delay (PDU, smart plug, Q-SYS relay endpoint).
  power?: { cycleUrl?: string; offUrl?: string; onUrl?: string; delayMs?: number; method?: string };
};
// The floor drawing: one or more panels in the old controller's coordinate space; tvs[].map is each tile's top-left.
export type PlanPanel = { id: string; name?: string; x0: number; y0: number; x1: number; y1: number; image?: string; imageBox?: [number, number, number, number]; rotate?: "cw" | "ccw" };
// landscape "row": on landscape screens the panels sit side by side at equal height (else they stack).
export type PlanConfig = { panels: PlanPanel[]; tile: [number, number]; landscape?: "row" | "stack" };
// A source is an AV-over-IP encoder, or any RTSP stream the receivers pull directly (window type 2), e.g. the
// web-page streamer in streamer/ (rtsp://<pc>:8554/headpinz). An RTSP source with an empty url is hidden.
// protocol: how the receiver pulls it (vendor openwindow "protocol": 0 multicast, 1 tcp, 2 udp unicast); RTSP defaults to 1.
export type SourceConfig = { id: string; name: string; kind: string; encoder?: Encoder; rtsp?: string; protocol?: 0 | 1 | 2 };
export type ZoneConfig = { id: string; name: string };
export type TvConfig = { id: string; name: string; zone: string; legacyOutId?: number; map?: [number, number]; decoder: { ip: string; nodeId?: string | number; legacyDeviceId?: number };
  // Power control of the display itself (projectors). Optional; TVs without it have no power buttons.
  display?: { kind: "projector" | "tv"; protocol?: "optoma" | "pjlink"; ip: string; port?: number; legacyDeviceId?: number } };
// A video wall: decoders in a grid showing either one picture across all of them ("wall") or independent pictures ("screens").
// wallId, grid and multicast group are what the nodes store (newwall); see docs/VIDEO-WALLS.md.
export type WallConfig = { id: string; name: string; wallId: number; rows: string[][]; tile: [number, number]; hz?: number; multiaddr?: string; multPort?: number };
export type SiteConfig = {
  site: { slug: string; name: string; shortName: string; squareLocationIDs: string[]; guideLineup?: string; timezone?: string; previewGateway?: string; directvSubnets?: string[]; legacyControllerBase?: string; notes?: string; map?: PlanConfig };
  boxes: BoxConfig[]; otherSources: SourceConfig[]; zones: ZoneConfig[]; tvs: TvConfig[]; walls?: WallConfig[];
};

export const sites: SiteConfig[] = [hpfm, ft, hpn].map((s) => s as unknown as SiteConfig);

// A site is addressed by its slug ("fort-myers") or any of its Square location ids.
export function findSite(key?: string | null): SiteConfig | null {
  if (!key) return sites[0];
  const k = String(key).toLowerCase();
  return sites.find((s) => s.site.slug === k || (s.site.squareLocationIDs || []).some((id) => id.toLowerCase() === k)) || null;
}

// AV_APP_TOKENS (comma-separated); the old APP_TOKENS / APP_TOKEN names still work
const tokens = (process.env.AV_APP_TOKENS || process.env.APP_TOKENS || process.env.APP_TOKEN || "").split(",").map((t) => t.trim()).filter(Boolean);

export const cfg = {
  mock: process.env.MOCK === "1" || process.env.MOCK === "true",
  // How the app reads and controls the DirecTV boxes:
  //   pandora  through Pandora /v2/directv/* (the only option from a cloud host; needs the Pandora DirecTV release)
  //   shef     straight to the boxes on port 8080 (an on-site host only)
  //   mock     simulated boxes (lets the matrix run live while Pandora's DirecTV endpoints are not deployed yet)
  // Projector power: pandora (cloud host) | direct (on-site host, TCP to the projector) | mock
  projectorVia: (process.env.PROJECTOR_VIA || (process.env.MOCK === "1" || process.env.MOCK === "true" ? "mock" : "pandora")) as "pandora" | "direct" | "mock",
  directvVia: (process.env.DIRECTV_VIA || (process.env.MOCK === "1" || process.env.MOCK === "true" ? "mock" : "pandora")) as "pandora" | "shef" | "mock",
  auth: { tokens, required: tokens.length > 0 },
  pandora: {
    baseUrl: process.env.PANDORA_BASE || "https://bma-pandora-api.azurewebsites.net/v2",
    token: process.env.PANDORA_TOKEN || "",
    transport: (process.env.PANDORA_TRANSPORT || "udp") as "udp" | "tcp",
    timeoutMs: Number(process.env.PANDORA_TIMEOUT_MS || 8000),
  },
  shef: {
    port: Number(process.env.SHEF_PORT || 8080),
    timeoutMs: Number(process.env.SHEF_TIMEOUT_MS || 3000),
    pollMs: Number(process.env.SHEF_POLL_MS || 10000),
  },
  guide: {
    provider: process.env.GUIDE_PROVIDER || (process.env.TVMEDIA_API_KEY ? "tvmedia" : "mock"),
    timezone: process.env.GUIDE_TIMEZONE || "America/New_York",
    tvmedia: { apiKey: process.env.TVMEDIA_API_KEY || "", lineup: process.env.TVMEDIA_LINEUP || "36463D", monthlyCap: Number(process.env.TVMEDIA_MONTHLY_CAP || 900) },
  },
};

export class HttpError extends Error {
  constructor(message: string, public status: number, public body?: unknown) { super(message); }
}
