import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (_req, site, { params }) => { const { id } = await params; return json(await site.tvStatus(id)); });
