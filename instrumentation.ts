// Runs once when the Node server starts (Next.js instrumentation hook): start every site's box poller
// and reconcile the TV picture from the decoders, so the first tablet to open the page sees live data.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { siteStates } = await import("./lib/server/state");
    for (const s of siteStates.values()) s.start();
  }
}
