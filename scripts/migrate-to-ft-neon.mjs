#!/usr/bin/env node
// Copies the AV app's tables from its old Neon database into the FastTrax Neon database.
// Safe to run more than once: rows are upserted by primary key, so run it again at cutover to pick up
// anything production wrote in between. Never prints connection strings.
//
//   SOURCE_DATABASE_URL=<old AV Neon> TARGET_DATABASE_URL=<FastTrax Neon> node scripts/migrate-to-ft-neon.mjs [--dry-run]
import { neon } from "@neondatabase/serverless";

const src = process.env.SOURCE_DATABASE_URL, dst = process.env.TARGET_DATABASE_URL;
if (!src || !dst) { console.error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL"); process.exit(1); }
if (src === dst) { console.error("Source and target are the same database"); process.exit(1); }
const dry = process.argv.includes("--dry-run");
const S = neon(src), T = neon(dst);
const host = (u) => { try { return new URL(u).host.replace(/^([^.]+).*/, "$1…"); } catch { return "?"; } };

// Same DDL as lib/server/store.ts and lib/server/schedule.ts (CREATE IF NOT EXISTS, so the app agrees).
const DDL = [
  `CREATE TABLE IF NOT EXISTS av_tv_state (site text NOT NULL, tv_id text NOT NULL, source_id text, power boolean, changed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site, tv_id))`,
  `CREATE TABLE IF NOT EXISTS av_box_state (site text NOT NULL, box_id text NOT NULL, online boolean, error text, offline_since timestamptz, tuned jsonb, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site, box_id))`,
  `CREATE TABLE IF NOT EXISTS av_activity (id bigserial PRIMARY KEY, site text NOT NULL, at timestamptz NOT NULL DEFAULT now(), action text NOT NULL, detail jsonb)`,
  `CREATE INDEX IF NOT EXISTS av_activity_site_at ON av_activity (site, at DESC)`,
  `CREATE TABLE IF NOT EXISTS av_wall_state (site text NOT NULL, wall_id text NOT NULL, mode text, source_id text, tile_sources jsonb, changed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site, wall_id))`,
  `CREATE TABLE IF NOT EXISTS av_favorites (site text PRIMARY KEY, nums integer[] NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS av_guide_cache (lineup text NOT NULL, win_from bigint NOT NULL, win_to bigint NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), blob text NOT NULL, PRIMARY KEY (lineup, win_from))`,
  `CREATE TABLE IF NOT EXISTS av_guide_calls (month text PRIMARY KEY, calls integer NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS av_schedule (id bigserial PRIMARY KEY, site text NOT NULL, run_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending', actions jsonb NOT NULL, label text, program jsonb, created_at timestamptz NOT NULL DEFAULT now(), created_by text, ran_at timestamptz, claimed_at timestamptz, result jsonb, error text)`,
  `CREATE INDEX IF NOT EXISTS av_schedule_due ON av_schedule (site, status, run_at)`,
];
const TABLES = [
  { name: "av_tv_state", pk: ["site", "tv_id"] },
  { name: "av_box_state", pk: ["site", "box_id"] },
  { name: "av_activity", pk: ["id"], serial: true },
  { name: "av_wall_state", pk: ["site", "wall_id"] },
  { name: "av_favorites", pk: ["site"] },
  { name: "av_guide_cache", pk: ["lineup", "win_from"] },
  { name: "av_guide_calls", pk: ["month"] },
  { name: "av_schedule", pk: ["id"], serial: true },
];

console.log(`Source ${host(src)}  ->  target ${host(dst)}${dry ? "  (dry run)" : ""}`);
const existing = await T.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'av\\_%'`);
console.log("AV tables already in target:", existing.map((r) => r.table_name).join(", ") || "none");
const srcTables = new Set((await S.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'av\\_%'`)).map((r) => r.table_name));
if (!dry) for (const d of DDL) await T.query(d);

for (const t of TABLES) {
  if (!srcTables.has(t.name)) { console.log(`${t.name.padEnd(16)} not in source, created empty`); continue; }
  const cols = (await S.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [t.name])).map((r) => r.column_name);
  const rows = await S.query(`SELECT * FROM ${t.name}`);
  let copied = 0;
  if (!dry) {
    const q = cols.map((c) => `"${c}"`).join(", ");
    const upd = cols.filter((c) => !t.pk.includes(c)).map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      await T.query(`INSERT INTO ${t.name} (${q}) SELECT ${q} FROM json_populate_recordset(NULL::${t.name}, $1::json) ON CONFLICT (${t.pk.join(", ")}) DO ${upd ? `UPDATE SET ${upd}` : "NOTHING"}`, [JSON.stringify(batch)]);
      copied += batch.length;
    }
    if (t.serial) await T.query(`SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${t.name}), 1))`);
  }
  const [{ n }] = dry ? [{ n: "-" }] : await T.query(`SELECT count(*)::int AS n FROM ${t.name}`);
  console.log(`${t.name.padEnd(16)} source ${String(rows.length).padStart(6)}  copied ${String(copied).padStart(6)}  target now ${n}`);
}
console.log(dry ? "Dry run done; nothing written." : "Migration done.");
