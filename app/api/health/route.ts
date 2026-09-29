import { NextResponse } from "next/server";
import { cfg, sites } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, mock: cfg.mock, sites: sites.map((s) => s.site.slug), auth: cfg.auth.required });
}
