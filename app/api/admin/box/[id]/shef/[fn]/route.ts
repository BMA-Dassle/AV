import { withSite, json } from "@/lib/server/api";
import { cfg } from "@/lib/server/config";
import { shef } from "@/lib/server/shef";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (_req, site, { params }) => {
  const { id, fn } = await params;
  const box = site.boxConfig(id);
  if (!box) return json({ success: false, message: "unknown box" }, 404);
  if (cfg.mock) return json({ mock: true, note: "SHEF diagnostics are not simulated" });
  const fns: Record<string, () => Promise<unknown>> = {
    version: () => shef.getVersion(box.shef.ip), options: () => shef.getOptions(box.shef.ip), locations: () => shef.getLocations(box.shef.ip),
    mode: () => shef.mode(box.shef.ip, box.shef.clientAddr), tuned: () => shef.getTuned(box.shef.ip, box.shef.clientAddr),
  };
  if (!fns[fn]) return json({ success: false, message: "fn must be version|options|locations|mode|tuned" }, 400);
  return json(await fns[fn]());
});
