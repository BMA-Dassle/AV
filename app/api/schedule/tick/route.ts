// Runs due scheduled changes for every venue. Changes also run whenever any tablet has the app open; this endpoint
// covers the hours when none is. Call it every minute: Vercel Cron (Pro plan; sends Authorization: Bearer
// $CRON_SECRET) or any outside timer with CRON_SECRET or an app token.
import { NextResponse, type NextRequest } from "next/server";
import { authorize, errorResponse } from "@/lib/server/api";
import { siteStates } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function tick(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const h = req.headers.get("authorization") || "";
  if (!(secret && h === `Bearer ${secret}`)) { const denied = authorize(req); if (denied) return denied; }
  try {
    const out: Record<string, number> = {};
    for (const s of siteStates.values()) { await s.hydrate(true); await s.runDue(true); out[s.site.site.slug] = s.pendingSchedule.length; }
    return NextResponse.json({ success: true, pending: out, at: new Date().toISOString() });
  } catch (e) { return errorResponse(e); }
}
export const GET = tick;
export const POST = tick;
