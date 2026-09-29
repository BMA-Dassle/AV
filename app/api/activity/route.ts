// Recent actions at this location (who changed what), from the shared store.
import { withSite, json } from "@/lib/server/api";
import { hasStore, store } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (req, site) => {
  if (!hasStore()) return json({ success: true, items: [], note: "No DATABASE_URL: activity is not recorded" });
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit")) || 50);
  return json({ success: true, items: await store.recent(site.site.site.slug, limit) });
});
