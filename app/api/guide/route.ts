import { withSite, json } from "@/lib/server/api";
import { getGuide } from "@/lib/server/guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (req, site) => {
  const q = req.nextUrl.searchParams;
  return json(await getGuide({ from: q.get("from"), hours: q.get("hours") || 3, filter: q.get("filter") || "all", lineup: site.site.site.guideLineup, timezone: site.site.site.timezone }));
});
