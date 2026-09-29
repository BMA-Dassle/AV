import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;   // busy boxes are retried (lib/server/state.ts tuneBox)

export const POST = withSite(async (req, site, { params }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return json({ success: true, ...(await site.tuneBox(id, body?.channel)) });
});
