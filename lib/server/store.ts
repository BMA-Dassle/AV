// Shared floor state in Neon Postgres (optional). With DATABASE_URL set, every server instance reads and writes the
// same TV -> source map, projector power and box status, so all tablets see one floor even on a serverless host.
// Without it, state is per process (fine for an always-on host).
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type TvRow = { tv_id: string; source_id: string | null; power: boolean | null; changed_at: string };
export type BoxRow = { box_id: string; online: boolean | null; error: string | null; offline_since: string | null; tuned: unknown; updated_at: string };

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
let sql: NeonQueryFunction<false, false> | null = null;
let ready: Promise<void> | null = null;

export const hasStore = () => Boolean(url);

function client() {
  if (!sql) sql = neon(url);
  return sql;
}

// Idempotent schema; runs once per process.
export function ensureSchema() {
  if (!url) return Promise.resolve();
  if (!ready) {
    const q = client();
    ready = (async () => {
      await q`CREATE TABLE IF NOT EXISTS av_tv_state (site text NOT NULL, tv_id text NOT NULL, source_id text, power boolean, changed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site, tv_id))`;
      await q`CREATE TABLE IF NOT EXISTS av_box_state (site text NOT NULL, box_id text NOT NULL, online boolean, error text, offline_since timestamptz, tuned jsonb, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site, box_id))`;
      await q`CREATE TABLE IF NOT EXISTS av_activity (id bigserial PRIMARY KEY, site text NOT NULL, at timestamptz NOT NULL DEFAULT now(), action text NOT NULL, detail jsonb)`;
      await q`CREATE INDEX IF NOT EXISTS av_activity_site_at ON av_activity (site, at DESC)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export const store = {
  async loadTvs(site: string): Promise<TvRow[]> {
    await ensureSchema();
    return (await client()`SELECT tv_id, source_id, power, changed_at FROM av_tv_state WHERE site = ${site}`) as TvRow[];
  },
  async saveTvSources(site: string, rows: { tvId: string; sourceId: string | null }[]) {
    await ensureSchema();
    const q = client();
    for (const r of rows) await q`INSERT INTO av_tv_state (site, tv_id, source_id, changed_at) VALUES (${site}, ${r.tvId}, ${r.sourceId}, now()) ON CONFLICT (site, tv_id) DO UPDATE SET source_id = EXCLUDED.source_id, changed_at = now()`;
  },
  async saveTvPower(site: string, rows: { tvId: string; power: boolean }[]) {
    await ensureSchema();
    const q = client();
    for (const r of rows) await q`INSERT INTO av_tv_state (site, tv_id, power, changed_at) VALUES (${site}, ${r.tvId}, ${r.power}, now()) ON CONFLICT (site, tv_id) DO UPDATE SET power = EXCLUDED.power, changed_at = now()`;
  },
  async loadBoxes(site: string): Promise<BoxRow[]> {
    await ensureSchema();
    return (await client()`SELECT box_id, online, error, offline_since, tuned, updated_at FROM av_box_state WHERE site = ${site}`) as BoxRow[];
  },
  async saveBoxes(site: string, rows: { boxId: string; online: boolean | null; error: string | null; offlineSince: number | null; tuned: unknown }[]) {
    await ensureSchema();
    const q = client();
    for (const r of rows) await q`INSERT INTO av_box_state (site, box_id, online, error, offline_since, tuned, updated_at) VALUES (${site}, ${r.boxId}, ${r.online}, ${r.error}, ${r.offlineSince ? new Date(r.offlineSince).toISOString() : null}, ${JSON.stringify(r.tuned ?? null)}::jsonb, now()) ON CONFLICT (site, box_id) DO UPDATE SET online = EXCLUDED.online, error = EXCLUDED.error, offline_since = EXCLUDED.offline_since, tuned = EXCLUDED.tuned, updated_at = now()`;
  },
  async log(site: string, action: string, detail: unknown) {
    try { await ensureSchema(); await client()`INSERT INTO av_activity (site, action, detail) VALUES (${site}, ${action}, ${JSON.stringify(detail ?? null)}::jsonb)`; } catch { /* logging never blocks control */ }
  },
  async recent(site: string, limit = 50) {
    await ensureSchema();
    return client()`SELECT id, at, action, detail FROM av_activity WHERE site = ${site} ORDER BY at DESC LIMIT ${limit}`;
  },
};
