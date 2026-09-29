// Helpers shared by the route handlers: auth, site resolution, JSON responses, error mapping.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { cfg, sites, HttpError } from "./config";
import { siteFor, type SiteState } from "./state";

export const runtime = "nodejs";

function tokenOk(given: string) {
  if (!given) return false;
  const g = Buffer.from(given);
  return cfg.auth.tokens.some((t) => { const b = Buffer.from(t); return b.length === g.length && timingSafeEqual(b, g); });
}

export function authorize(req: NextRequest): NextResponse | null {
  if (!cfg.auth.required) return null;
  const h = req.headers.get("authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7).trim() : req.nextUrl.searchParams.get("token") || "";
  if (tokenOk(given)) return null;
  return NextResponse.json({ success: false, message: "Unauthorized: send Authorization: Bearer <token> (or ?token=)" }, { status: 401 });
}

export function resolveSite(req: NextRequest): SiteState | NextResponse {
  const key = req.nextUrl.searchParams.get("location") || req.headers.get("x-location") || "";
  const site = siteFor(key);
  if (!site) return NextResponse.json({ success: false, message: `Unknown location "${key}"`, known: sites.map((s) => ({ slug: s.site.slug, squareLocationIDs: s.site.squareLocationIDs })) }, { status: 404 });
  return site;
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function errorResponse(e: unknown) {
  const err = e as Partial<HttpError> & { message?: string };
  const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502;
  return NextResponse.json({ success: false, message: err?.message || "error", detail: err?.body ?? undefined }, { status });
}

// Wrap a handler: auth, then site, then the handler; errors become JSON.
export function withSite(handler: (req: NextRequest, site: SiteState, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const denied = authorize(req); if (denied) return denied;
    const site = resolveSite(req); if (site instanceof NextResponse) return site;
    try { return await handler(req, site, ctx); } catch (e) { return errorResponse(e); }
  };
}
