// Recovery actions for a DirecTV box: { action: "retry" | "wake" | "cycle" | "move", toBoxId? }
import { withSite, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withSite(async (req, site, { params }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  if (action === "retry") return json({ success: true, ...(await site.retryBox(id)) });
  if (action === "wake") return json({ success: true, ...(await site.wakeBox(id)) });
  if (action === "cycle") return json({ success: true, ...(await site.powerCycle(id)) });
  if (action === "move") return json({ success: true, ...(await site.moveScreens(id, body?.toBoxId ? String(body.toBoxId) : undefined)) });
  return json({ success: false, message: "action must be retry | wake | cycle | move" }, 400);
});
