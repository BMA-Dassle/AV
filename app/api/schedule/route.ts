// Scheduled changes for a venue.
//   GET  -> { items }: pending and running changes plus the last 3 days of history, soonest first
//   POST { runAt, actions, label, program? } -> the new change (actions: lib/server/schedule.ts)
import { withSite, json } from "@/lib/server/api";
import { schedule, validateActions, type ProgramRef } from "@/lib/server/schedule";
import { HttpError } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (_req, site) => {
  void site.runDue();
  return json({ items: (await schedule.list(site.site.site.slug)).map(({ site: _s, ...v }) => v) });
});

export const POST = withSite(async (req, site) => {
  const b = await req.json().catch(() => ({}));
  const runAt = Number(b?.runAt);
  if (!Number.isFinite(runAt)) throw new HttpError("runAt (epoch ms) is required", 400);
  if (runAt < Date.now() - 60000) throw new HttpError("That time has already passed", 400);
  if (runAt > Date.now() + 14 * 24 * 3600000) throw new HttpError("Schedule at most 14 days ahead", 400);
  const actions = validateActions(b?.actions);
  for (const a of actions) {
    if (a.type === "tune" && !site.boxConfig(a.boxId)) throw new HttpError(`Unknown box ${a.boxId}`, 400);
    if ((a.type === "source" || a.type === "power") && a.tvIds.some((id) => !site.snapshot().tvs.some((t) => t.id === id))) throw new HttpError("Unknown screen in the list", 400);
  }
  const p = b?.program;
  const program: ProgramRef | null = p && Number.isFinite(Number(p.num)) ? { num: Number(p.num), callsign: String(p.callsign || ""), title: String(p.title || ""), subtitle: String(p.subtitle || ""), start: Number(p.start) || runAt, end: Number(p.end) || runAt } : null;
  const item = await schedule.create(site.site.site.slug, { runAt, actions, label: String(b?.label || "").slice(0, 200) || "Scheduled change", program });
  await site.reloadSchedule();
  if (runAt <= Date.now() + 5000) void site.runDue(true);
  const { site: _s, ...v } = item;
  return json({ success: true, item: v });
});
