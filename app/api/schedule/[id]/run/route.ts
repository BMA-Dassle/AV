// Run a scheduled change now instead of at its time.
import { withSite, json } from "@/lib/server/api";
import { schedule } from "@/lib/server/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withSite(async (_req, site, { params }) => {
  const { id } = await params;
  await schedule.runNow(site.site.site.slug, id);
  await site.runDue(true);
  return json({ success: true });
});
