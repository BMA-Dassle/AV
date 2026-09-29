import { withSite, json } from "@/lib/server/api";
import { schedule } from "@/lib/server/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (_req, site, { params }) => {
  const { id } = await params;
  await schedule.cancel(site.site.site.slug, id);
  await site.reloadSchedule();
  return json({ success: true });
});
