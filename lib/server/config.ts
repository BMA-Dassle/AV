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
export type SourceConfig = { id: string; name: string; kind: string; encoder: Encoder };
export type ZoneConfig = { id: string; name: string };
export type TvConfig = { id: string; name: string; zone: string; legacyOutId?: number; map?: [number, number]; decoder: { ip: string; nodeId?: string | number; legacyDeviceId?: number };
  // Power control of the display itself (projectors). Optional; TVs without it have no power buttons.
  display?: { kind: "projector" | "tv"; protocol?: "optoma" | "pjlink"; ip: string; port?: number; legacyDeviceId?: number } };
export type SiteConfig = {
  site: { slug: string; name: string; shortName: string; squareLocationIDs: string[]; guideLineup?: string; timezone?: string; previewGateway?: string; directvSubnets?: string[]; legacyControllerBase?: string; notes?: string };
  boxes: BoxConfig[]; otherSources: SourceConfig[]; zones: ZoneConfig[]; tvs: TvConfig[];
};

export const sites: SiteConfig[] = [hpfm, ft, hpn].map((s) => s as unknown as SiteConfig);

// A site is addressed by its slug ("fort-myers") or any of its Square location ids.
export function findSite(key?: string | null): SiteConfig | null {
  if (!key) return sites[0];
  const k = String(key).toLowerCase();
  return sites.find((s) => s.site.slug === k || (s.site.squareLocationIDs || []).some((id) => id.toLowerCase() === k)) || null;
}

const tokens = (process.env.APP_TOKENS || process.env.APP_TOKEN || "").split(",").map((t) => t.trim()).filter(Boolean);

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
