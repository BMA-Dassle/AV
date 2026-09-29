import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (_req, site) => {
  await site.ensureFresh();
  return json(site.snapshot());
});
