import { withSite, json } from "@/lib/server/api";
import { CHANNELS, favorites } from "@/lib/server/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async () => json({ favorites: favorites(), all: CHANNELS }));
