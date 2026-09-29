// The channel catalog plus this venue's favorites (kept in our own database; defaults until someone stars a channel).
import { withSite, json } from "@/lib/server/api";
import { CHANNELS, DEFAULT_FAVORITES, channelFor } from "@/lib/server/channels";
import { hasStore, store } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withSite(async (_req, site) => {
  const saved = hasStore() ? await store.loadFavorites(site.site.site.slug).catch(() => null) : null;
  const nums = saved ?? DEFAULT_FAVORITES;
  return json({ favorites: nums.map(channelFor), favoriteNums: nums, custom: Boolean(saved), all: CHANNELS });
});
