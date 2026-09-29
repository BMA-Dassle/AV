// In-memory model of one location's floor: which source is on each TV, what each DirecTV box is tuned to.
// One instance per site, kept as a module singleton (per process; on a serverless host it starts cold per instance).
import { EventEmitter } from "events";
import { cfg, findSite, sites, HttpError, type SiteConfig, type BoxConfig, type TvConfig, type Encoder, type PlanConfig, type WallConfig } from "./config";
import { findChannel } from "./channels";
import { makeMockPandora, makeMockShef, SEED_TVS } from "./mock";
import { pandora as realPandora, type PandoraClient } from "./pandora";
import { shef as realShef, type ShefClient, type Tuned } from "./shef";
import { projector } from "./projector";
import { hasStore, store } from "./store";

export type TunedView = { channel: number; minor: number | null; callsign: string; channelName: string; title: string; episodeTitle: string; startTime: number | null; duration: number | null; isRecording: boolean; at: number; pending?: boolean };
export type BoxView = { id: string; name: string; color: string; receiverId: string | null; online: boolean | null; error: string | null; offlineSince: number | null; tuned: TunedView | null; tvCount: number; configured: boolean; preview: string | null; powerControl: boolean };
export type TvView = { id: string; name: string; zone: string; map?: [number, number]; sourceId: string | null; lastChange: number | null; error: string | null; configured: boolean; display: { kind: string; power: boolean | null } | null; wallId: string | null };
export type WallView = { id: string; name: string; rows: string[][]; mode: "wall" | "screens" | null; sourceId: string | null; busy: boolean; error: string | null };
export type Snapshot = {
  site: { slug: string; name: string; shortName: string; squareLocationIDs: string[]; timezone: string; mock: boolean; time: number; plan: PlanConfig };
  zones: { id: string; name: string }[]; tvs: TvView[]; boxes: BoxView[]; otherSources: { id: string; name: string; kind: string; tvCount: number }[]; walls: WallView[];
};

type TvState = TvConfig & { sourceId: string | null; lastChange: number | null; error: string | null; power: boolean | null };
type BoxState = BoxConfig & { tuned: TunedView | null; online: boolean | null; error: string | null; offlineSince: number | null };
type WallState = WallConfig & { mode: "wall" | "screens" | null; sourceId: string | null; tileSources: Record<string, string | null>; busy: boolean; error: string | null; changedAt: number };

export class SiteState {
  readonly events = new EventEmitter();
  private tvs: Map<string, TvState>;
  private boxes: Map<string, BoxState>;
  private others: Map<string, SiteConfig["otherSources"][number]>;
  private walls: Map<string, WallState>;
  readonly pandora: PandoraClient;
  private shef: ShefClient;
  private via: "pandora" | "shef" | "mock";
  private timer: NodeJS.Timeout | null = null;

  constructor(readonly site: SiteConfig) {
    this.events.setMaxListeners(200);
    this.tvs = new Map(site.tvs.map((t) => [t.id, { ...t, sourceId: cfg.mock ? SEED_TVS[t.id] ?? null : null, lastChange: null, error: null, power: t.display ? (cfg.mock ? true : null) : null }]));
    this.boxes = new Map(site.boxes.map((b) => [b.id, { ...b, tuned: null, online: null, error: null, offlineSince: null }]));
    this.others = new Map(site.otherSources.map((s) => [s.id, s]));
    this.walls = new Map((site.walls || []).map((w) => [w.id, { ...w, mode: cfg.mock ? "wall" : null, sourceId: cfg.mock ? site.boxes[1]?.id ?? null : null, tileSources: {}, busy: false, error: null, changedAt: 0 }]));
    if (cfg.mock) for (const w of this.walls.values()) for (const id of w.rows.flat()) { const t = this.tvs.get(id); if (t) t.sourceId = w.sourceId; }
    this.pandora = cfg.mock ? makeMockPandora() : realPandora;
    this.via = cfg.directvVia;
    this.shef = this.via === "mock" ? makeMockShef(site.boxes) : realShef;
  }

  // ---- Shared store (Neon) ----
  private lastHydrate = 0;
  private hydrating: Promise<void> | null = null;
  // Pull the shared TV -> source / power map and box status written by other instances. Cheap (two selects).
  async hydrate(force = false) {
    if (!hasStore()) return;
    if (!force && Date.now() - this.lastHydrate < 2000) return;
    if (this.hydrating) return this.hydrating;
    this.hydrating = (async () => {
      try {
        const [tvRows, boxRows, wallRows] = await Promise.all([store.loadTvs(this.site.site.slug), store.loadBoxes(this.site.site.slug), this.walls.size ? store.loadWalls(this.site.site.slug) : Promise.resolve([])]);
        for (const r of wallRows) { const w = this.walls.get(r.wall_id); if (!w || w.busy) continue; const at = Date.parse(r.changed_at); if (at >= w.changedAt) { w.mode = (r.mode as any) ?? w.mode; w.sourceId = r.source_id ?? null; w.tileSources = r.tile_sources || {}; w.changedAt = at; } }
        if (tvRows.length) this.ready = true;
        for (const r of tvRows) { const t = this.tvs.get(r.tv_id); if (!t) continue; const at = Date.parse(r.changed_at); if (!t.lastChange || at >= t.lastChange) { t.sourceId = r.source_id ?? null; if (r.power != null) t.power = r.power; t.lastChange = at; } }
        for (const r of boxRows) { const b = this.boxes.get(r.box_id); if (!b) continue; const at = Date.parse(r.updated_at); if (!b.tuned || at > (b.tuned.at || 0)) { b.online = r.online; b.error = r.error; b.offlineSince = r.offline_since ? Date.parse(r.offline_since) : null; if (r.tuned) b.tuned = r.tuned as TunedView; } }
        this.lastHydrate = Date.now();
      } catch (e: any) { console.warn("store hydrate failed:", e?.message); }
    })().finally(() => { this.hydrating = null; });
    return this.hydrating;
  }
  private persistBoxes() {
    if (!hasStore()) return;
    store.saveBoxes(this.site.site.slug, [...this.boxes.values()].map((b) => ({ boxId: b.id, online: b.online, error: b.error, offlineSince: b.offlineSince, tuned: b.tuned }))).catch((e) => console.warn("store saveBoxes failed:", e?.message));
  }
  private log(action: string, detail: unknown) { if (hasStore()) void store.log(this.site.site.slug, action, detail); }

  private shefIp(b: BoxState) { return this.via === "mock" ? `mock:${b.id}` : b.shef?.ip; }
  private locationID() { return this.site.site.squareLocationIDs?.[0] || this.site.site.slug; }
  private friendly(e: any) { const m = String(e?.message || e); return /aborted|abort/i.test(m) ? "no response (timed out)" : /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|fetch failed/i.test(m) ? "unreachable" : /Pandora 404/.test(m) ? "Pandora has no DirecTV endpoints yet (waiting for the Pandora release)" : /Pandora 401/.test(m) ? "Pandora rejected the token" : m; }

  // Preview stream for a box: an explicit URL per box, else <gateway>/api/ws?src=<encoder ip> where the gateway is
  // PREVIEW_GATEWAY, else the site's previewGateway (an on-site go2rtc), else Pandora's hosted one at <PANDORA_BASE>/preview.
  private previewUrl(b: BoxState): string | null {
    if (b.preview) return b.preview;
    const own = process.env.PREVIEW_GATEWAY || this.site.site.previewGateway;
    const gw = own && !/REPLACE_WITH/.test(own) ? own : cfg.mock ? "" : `${cfg.pandora.baseUrl.replace(/\/$/, "")}/preview`;
    // Streams are addressed by the encoder's IP (Pandora's gateway maps it to rtsp://<ip>:8554/ch0/2; docs/go2rtc.yaml uses the same names).
    if (gw && !/REPLACE_WITH/.test(gw) && b.encoder?.ip) return `${gw.replace(/\/$/, "")}/api/ws?src=${encodeURIComponent(b.encoder.ip)}`;
    return null;
  }

  snapshot(): Snapshot {
    const tvs = [...this.tvs.values()].map((t) => ({ id: t.id, name: t.name, zone: t.zone, map: t.map, sourceId: t.sourceId, lastChange: t.lastChange, error: t.error, configured: Boolean(t.decoder?.ip) || cfg.mock, display: t.display ? { kind: t.display.kind, power: t.power } : null, wallId: this.wallOf(t.id)?.id ?? null }));
    const counts: Record<string, number> = {};
    for (const t of tvs) if (t.sourceId) counts[t.sourceId] = (counts[t.sourceId] || 0) + 1;
    const s = this.site.site;
    return {
      site: { slug: s.slug, name: s.name, shortName: s.shortName, squareLocationIDs: s.squareLocationIDs, timezone: s.timezone || cfg.guide.timezone, mock: cfg.mock, time: Date.now(), plan: s.map || { panels: [], tile: [120, 70] } },
      zones: this.site.zones,
      tvs,
      boxes: [...this.boxes.values()].map((b) => ({ id: b.id, name: b.name, color: b.color, receiverId: b.receiverId || null, online: b.online, error: b.error, offlineSince: b.offlineSince, tuned: b.tuned, tvCount: counts[b.id] || 0, configured: Boolean(b.shef?.ip) || this.via !== "shef", preview: this.previewUrl(b), powerControl: Boolean(b.power?.cycleUrl || (b.power?.offUrl && b.power?.onUrl)) })),
      otherSources: [...this.others.values()].filter((o) => cfg.mock || o.encoder?.ip).map((o) => ({ id: o.id, name: o.name, kind: o.kind, tvCount: counts[o.id] || 0 })),
      walls: [...this.walls.values()].map((w) => ({ id: w.id, name: w.name, rows: w.rows, mode: w.mode, sourceId: w.sourceId, busy: w.busy, error: w.error })),
    };
  }
  // A fresh instance knows no screen sources until it has read the decoders or the shared store. Until then it stays
  // quiet: broadcasting its blank floor would wipe every open page to "Off" (seen at Naples on a cold Vercel instance).
  private ready = cfg.mock;
  private emit() { if (this.ready) this.events.emit("change", this.snapshot()); }

  // ---- Boxes (SHEF) ----
  private applyTuned(box: BoxState, raw: Tuned) {
    const ch = findChannel(raw.major);
    box.tuned = {
      channel: raw.major, minor: raw.minor === 65535 ? null : raw.minor,
      callsign: raw.callsign || ch?.callsign || "", channelName: ch?.name || raw.callsign || `Channel ${raw.major}`,
      title: raw.title || "", episodeTitle: raw.episodeTitle || "",
      startTime: raw.startTime || null, duration: raw.duration || null, isRecording: Boolean(raw.isRecording), at: Date.now(),
    };
    box.online = true; box.error = null; box.offlineSince = null;
  }
  private markOffline(box: BoxState, e: any) { if (box.online !== false) box.offlineSince = Date.now(); box.online = false; box.error = this.friendly(e); }

  // Pandora keeps the cached tuned state of every box for a location; one call refreshes all of them.
  // Until the registry store exists on the Pandora side, that call fails and the app reads each box by ip
  // (the addresses come from the site file), which is one call per box through Pandora.
  private registryUsable = true;
  private async refreshViaPandoraByIp() {
    await Promise.all([...this.boxes.values()].map(async (box) => {
      if (!box.shef?.ip) { box.online = null; box.error = "no address configured"; return; }
      try { const r = await this.pandora.directvTuned(box.shef.ip, box.shef.clientAddr || "0"); this.applyTuned(box, (r?.data ?? r) as Tuned); }
      catch (e: any) { this.markOffline(box, e); }
    }));
  }
  private async refreshViaPandora() {
    if (!this.registryUsable) return this.refreshViaPandoraByIp();
    try {
      const r = await this.pandora.directvBoxes(this.locationID());
      const rows: any[] = r?.data?.boxes || [];
      const norm = (x: unknown) => String(x || "").replace(/\s/g, "");
      for (const box of this.boxes.values()) {
        const row = rows.find((x) => x.id === box.id || (box.receiverId && x.receiverId && norm(x.receiverId) === norm(box.receiverId)));
        if (!row) { box.online = null; box.error = "not in the Pandora registry for this location"; continue; }
        if (row.online === false || !row.tuned) { this.markOffline(box, row.error || "no response"); continue; }
        this.applyTuned(box, row.tuned as Tuned);
      }
    } catch (e: any) {
      const st = e?.status;
      if (st === 400 || st === 404 || st === 500) { this.registryUsable = false; setTimeout(() => { this.registryUsable = true; }, 10 * 60000); return this.refreshViaPandoraByIp(); }
      for (const box of this.boxes.values()) { box.online = null; box.error = `Pandora: ${this.friendly(e)}`; }
    }
  }
  private pandoraTune(box: BoxState, major: number) {
    return box.shef?.ip ? this.pandora.directvTuneIp(box.shef.ip, major, box.shef.clientAddr || "0") : this.pandora.directvTune(this.locationID(), box.id, major);
  }
  private pandoraKey(box: BoxState, key: string) {
    return box.shef?.ip ? this.pandora.directvKeyIp(box.shef.ip, key, box.shef.clientAddr || "0") : this.pandora.directvKey(this.locationID(), box.id, key);
  }

  private async refreshBox(box: BoxState) {
    try {
      const ip = this.shefIp(box);
      if (!ip) { box.online = null; box.error = "no SHEF address configured"; return; }
      this.applyTuned(box, await this.shef.getTuned(ip, box.shef?.clientAddr || "0"));
    } catch (e: any) { this.markOffline(box, e); }
  }
  private async refreshOne(box: BoxState) {
    if (this.via === "pandora") { if (!this.registryUsable && box.shef?.ip) { try { const r = await this.pandora.directvTuned(box.shef.ip, box.shef.clientAddr || "0"); this.applyTuned(box, (r?.data ?? r) as Tuned); } catch (e) { this.markOffline(box, e); } this.persistBoxes(); this.emit(); return; } this.lastPoll = 0; await this.refreshAllBoxes(); return; }
    await this.refreshBox(box); this.emit();
  }
  private async sendKeyRaw(box: BoxState, key: string) {
    if (this.via === "pandora") { await this.pandoraKey(box, key); return; }
    const ip = this.shefIp(box);
    if (!ip) throw new HttpError(`${box.name} has no SHEF address configured`, 409);
    await this.shef.processKey(ip, key, "keyPress", box.shef?.clientAddr || "0");
  }
  // One refresh at a time per site, at most once per poll interval, no matter how many tablets are open:
  // concurrent callers share the in-flight refresh; the timer and on-demand reads share the same throttle.
  private lastPoll = 0;
  private inflight: Promise<void> | null = null;
  async refreshAllBoxes() {
    if (this.inflight) return this.inflight;
    this.lastPoll = Date.now();
    const work = this.via === "pandora" ? this.refreshViaPandora() : Promise.all([...this.boxes.values()].map((b) => this.refreshBox(b))).then(() => undefined);
    this.inflight = work.then(() => { this.persistBoxes(); this.emit(); }).finally(() => { this.inflight = null; });
    return this.inflight;
  }
  // Refresh on demand only when the last read is older than the poll interval. On a serverless host there is no
  // timer and each instance holds its own copy, so it also re-reads the decoders on the same cadence: every instance
  // converges on the hardware truth within one interval of any change made through another instance.
  async ensureFresh() {
    await this.hydrate();
    const stale = Date.now() - this.lastPoll > cfg.shef.pollMs;
    const jobs: Promise<unknown>[] = [];
    if (stale) jobs.push(this.refreshAllBoxes());
    else if (this.inflight) jobs.push(this.inflight);   // a refresh started at boot: wait for it so the first read is not empty
    if (!this.timer && Date.now() - this.lastReconcile > cfg.shef.pollMs) jobs.push(this.reconcileTvs());
    await Promise.all(jobs);
  }

  async tuneBox(boxId: string, channel: unknown) {
    const box = this.boxes.get(boxId);
    if (!box) throw new HttpError(`Unknown box ${boxId}`, 404);
    const major = Number(channel);
    if (!Number.isInteger(major) || major < 1 || major > 9999) throw new HttpError("Channel must be 1-9999", 400);
    if (this.via === "pandora") await this.pandoraTune(box, major);
    else {
      const ip = this.shefIp(box);
      if (!ip) throw new HttpError(`${box.name} has no SHEF address configured`, 409);
      await this.shef.tune(ip, major, undefined, box.shef?.clientAddr || "0");
    }
    const ch = findChannel(major);
    box.tuned = { ...(box.tuned || { minor: null, title: "", episodeTitle: "", startTime: null, duration: null, isRecording: false, at: 0 }), channel: major, callsign: ch?.callsign || "", channelName: ch?.name || `Channel ${major}`, title: "", pending: true, at: Date.now() };
    this.emit();
    setTimeout(() => this.refreshOne(box), 1500);
    this.log("box.tune", { box: box.id, channel: major });
    return { box: box.id, channel: major, affectedTvs: [...this.tvs.values()].filter((t) => t.sourceId === boxId).map((t) => t.name) };
  }

  async sendKey(boxId: string, key: string) {
    const box = this.boxes.get(boxId);
    if (!box) throw new HttpError(`Unknown box ${boxId}`, 404);
    await this.sendKeyRaw(box, key);
    setTimeout(() => this.refreshOne(box), 1200);
    this.log("box.key", { box: box.id, key });
    return { box: box.id, key };
  }

  // ---- TVs (Pandora HDTV) ----
  private encoderFor(sourceId: string): Encoder {
    const src = this.boxes.get(sourceId) || this.others.get(sourceId);
    if (!src) throw new HttpError(`Unknown source ${sourceId}`, 404);
    const enc = src.encoder;
    if (!cfg.mock && (!enc?.ip || enc?.devid === "")) throw new HttpError(`${src.name} has no encoder configured`, 409);
    return enc?.ip ? { ip: enc.ip, devid: enc.devid } : { ip: "0.0.0.0", devid: 0 };
  }
  private decoderIp(t: TvState) { return t.decoder?.ip || `mock-${t.id}`; }

  async setTvSource(tvIds: string[], sourceId: string | null, opts: { audio?: boolean; vol?: number; viaWall?: boolean } = {}) {
    let targets = tvIds.map((id) => this.tvs.get(id)).filter((t): t is TvState => Boolean(t));
    if (!targets.length) throw new HttpError("No TVs given", 400);
    const results: { tv: string; ok: boolean; error?: string | null }[] = [];
    if (!opts.viaWall) await this.hydrate(true);   // the wall guard below needs the shared wall state, not this instance's memory
    // Screens of a wall that is showing one picture: the whole wall selected changes the wall; part of it is refused.
    if (!opts.viaWall) {
      for (const w of this.walls.values()) {
        if (w.mode !== "wall") continue;
        const tiles = w.rows.flat(); const picked = targets.filter((t) => tiles.includes(t.id));
        if (!picked.length) continue;
        targets = targets.filter((t) => !tiles.includes(t.id));
        if (picked.length === tiles.length) { results.push(...(await this.setWallSource(w.id, sourceId))); }
        else for (const t of picked) results.push({ tv: t.id, ok: false, error: `part of ${w.name}, which is showing one picture; change the whole wall or switch it to separate screens` });
      }
      if (!targets.length) { this.emit(); return results; }
    }
    const ready = targets.filter((t) => cfg.mock || t.decoder?.ip);
    for (const t of targets) if (!ready.includes(t)) { t.error = "no decoder configured"; results.push({ tv: t.id, ok: false, error: t.error }); }
    if (sourceId === null) {
      if (ready.length) await this.pandora.closeAll({ ips: ready.map((t) => this.decoderIp(t)) });
      for (const t of ready) { t.sourceId = null; t.lastChange = Date.now(); t.error = null; results.push({ tv: t.id, ok: true }); }
      if (hasStore()) await store.saveTvSources(this.site.site.slug, ready.map((t) => ({ tvId: t.id, sourceId: null }))).catch((e) => console.warn("store save failed:", e?.message));
      this.log("tv.off", { tvs: ready.map((t) => t.id) });
      this.emit(); return results;
    }
    const encoder = this.encoderFor(sourceId);
    if (ready.length) {
      try {
        await this.pandora.putSource({ ips: ready.map((t) => this.decoderIp(t)), encoder, audio: opts.audio ?? true, vol: opts.vol });
        for (const t of ready) { t.sourceId = sourceId; t.lastChange = Date.now(); t.error = null; results.push({ tv: t.id, ok: true }); }
      } catch (e: any) {
        // Pandora answers 502 with per-node results when a group partially fails.
        const per: any[] | undefined = e?.body?.error?.results;
        for (const t of ready) {
          const r = Array.isArray(per) ? per.find((x) => x.ip === t.decoder?.ip) : null;
          const ok = r ? Boolean(r.ok) : false;
          if (ok) { t.sourceId = sourceId; t.lastChange = Date.now(); t.error = null; } else t.error = r?.error || e?.message || "error";
          results.push({ tv: t.id, ok, error: t.error });
        }
      }
    }
    const okIds = results.filter((r) => r.ok).map((r) => r.tv);
    if (hasStore() && okIds.length) await store.saveTvSources(this.site.site.slug, okIds.map((id) => ({ tvId: id, sourceId }))).catch((e) => console.warn("store save failed:", e?.message));
    this.log("tv.source", { tvs: okIds, sourceId, failed: results.filter((r) => !r.ok) });
    this.emit(); return results;
  }

  // ---- Recovery ----
  async wakeBox(boxId: string) {
    // A box in standby still answers SHEF; poweron brings the picture back. A crashed box does not answer at all.
    const box = this.boxes.get(boxId);
    if (!box) throw new HttpError(`Unknown box ${boxId}`, 404);
    await this.sendKeyRaw(box, "poweron");
    setTimeout(() => this.refreshOne(box), 2500);
    return { box: box.id, action: "poweron" };
  }
  async retryBox(boxId: string) {
    const box = this.boxes.get(boxId);
    if (!box) throw new HttpError(`Unknown box ${boxId}`, 404);
    // A box that got a new address from DHCP: sweep the site's subnets for its receiverId and follow it.
    let moved: string | null = null;
    const subnets = this.site.site.directvSubnets || [];
    if (this.via === "pandora" && box.receiverId && subnets.length) {
      try {
        const r = await this.pandora.directvDiscover(subnets, [{ id: box.id, receiverId: box.receiverId }]);
        const d = r?.data ?? r; const norm = (s: unknown) => String(s ?? "").replace(/\D/g, "");
        const hit = (d?.receivers || []).find((x: any) => x.boxId === box.id || norm(x.receiverId) === norm(box.receiverId));
        if (hit?.ip && box.shef && hit.ip !== box.shef.ip) { moved = hit.ip; this.log("box.moved", { box: box.id, from: box.shef.ip, to: hit.ip }); box.shef.ip = hit.ip; }
      } catch { /* discovery is best effort */ }
    }
    await this.refreshOne(box);
    return { box: box.id, online: box.online, error: box.error, movedTo: moved };
  }
  // Power-cycle through a switched outlet (PDU / smart plug) configured per box: either one cycleUrl, or offUrl + onUrl with a delay.
  async powerCycle(boxId: string) {
    const box = this.boxes.get(boxId);
    if (!box) throw new HttpError(`Unknown box ${boxId}`, 404);
    const pw = box.power;
    if (this.via === "mock") { box.online = null; box.error = "rebooting (simulated)"; this.emit(); setTimeout(() => { box.online = true; box.error = null; box.offlineSince = null; this.emit(); }, 6000); return { box: box.id, action: "cycle", simulated: true }; }
    if (!pw?.cycleUrl && !(pw?.offUrl && pw?.onUrl)) throw new HttpError(`${box.name} has no power control configured (see config/sites: boxes[].power)`, 501);
    const hit = async (url: string) => { const r = await fetch(url, { method: pw.method || "GET", signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new HttpError(`Power control answered ${r.status}`, 502); };
    if (pw.cycleUrl) await hit(pw.cycleUrl);
    else { await hit(pw.offUrl!); await new Promise((r) => setTimeout(r, pw.delayMs ?? 8000)); await hit(pw.onUrl!); }
    box.online = null; box.error = "rebooting"; this.emit();
    setTimeout(() => this.refreshOne(box), 90000);   // a DirecTV box takes about a minute to come back
    return { box: box.id, action: "cycle" };
  }
  // Move every screen of a box to another box: one already on the same channel, else a free healthy box, else the given target.
  async moveScreens(fromBoxId: string, toBoxId?: string) {
    const from = this.boxes.get(fromBoxId);
    if (!from) throw new HttpError(`Unknown box ${fromBoxId}`, 404);
    const ids = [...this.tvs.values()].filter((t) => t.sourceId === fromBoxId).map((t) => t.id);
    if (!ids.length) return { moved: [], to: null };
    let to = toBoxId ? this.boxes.get(toBoxId) : undefined;
    if (!to) {
      const healthy = [...this.boxes.values()].filter((b) => b.id !== fromBoxId && b.online !== false);
      const counts: Record<string, number> = {}; for (const t of this.tvs.values()) if (t.sourceId) counts[t.sourceId] = (counts[t.sourceId] || 0) + 1;
      to = healthy.find((b) => from.tuned?.channel && b.tuned?.channel === from.tuned.channel) || healthy.find((b) => !counts[b.id]) || healthy.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))[0];
      if (!to) throw new HttpError("No healthy box to move the screens to", 409);
    }
    const results = await this.setTvSource(ids, to.id);
    this.log("box.move", { from: fromBoxId, to: to.id, tvs: ids });
    return { moved: results, to: to.id, toName: to.name, sameChannel: Boolean(from.tuned?.channel && to.tuned?.channel === from.tuned.channel) };
  }

  // ---- Display power (projectors) ----
  async setTvPower(tvIds: string[], on: boolean) {
    const targets = tvIds.map((id) => this.tvs.get(id)).filter((t): t is TvState => Boolean(t && t.display));
    if (!targets.length) throw new HttpError("None of those screens has power control", 400);
    const results = await Promise.all(targets.map(async (t) => {
      const d = t.display!;
      try {
        if (cfg.projectorVia === "mock") await new Promise((r) => setTimeout(r, 300));
        else if (cfg.projectorVia === "direct") await projector.power(d, on);
        else await this.pandora.projectorPower(d.ip, on, d.protocol, d.port);
        t.power = on; t.error = null;
        return { tv: t.id, ok: true };
      } catch (e: any) { t.error = this.friendly(e); return { tv: t.id, ok: false, error: t.error }; }
    }));
    const okIds = results.filter((r) => r.ok).map((r) => r.tv);
    if (hasStore() && okIds.length) await store.saveTvPower(this.site.site.slug, okIds.map((id) => ({ tvId: id, power: on }))).catch((e) => console.warn("store save failed:", e?.message));
    this.log("tv.power", { tvs: okIds, on });
    this.emit();
    return results;
  }

  // ---- Video walls ----
  wallOf(tvId: string): WallState | null { for (const w of this.walls.values()) if (w.rows.some((r) => r.includes(tvId))) return w; return null; }
  private persistWall(w: WallState) {
    if (hasStore()) store.saveWall(this.site.site.slug, { wallId: w.id, mode: w.mode, sourceId: w.sourceId, tileSources: w.tileSources }).catch((e) => console.warn("store saveWall failed:", e?.message));
  }
  private wallTiles(w: WallState) { return w.rows.flat().map((id) => this.tvs.get(id)).filter((t): t is TvState => Boolean(t)); }
  private wallIps(w: WallState) { return this.wallTiles(w).map((t) => this.decoderIp(t)); }
  private async groupCommand(ips: string[], payload: Record<string, unknown>) {
    try { await this.pandora.command(ips, payload); }
    catch (e: any) { const bad = (e?.body?.error?.results || []).filter((x: any) => !x.ok).map((x: any) => x.ip); throw new HttpError(`${payload.cmd} failed on ${bad.join(", ") || "the wall"}: ${e?.message}`, 502); }
  }

  // One picture across the whole wall: every node gets the same window, the size of the wall; each crops its own slice.
  async setWallSource(wallId: string, sourceId: string | null): Promise<{ tv: string; ok: boolean; error?: string | null }[]> {
    const w = this.walls.get(wallId); if (!w) throw new HttpError(`Unknown wall ${wallId}`, 404);
    if (w.mode !== "wall") throw new HttpError(`${w.name} is showing separate screens; pick screens individually or switch it to one picture`, 409);
    const tiles = this.wallTiles(w); const ips = this.wallIps(w);
    const geometry = { x: 0, y: 0, width: w.rows[0].length * w.tile[0], height: w.rows.length * w.tile[1] };
    if (sourceId === null) await this.pandora.closeAll({ ips });
    else await this.pandora.putSource({ ips, encoder: this.encoderFor(sourceId), audio: false, geometry });
    for (const t of tiles) { t.sourceId = sourceId; t.lastChange = Date.now(); t.error = null; }
    w.sourceId = sourceId; w.changedAt = Date.now(); w.error = null;
    if (hasStore()) await store.saveTvSources(this.site.site.slug, tiles.map((t) => ({ tvId: t.id, sourceId }))).catch(() => {});
    this.persistWall(w); this.log("wall.source", { wall: w.id, sourceId }); this.emit();
    return tiles.map((t) => ({ tv: t.id, ok: true }));
  }

  // Switch a wall between one picture ("wall") and independent screens ("screens"), without leaving it blank.
  // Commands mirror what the Allonis driver sends (captured live, docs/VIDEO-WALLS.md), but all nodes at once.
  async setWallMode(wallId: string, mode: "wall" | "screens", sourceId?: string | null) {
    const w = this.walls.get(wallId); if (!w) throw new HttpError(`Unknown wall ${wallId}`, 404);
    if (w.busy) throw new HttpError(`${w.name} is already switching`, 409);
    // Act on what the wall is doing now, not on this instance's memory: a cold instance knew nothing about the
    // wall, restored "nothing" to all six screens and blanked Video Wall 1 (first live split, 2026-09-29).
    await this.hydrate(true);
    if (!cfg.mock) await this.reconcileTvs();
    const tiles = this.wallTiles(w); const ips = this.wallIps(w);
    const [tw, th] = w.tile; const rows = w.rows.length, cols = w.rows[0].length;
    // the source the wall ends up on: asked for, else what the wall had, else what most of its screens show
    const counts: Record<string, number> = {}; for (const t of tiles) if (t.sourceId) counts[t.sourceId] = (counts[t.sourceId] || 0) + 1;
    const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    w.busy = true; w.error = null; this.emit();
    try {
      if (mode === "wall") {
        const src = sourceId !== undefined ? sourceId : w.sourceId ?? common;
        w.tileSources = Object.fromEntries(tiles.map((t) => [t.id, t.sourceId]));   // remembered for switching back
        if (!cfg.mock) {
          await this.groupCommand(ips, { cmd: "deletewall" });
          const allres = w.rows.flatMap((r, ri) => r.map((_, ci) => ({ row: ri, col: ci, width: tw, height: th })));
          await Promise.all(tiles.map(async (t) => {
            const ri = w.rows.findIndex((r) => r.includes(t.id)); const ci = w.rows[ri].indexOf(t.id); const ip = this.decoderIp(t);
            await this.groupCommand([ip], { cmd: "newwall", id: w.wallId, rows, cols, row: ri, col: ci, w: tw, h: th, hz: w.hz ?? 60, ledw: cols * tw, ledh: rows * th, type: 0, timing: 0, multiaddr: w.multiaddr ?? `239.1.1.${w.wallId}`, multPort: w.multPort ?? 1100, allres });
            await this.groupCommand([ip], { cmd: "setprotocol", protocol: 0 });
            await this.groupCommand([ip], { cmd: "setstreamdelay", streamdelay: 80000 });
          }));
        } else await new Promise((r) => setTimeout(r, 1200));
        w.mode = "wall"; w.busy = false;
        if (src) await this.setWallSource(w.id, src); else { w.sourceId = null; this.persistWall(w); }
      } else {
        // each screen goes back to what it showed before the wall, else the wall's picture; never to "off"
        const wallPic = w.sourceId ?? common;
        const back = Object.fromEntries(tiles.map((t) => [t.id, w.tileSources[t.id] ?? wallPic ?? t.sourceId ?? null]));
        if (!cfg.mock) {
          await this.groupCommand(ips, { cmd: "deletewall", id: w.wallId });
          await this.groupCommand(ips, { cmd: "newmatrix" });
          await this.groupCommand(ips, { chn: 0, cmd: "setvoattr", width: tw, height: th, hz: w.hz ?? 60 });
        } else await new Promise((r) => setTimeout(r, 600));
        w.mode = "screens"; w.busy = false; w.sourceId = null;
        // put every screen straight back on a picture (grouped by source) so the wall is never left blank
        const bySource = new Map<string | null, string[]>(); for (const [id, s] of Object.entries(back)) bySource.set(s, [...(bySource.get(s) || []), id]);
        for (const [s, ids] of bySource) if (s) await this.setTvSource(ids, s, { viaWall: true, audio: false });
        this.persistWall(w);
      }
      this.log("wall.mode", { wall: w.id, mode, sourceId: w.sourceId });
      return { wall: w.id, mode: w.mode, sourceId: w.sourceId };
    } catch (e: any) {
      w.error = e?.message || String(e); throw e;
    } finally { w.busy = false; w.changedAt = Date.now(); this.emit(); }
  }

  async tvStatus(tvId: string) {
    const t = this.tvs.get(tvId);
    if (!t) throw new HttpError(`Unknown TV ${tvId}`, 404);
    if (!cfg.mock && !t.decoder?.ip) throw new HttpError("no decoder configured", 409);
    return this.pandora.status(this.decoderIp(t));
  }

  boxConfig(id: string) { return this.site.boxes.find((b) => b.id === id) || null; }

  // Rebuild the TV -> source picture from the decoders (Pandora GET /hdtv/status per decoder) so a restart never shows
  // a blank floor. Each decoder's open window carries the encoder url / devid; match it to a box or source encoder.
  private lastReconcile = 0;
  private reconciling: Promise<void> | null = null;
  async reconcileTvs() {
    if (cfg.mock) return;
    if (this.reconciling) return this.reconciling;
    this.lastReconcile = Date.now();
    this.reconciling = this.reconcileNow().finally(() => { this.reconciling = null; });
    return this.reconciling;
  }
  private async reconcileNow() {
    const byEncoder = new Map<string, string>();
    for (const b of this.boxes.values()) if (b.encoder?.ip) byEncoder.set(`${b.encoder.ip}|${b.encoder.devid}`, b.id);
    for (const o of this.others.values()) if (o.encoder?.ip) byEncoder.set(`${o.encoder.ip}|${o.encoder.devid}`, o.id);
    const byIp = new Map<string, string>();
    for (const [k, id] of byEncoder) byIp.set(k.split("|")[0], id);
    // One group command to every decoder: getwindowinfo lists the open windows with the encoder's stream url.
    // (GET /hdtv/status is not usable: it sends encoder-only getters to decoders and fails on the refusal.)
    const decoders = [...this.tvs.values()].filter((t) => t.decoder?.ip);
    if (!decoders.length) { this.ready = true; return; }
    let results: any[] = [];
    try {
      const r = await this.pandora.command(decoders.map((t) => t.decoder.ip), { cmd: "getwindowinfo" });
      results = r?.data?.results || (r?.data ? [{ ip: decoders[0].decoder.ip, ok: true, reply: r.data }] : []);
    } catch (e: any) {
      // a group call answers 502 with per-node results when some decoders are off; use what came back
      results = e?.body?.error?.results || [];
      if (!results.length) { console.warn("reconcile failed:", e?.message); return; }
    }
    const byDecoder = new Map(results.map((x: any) => [x.ip, x]));
    const changed: { tvId: string; sourceId: string | null }[] = [];
    for (const t of decoders) {
      const x = byDecoder.get(t.decoder.ip);
      if (!x || !x.ok) { t.error = x?.error || "no reply"; continue; }
      const w = x.reply?.data?.list?.[0];
      const ip = w ? String(w.url || "").split(":")[0] : "";
      const src = w ? byEncoder.get(`${ip}|${w.devid}`) || byIp.get(ip) || null : null;
      t.error = null;
      if (src !== t.sourceId) { t.sourceId = src; t.lastChange = Date.now(); changed.push({ tvId: t.id, sourceId: src }); }
    }
    if (hasStore() && changed.length) await store.saveTvSources(this.site.site.slug, changed).catch((e) => console.warn("store save failed:", e?.message));
    await this.reconcileWalls(byDecoder, byEncoder, byIp);
    this.ready = true;
    this.emit();
  }

  // A wall is in "wall" mode when every node stores this wall (getwall: id, rows, cols) and shows one window the size of the wall.
  private async reconcileWalls(windows: Map<any, any>, byEncoder: Map<string, string>, byIp: Map<string, string>) {
    for (const w of this.walls.values()) {
      if (w.busy) continue;
      const tiles = w.rows.flat().map((id) => this.tvs.get(id)).filter((t): t is TvState => Boolean(t?.decoder?.ip));
      if (!tiles.length) continue;
      let walls: any[] = [];
      try { const r = await this.pandora.command(tiles.map((t) => t.decoder.ip), { cmd: "getwall" }); walls = r?.data?.results || []; }
      catch (e: any) { walls = e?.body?.error?.results || []; }
      const byNode = new Map(walls.map((x: any) => [x.ip, x]));
      const inWall = tiles.every((t) => { const x = byNode.get(t.decoder.ip); return x?.ok && Number(x.reply?.id) === w.wallId && Number(x.reply?.rows) === w.rows.length; });
      const ledw = w.rows[0].length * w.tile[0];
      const wins = tiles.map((t) => windows.get(t.decoder.ip)?.reply?.data?.list?.[0]);
      const spanning = wins.every((x) => x && Number(x.width) === ledw);
      const mode: "wall" | "screens" = inWall ? "wall" : "screens";
      let src: string | null = null;
      if (inWall && spanning) { const ip = String(wins[0].url || "").split(":")[0]; src = byEncoder.get(`${ip}|${wins[0].devid}`) || byIp.get(ip) || null; }
      if (mode !== w.mode || (mode === "wall" && src !== w.sourceId)) { w.mode = mode; if (mode === "wall") w.sourceId = src; w.changedAt = Date.now(); this.persistWall(w); }
    }
  }

  // Each tick also pulls the shared store, and re-reads the decoders every 30 s: an instance holding a live feed open
  // must not keep broadcasting its own old picture of the floor (Video Wall 1 flipped back to "Wall" that way).
  start() {
    if (this.timer) return;
    void this.hydrate(true).then(() => this.refreshAllBoxes()); void this.reconcileTvs();
    this.timer = setInterval(async () => {
      await this.hydrate();
      if (!cfg.mock && Date.now() - this.lastReconcile > 30000) void this.reconcileTvs();
      await this.refreshAllBoxes();
    }, cfg.shef.pollMs);
    this.timer.unref?.();
  }
}

// Module-level singleton so API routes share state within a process (Next dev/prod server, or a warm serverless instance).
const g = globalThis as unknown as { __avSites?: Map<string, SiteState> };
if (!g.__avSites) { g.__avSites = new Map(sites.map((s) => [s.site.slug, new SiteState(s)])); }
export const siteStates = g.__avSites;

export function siteFor(key?: string | null): SiteState | null {
  const s = findSite(key);
  return s ? siteStates.get(s.site.slug) || null : null;
}
