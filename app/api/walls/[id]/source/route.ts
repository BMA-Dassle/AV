// Change the picture on a wall that is showing one picture: { sourceId: string | null }
import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (req, site, { params }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const results = await site.setWallSource(id, body?.sourceId ?? null);
  return json({ success: results.every((r) => r.ok), results });
});
