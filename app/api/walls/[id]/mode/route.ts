// Switch a video wall between one picture across all screens ("wall") and independent screens ("screens").
// { mode: "wall" | "screens", sourceId?: string | null }  (sourceId only for "wall"; default: what most screens show)
import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withSite(async (req, site, { params }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode;
  if (mode !== "wall" && mode !== "screens") return json({ success: false, message: "mode must be wall | screens" }, 400);
  return json({ success: true, ...(await site.setWallMode(id, mode, body?.sourceId === undefined ? undefined : body.sourceId)) });
});
