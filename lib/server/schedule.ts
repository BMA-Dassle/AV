// Scheduled changes: a time, a list of actions, a label. Today the guide creates "tune a box at the start of a
// program" (optionally followed by putting it on screens); the action list is general so the same scheduler can
// later drive every box, screen, wall and projector (docs/SCHEDULE.md).
//
// Stored in Neon (av_schedule) so every instance and every tablet sees the same list, and each change is claimed
// by exactly one instance when it is due. Without a database it lives in memory (single always-on host / dev).
import { neon } from "@neondatabase/serverless";
import { ensureSchema, hasStore } from "./store";
import { HttpError } from "./config";

export type Action =
  | { type: "tune"; boxId: string; channel: number }
  | { type: "source"; tvIds: string[]; sourceId: string | null }
  | { type: "wall"; wallId: string; mode: "wall" | "screens"; sourceId?: string | null }
  | { type: "power"; tvIds: string[]; on: boolean };

export type ProgramRef = { num: number; callsign: string; title: string; subtitle: string; start: number; end: number };
export type ScheduleStatus = "pending" | "running" | "done" | "failed" | "canceled" | "missed";
export type ScheduleItem = {
  id: string; site: string; runAt: number; status: ScheduleStatus; actions: Action[]; label: string; program: ProgramRef | null;
  createdAt: number; createdBy: string | null; ranAt: number | null; result: unknown; error: string | null;
};

// A change that could not run on time (nobody online, host asleep) still runs while its program is on; after that it is "missed".
export const GRACE_MS = 30 * 60000;

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const sql = () => neon(url);
const g = globalThis as unknown as { __sched?: ScheduleItem[]; __schedSeq?: number };
const mem = (g.__sched ??= []);

const rowToItem = (r: any): ScheduleItem => ({
  id: String(r.id), site: r.site, runAt: Date.parse(r.run_at), status: r.status, actions: r.actions || [], label: r.label || "", program: r.program || null,
  createdAt: Date.parse(r.created_at), createdBy: r.created_by || null, ranAt: r.ran_at ? Date.parse(r.ran_at) : null, result: r.result ?? null, error: r.error || null,
});

export async function ensureScheduleSchema() {
  if (!hasStore()) return;
  await ensureSchema();
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS av_schedule (id bigserial PRIMARY KEY, site text NOT NULL, run_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending', actions jsonb NOT NULL, label text, program jsonb, created_at timestamptz NOT NULL DEFAULT now(), created_by text, ran_at timestamptz, claimed_at timestamptz, result jsonb, error text)`;
  await q`CREATE INDEX IF NOT EXISTS av_schedule_due ON av_schedule (site, status, run_at)`;
}
let ready: Promise<void> | null = null;
const schema = () => (ready ??= ensureScheduleSchema().catch((e) => { ready = null; throw e; }));

export function validateActions(actions: unknown): Action[] {
  if (!Array.isArray(actions) || !actions.length) throw new HttpError("actions must be a non-empty list", 400);
  return actions.map((a: any) => {
    if (a?.type === "tune" && typeof a.boxId === "string" && Number.isInteger(Number(a.channel))) return { type: "tune", boxId: a.boxId, channel: Number(a.channel) };
    if (a?.type === "source" && Array.isArray(a.tvIds) && a.tvIds.length) return { type: "source", tvIds: a.tvIds.map(String), sourceId: a.sourceId == null ? null : String(a.sourceId) };
    if (a?.type === "wall" && typeof a.wallId === "string" && (a.mode === "wall" || a.mode === "screens")) return { type: "wall", wallId: a.wallId, mode: a.mode, sourceId: a.sourceId ?? undefined };
    if (a?.type === "power" && Array.isArray(a.tvIds) && a.tvIds.length) return { type: "power", tvIds: a.tvIds.map(String), on: Boolean(a.on) };
    throw new HttpError(`Unknown or incomplete action: ${JSON.stringify(a).slice(0, 120)}`, 400);
  });
}

export const schedule = {
  async create(site: string, x: { runAt: number; actions: Action[]; label: string; program: ProgramRef | null; createdBy?: string | null }): Promise<ScheduleItem> {
    if (!hasStore()) {
      const item: ScheduleItem = { id: `m${(g.__schedSeq = (g.__schedSeq || 0) + 1)}`, site, runAt: x.runAt, status: "pending", actions: x.actions, label: x.label, program: x.program, createdAt: Date.now(), createdBy: x.createdBy || null, ranAt: null, result: null, error: null };
      mem.push(item); return item;
    }
    await schema();
    const r = await sql()`INSERT INTO av_schedule (site, run_at, actions, label, program, created_by) VALUES (${site}, ${new Date(x.runAt).toISOString()}, ${JSON.stringify(x.actions)}::jsonb, ${x.label}, ${JSON.stringify(x.program)}::jsonb, ${x.createdBy || null}) RETURNING *`;
    return rowToItem(r[0]);
  },
  // Pending and running changes, plus finished ones from the last `historyMs`.
  async list(site: string, historyMs = 3 * 24 * 3600000): Promise<ScheduleItem[]> {
    const since = Date.now() - historyMs;
    if (!hasStore()) return mem.filter((i) => i.site === site && (i.status === "pending" || i.status === "running" || (i.ranAt ?? i.createdAt) >= since)).sort((a, b) => a.runAt - b.runAt);
    await schema();
    const r = await sql()`SELECT * FROM av_schedule WHERE site = ${site} AND (status IN ('pending','running') OR COALESCE(ran_at, created_at) >= ${new Date(since).toISOString()}) ORDER BY run_at ASC LIMIT 300`;
    return r.map(rowToItem);
  },
  async cancel(site: string, id: string): Promise<ScheduleItem> {
    if (!hasStore()) { const i = mem.find((x) => x.site === site && x.id === id); if (!i) throw new HttpError("Not found", 404); if (i.status !== "pending") throw new HttpError(`Already ${i.status}`, 409); i.status = "canceled"; i.ranAt = Date.now(); return i; }
    await schema();
    const r = await sql()`UPDATE av_schedule SET status = 'canceled', ran_at = now() WHERE site = ${site} AND id = ${Number(id)} AND status = 'pending' RETURNING *`;
    if (!r[0]) throw new HttpError("Not found or no longer pending", 409);
    return rowToItem(r[0]);
  },
  async runNow(site: string, id: string) {
    if (!hasStore()) { const i = mem.find((x) => x.site === site && x.id === id && x.status === "pending"); if (!i) throw new HttpError("Not found or no longer pending", 409); i.runAt = Date.now(); return; }
    await schema();
    const r = await sql()`UPDATE av_schedule SET run_at = now() WHERE site = ${site} AND id = ${Number(id)} AND status = 'pending' RETURNING id`;
    if (!r[0]) throw new HttpError("Not found or no longer pending", 409);
  },
  // Atomically take the due changes for a site: only one instance gets each one.
  async claimDue(site: string, limit = 10): Promise<ScheduleItem[]> {
    const now = Date.now();
    if (!hasStore()) { const due = mem.filter((i) => i.site === site && i.status === "pending" && i.runAt <= now).slice(0, limit); due.forEach((i) => (i.status = "running")); return due; }
    await schema();
    const r = await sql()`UPDATE av_schedule SET status = 'running', claimed_at = now() WHERE id IN (SELECT id FROM av_schedule WHERE site = ${site} AND status = 'pending' AND run_at <= now() ORDER BY run_at LIMIT ${limit} FOR UPDATE SKIP LOCKED) RETURNING *`;
    return r.map(rowToItem);
  },
  async finish(item: ScheduleItem, status: ScheduleStatus, result: unknown, error: string | null) {
    if (!hasStore()) { Object.assign(item, { status, result, error, ranAt: Date.now() }); const m = mem.find((x) => x.id === item.id); if (m) Object.assign(m, { status, result, error, ranAt: Date.now() }); return; }
    await schema();
    await sql()`UPDATE av_schedule SET status = ${status}, result = ${JSON.stringify(result ?? null)}::jsonb, error = ${error}, ran_at = now() WHERE id = ${Number(item.id)}`;
  },
  // A change left "running" by an instance that died mid-run goes back to pending after 5 minutes.
  async unstick(site: string) {
    if (!hasStore()) return;
    await schema();
    await sql()`UPDATE av_schedule SET status = 'pending', claimed_at = NULL WHERE site = ${site} AND status = 'running' AND claimed_at < now() - interval '5 minutes'`;
  },
};
