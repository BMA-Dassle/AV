import { withSite, json } from "@/lib/server/api";
import { SHEF_KEYS } from "@/lib/server/shef";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (req, site, { params }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || "");
  if (!(SHEF_KEYS as readonly string[]).includes(key)) return json({ success: false, message: `key must be one of ${SHEF_KEYS.join(", ")}` }, 400);
  return json({ success: true, ...(await site.sendKey(id, key)) });
});
