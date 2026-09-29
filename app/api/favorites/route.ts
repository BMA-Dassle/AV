// Star or unstar a channel for this venue: { num, on } -> the venue's favorites in order.
import { withSite, json } from "@/lib/server/api";
import { DEFAULT_FAVORITES, channelFor } from "@/lib/server/channels";
import { hasStore, store } from "@/lib/server/store";
import { HttpError } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __favs?: Map<string, number[]> };
const mem = (g.__favs ??= new Map());

export const POST = withSite(async (req, site) => {
  const body = await req.json().catch(() => ({}));
  const num = Number(body?.num); const on = Boolean(body?.on);
  if (!Number.isInteger(num) || num <= 0) throw new HttpError("num must be a channel number", 400);
  const slug = site.site.site.slug;
  const cur: number[] = (hasStore() ? await store.loadFavorites(slug) : mem.get(slug)) ?? [...DEFAULT_FAVORITES];
  const next = on ? (cur.includes(num) ? cur : [...cur, num]) : cur.filter((n) => n !== num);
  if (hasStore()) await store.saveFavorites(slug, next); else mem.set(slug, next);
  return json({ favorites: next.map(channelFor), favoriteNums: next, custom: true });
});
