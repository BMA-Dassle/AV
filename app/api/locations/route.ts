import { NextResponse, type NextRequest } from "next/server";
import { sites } from "@/lib/server/config";
import { authorize } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const denied = authorize(req); if (denied) return denied;
  return NextResponse.json(sites.map((s) => ({ slug: s.site.slug, name: s.site.name, shortName: s.site.shortName, squareLocationIDs: s.site.squareLocationIDs })));
}
