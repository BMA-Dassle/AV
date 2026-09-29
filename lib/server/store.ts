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
      await q`CREATE TABLE IF NOT EXISTS av_favorites (site text PRIMARY KEY, nums integer[] NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
      await q`CREATE TABLE IF NOT EXISTS av_guide_cache (lineup text NOT NULL, win_from bigint NOT NULL, win_to bigint NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), blob text NOT NULL, PRIMARY KEY (lineup, win_from))`;
      await q`CREATE TABLE IF NOT EXISTS av_guide_calls (month text PRIMARY KEY, calls integer NOT NULL DEFAULT 0)`;
      await q`CREATE TABLE IF NOT EXISTS av_wall_state (site text NOT NULL, wall_id text NOT NULL, mode text, source_id text, tile_sources jsonb, changed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site, wall_id))`;
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
  async loadWalls(site: string): Promise<{ wall_id: string; mode: string | null; source_id: string | null; tile_sources: Record<string, string | null> | null; changed_at: string }[]> {
    await ensureSchema();
    return (await client()`SELECT wall_id, mode, source_id, tile_sources, changed_at FROM av_wall_state WHERE site = ${site}`) as any;
  },
  async saveWall(site: string, w: { wallId: string; mode: string | null; sourceId: string | null; tileSources: Record<string, string | null> }) {
    await ensureSchema();
    await client()`INSERT INTO av_wall_state (site, wall_id, mode, source_id, tile_sources, changed_at) VALUES (${site}, ${w.wallId}, ${w.mode}, ${w.sourceId}, ${JSON.stringify(w.tileSources)}::jsonb, now()) ON CONFLICT (site, wall_id) DO UPDATE SET mode = EXCLUDED.mode, source_id = EXCLUDED.source_id, tile_sources = EXCLUDED.tile_sources, changed_at = now()`;
  },
  // Channel favorites per venue (the box dialog's Favorites tab); null when the venue has not picked any yet.
  async loadFavorites(site: string): Promise<number[] | null> {
    await ensureSchema();
    const r = (await client()`SELECT nums FROM av_favorites WHERE site = ${site}`) as { nums: number[] }[];
    return r[0]?.nums ?? null;
  },
  async saveFavorites(site: string, nums: number[]) {
    await ensureSchema();
    await client()`INSERT INTO av_favorites (site, nums, updated_at) VALUES (${site}, ${nums}, now()) ON CONFLICT (site) DO UPDATE SET nums = EXCLUDED.nums, updated_at = now()`;
  },
  // Guide listings shared by every instance, so the TV Media call budget is spent once per window, not per instance.
  async loadGuideWindow(lineup: string, from: number, to: number, maxAgeMs: number): Promise<{ from: number; to: number; fetchedAt: number; blob: string } | null> {
    await ensureSchema();
    const since = new Date(Date.now() - maxAgeMs).toISOString();
    const r = (await client()`SELECT win_from, win_to, fetched_at, blob FROM av_guide_cache WHERE lineup = ${lineup} AND win_from <= ${from} AND win_to >= ${to} AND fetched_at >= ${since} ORDER BY fetched_at DESC LIMIT 1`) as any[];
    return r[0] ? { from: Number(r[0].win_from), to: Number(r[0].win_to), fetchedAt: Date.parse(r[0].fetched_at), blob: r[0].blob } : null;
  },
  async saveGuideWindow(lineup: string, from: number, to: number, blob: string) {
    await ensureSchema();
    const q = client();
    await q`INSERT INTO av_guide_cache (lineup, win_from, win_to, fetched_at, blob) VALUES (${lineup}, ${from}, ${to}, now(), ${blob}) ON CONFLICT (lineup, win_from) DO UPDATE SET win_to = EXCLUDED.win_to, fetched_at = now(), blob = EXCLUDED.blob`;
    await q`DELETE FROM av_guide_cache WHERE lineup = ${lineup} AND fetched_at < now() - interval '2 days'`;
  },
  async bumpGuideCalls(month: string): Promise<number> {
    await ensureSchema();
    const r = (await client()`INSERT INTO av_guide_calls (month, calls) VALUES (${month}, 1) ON CONFLICT (month) DO UPDATE SET calls = av_guide_calls.calls + 1 RETURNING calls`) as { calls: number }[];
    return r[0]?.calls ?? 0;
  },
  async guideCalls(month: string): Promise<number> {
    await ensureSchema();
    const r = (await client()`SELECT calls FROM av_guide_calls WHERE month = ${month}`) as { calls: number }[];
    return r[0]?.calls ?? 0;
  },
  async log(site: string, action: string, detail: unknown) {
    try { await ensureSchema(); await client()`INSERT INTO av_activity (site, action, detail) VALUES (${site}, ${action}, ${JSON.stringify(detail ?? null)}::jsonb)`; } catch { /* logging never blocks control */ }
  },
  async recent(site: string, limit = 50) {
    await ensureSchema();
    return client()`SELECT id, at, action, detail FROM av_activity WHERE site = ${site} ORDER BY at DESC LIMIT ${limit}`;
  },
};
