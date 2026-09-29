// Display power for screens that have it (projectors): { tvIds: [...], on: true|false }
import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (req, site) => {
  const body = await req.json().catch(() => ({}));
  const { tvIds, on } = body || {};
  if (!Array.isArray(tvIds) || !tvIds.length || typeof on !== "boolean") return json({ success: false, message: "tvIds[] and on (boolean) required" }, 400);
  const results = await site.setTvPower(tvIds.map(String), on);
  return json({ success: results.every((r) => r.ok), results });
});
