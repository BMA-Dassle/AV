import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (_req, site) => { await site.refreshAllBoxes(); return json({ success: true }); });
