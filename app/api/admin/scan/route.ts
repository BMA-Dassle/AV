import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (req, site) => {
  const body = await req.json().catch(() => ({}));
  return json(await site.pandora.scan(site.site.site.squareLocationIDs?.[0], body?.method || "auto"));
});
