// Server-sent events: one snapshot per change. Works on an always-on host; on a serverless host the
// connection ends at the function timeout and the page falls back to polling /api/state.
import { withSite } from "@/lib/server/api";
import type { Snapshot } from "@/lib/server/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (req, site) => {
  site.start();
  const enc = new TextEncoder();
  let send: ((s: Snapshot) => void) | null = null;
  let ping: NodeJS.Timeout | null = null;
  const stream = new ReadableStream({
    start(controller) {
      send = (s) => { try { controller.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`)); } catch { /* closed */ } };
      send(site.snapshot());
      site.events.on("change", send);
      ping = setInterval(() => { try { controller.enqueue(enc.encode(": ping\n\n")); } catch { /* closed */ } }, 25000);
      req.signal.addEventListener("abort", () => { if (send) site.events.off("change", send); if (ping) clearInterval(ping); try { controller.close(); } catch { /* already closed */ } });
    },
    cancel() { if (send) site.events.off("change", send); if (ping) clearInterval(ping); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
});
