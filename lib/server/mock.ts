// Simulated hardware so the app runs anywhere. Seeded from a live snapshot of the Fort Myers controller (2026-09-28).
import { CHANNELS, findChannel } from "./channels";
import type { PandoraClient } from "./pandora";
import type { ShefClient, Tuned } from "./shef";
import type { BoxConfig } from "./config";

const SEED_BOXES: Record<string, { channel: number; title: string }> = {
  dtv1: { channel: 9562, title: "IndyCar Racing - Music City Grand Prix" },
  dtv2: { channel: 9561, title: "NFL Football - Ravens at Bills" },
  dtv3: { channel: 9561, title: "NFL Football - Ravens at Bills" },
  dtv4: { channel: 9559, title: "NFL Football - Dolphins at Jets" },
  dtv5: { channel: 9565, title: "NFL Football - Chiefs at Chargers" },
  dtv6: { channel: 218, title: "College Football - Louisiana-Monroe at Alabama" },
  dtv7: { channel: 618, title: "MLB Baseball - Dodgers at Yankees" },
  dtv8: { channel: 20, title: "Sunday Night Football pregame" },
};
export const SEED_TVS: Record<string, string | null> = {
  "bar-1": "dtv7", "bar-2": "dtv6", "bar-3": "dtv8", "bar-4": "dtv8", "bar-5": "dtv7", "bar-6": "dtv5", "bar-7": "dtv7", "bar-8": "dtv6", "bar-9": "dtv8", "bar-10": "dtv7", "bar-11": "dtv8",
  "pool-1": "dtv7", "pool-2": "dtv6", "pool-3": "dtv7", "pool-4": "dtv8", "pool-5": "dtv7",
  "axe-1": "dtv8", "axe-2": "dtv7", "axe-3": "dtv8", "axe-4": "dtv7",
  "patio-1": "dtv7", "patio-2": "dtv5", "patio-3": "dtv7", "patio-4": "dtv8",
  "terrace-1": "dtv7", "terrace-2": "dtv8", "terrace-3": "dtv7", "terrace-4": "dtv5",
  "vip-1": "dtv7", "vip-2": "dtv6", "vip-3": "dtv7",
  "proj-1": "dtv8", "proj-2": "music1", "proj-3": "dtv8", "proj-4": "dtv8", "proj-5": "music1", "proj-6": "dtv8",
  "neo-1": "dtv7", "neo-2": "dtv7", "neo-3": "dtv7", "neo-4": "dtv7",
  "shuffly-1": "dtv8", "shuffly-2": "dtv7", "shuffly-3": "dtv7",
  meeting: "dtv7", frontdesk: null,
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The mock SHEF is keyed by box id rather than ip; state.ts passes `mock:<boxId>` as the ip.
export function makeMockShef(boxes: BoxConfig[]): ShefClient {
  const tuned: Record<string, { channel: number; title: string }> = {};
  for (const b of boxes) tuned[b.id] = { ...(SEED_BOXES[b.id] || { channel: 206, title: "SportsCenter" }) };
  const id = (ip: string) => ip.replace(/^mock:/, "");
  const api: ShefClient = {
    async getTuned(ip) {
      await delay(40);
      const t = tuned[id(ip)]; const ch = findChannel(t.channel);
      return { major: t.channel, minor: 65535, callsign: ch?.callsign || "", title: t.title, episodeTitle: "", startTime: Math.floor(Date.now() / 1000) - 1500, duration: 10800 } as Tuned;
    },
    async tune(ip, major) {
      await delay(200);
      const ch = findChannel(major);
      tuned[id(ip)] = { channel: Number(major), title: ch ? `Live on ${ch.name}` : `Channel ${major}` };
      return { status: { code: 200, commandResult: 0, msg: "OK" } };
    },
    async processKey(ip, key) {
      await delay(60);
      if (key === "chanup" || key === "chandown") {
        const t = tuned[id(ip)]; const list = CHANNELS.map((c) => c.num).sort((a, b) => a - b);
        const i = Math.max(0, list.indexOf(t.channel)); const n = list[(i + (key === "chanup" ? 1 : -1) + list.length) % list.length];
        await api.tune(ip, n);
      }
      return { key, hold: "keyPress", status: { code: 200, commandResult: 0, msg: "OK" } };
    },
    async getProgInfo(ip, major) { const ch = findChannel(major); return { major, minor: 65535, callsign: ch?.callsign || "", title: ch ? `Now on ${ch.name}` : "", duration: 3600 }; },
    async getVersion() { return { receiverId: "0000 0000 0000", stbSoftwareVersion: "mock", version: "2.5" }; },
    async getOptions() { return {}; },
    async mode() { return { mode: 0 }; },
    async getLocations() { return { locations: [{ locationName: "mock", clientAddr: "0" }] }; },
  };
  return api;
}

export function makeMockPandora(): PandoraClient {
  return {
    async putSource() { await delay(150); return { success: true, data: { window: { cmd: "openwindow", code: 0 }, audio: { cmd: "openaudio", code: 0 } } }; },
    async closeAll() { await delay(100); return { success: true, data: { cmd: "closewindow", code: 0 } }; },
    async setVolume() { await delay(50); return { success: true, data: { cmd: "setvol", code: 0 } }; },
    async status() { await delay(50); return { success: true, data: { id: 1, input: { width: 1920, height: 1080, fps: 60, status: 1 }, windows: [], audio: { url: "", vol: 60, status: 1, mute: 0, id: 0 }, ops: { cpu: "12%" } } }; },
    async scan() { await delay(1500); return { success: true, data: { method: "multicast", count: 0, devices: [], scannedAt: new Date().toISOString() } }; },
    async devices() { return { success: true, data: { method: "none", count: 0, devices: [] } }; },
    async directvBoxes() { return { success: true, data: { boxes: [] } }; },
    async directvTune() { return { success: true, data: {} }; },
    async directvKey() { return { success: true, data: {} }; },
    async directvDiscover() { return { success: true, data: { receivers: [] } }; },
    async directvTuned() { return { success: true, data: { major: 206, minor: 65535, callsign: "ESPN", title: "SportsCenter" } }; },
    async directvTuneIp() { return { success: true, data: {} }; },
    async directvKeyIp() { return { success: true, data: {} }; },
    async projectorPower() { await delay(300); return { success: true, data: { reply: "P" } }; },
    async projectorStatus() { return { success: true, data: { on: true } }; },
  };
}
