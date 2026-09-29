import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (req, site) => {
  const body = await req.json().catch(() => ({}));
  const { tvIds, sourceId, audio, vol } = body || {};
  if (!Array.isArray(tvIds) || !tvIds.length) return json({ success: false, message: "tvIds[] required" }, 400);
  const results = await site.setTvSource(tvIds.map(String), sourceId ?? null, { audio, vol });
  return json({ success: results.every((r) => r.ok), results });
});
