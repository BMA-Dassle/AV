# HeadPinz AV Control

Bartender-facing TV control for HeadPinz / FastTrax venues. Replaces the Allonis "Head Pinz" TV page. Next.js 15 (App Router, TypeScript): API route handlers plus a React front end in the Team Member Portal style. Production URL: **av.headpinz.com**, one deployment for every store, the store chosen by URL: `?location=HPFM` (HeadPinz Fort Myers), `?location=FT` (FastTrax), `?location=HPN` (HeadPinz Naples). A Square location id works in place of the slug. FT and HPN are scaffolds until their TV lists are added to `config/sites/`.

Two screens: **TVs** (the real floor plan, tap screens then pick what they show; tap a box to change its channel with a live preview) and **Guide** (what's on, from TV Media, routed to screens).

## Run locally

```bash
npm install
copy .env.example .env.local  # set APP_TOKENS, TVMEDIA_API_KEY, PANDORA_TOKEN; keep MOCK=1 until Pandora's DirecTV endpoints are live
npm run mock                  # http://localhost:3000/?location=HPFM&token=<APP_TOKENS value>
npm run build && npm start    # production build
```

The page stores the token after the first visit, so tablets only need the token in the link once.

## Layout

| Path | What |
|---|---|
| `app/page.tsx`, `components/*` | The page: `AVControl` (state, live updates, actions), `BoxesStrip`, `FloorMap`, `SelectionBar`, `BoxDialog` + `Preview`, `GuidePage`, `Recovery`, `Toasts`. |
| `app/globals.css` | Portal tokens and component styles. |
| `app/api/**/route.ts` | Route handlers (see API below). |
| `lib/server/*` | `config` (env + sites), `state` (per-site floor model, poller, recovery, reconcile), `pandora`, `shef`, `guide` (TV Media + mock), `channels`, `mock`, `api` (auth + site resolution). |
| `lib/client/*` | Browser API client (token + location from the URL), view model, floor-plan geometry. |
| `config/sites/*.json` | One file per location: TVs with plan positions and decoder IPs, boxes (receiver id, SHEF IP, encoder, optional `power` outlet URLs), sources, zones, guide lineup, preview gateway, DirecTV subnets. |
| `instrumentation.ts` | Starts every site's poller when the server boots (always-on hosts). |
| `railway.toml` | Railway deployment (recommended host). |
| `docs/` | Research, Pandora `/v2/directv` spec with bring-up results and receiver ids, guide providers, preview gateway, the original mockup files. |
| `research/` | Captures from the old controller and the API spec (large dumps are git-ignored). |

## API (all under `/api`, `Authorization: Bearer <token>` or `?token=`)

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | Unauthenticated. |
| GET | `/locations` | Sites this deployment serves. |
| GET | `/state?location=` | Zones, TVs with `sourceId` and map position, boxes with `tuned` and `preview`, other sources. |
| GET | `/events?location=&token=` | Server-sent events (always-on host only). |
| POST | `/tvs/source` | `{ tvIds, sourceId | null }` |
| POST | `/boxes/:id/tune` | `{ channel }` |
| POST | `/boxes/:id/key` | `{ key }` (SHEF key names) |
| POST | `/walls/:id/mode` | `{ mode: wall \| screens, sourceId? }` (video walls; docs/VIDEO-WALLS.md) |
| POST | `/walls/:id/source` | `{ sourceId }` (wall showing one picture) |
| POST | `/boxes/:id/recover` | `{ action: retry \| wake \| cycle \| move, toBoxId? }` |
| GET | `/guide?from=&hours=&filter=` | Programs per channel for the site's lineup. |
| GET/POST | `/admin/...` | Decoder status, AV scan, SHEF diagnostics. |

## Hosting and load

**Railway (recommended):** one always-on container (`railway.toml`). Server-sent events push every change to every open tablet within a second; the box poller runs every 10 s; the floor state is one copy. Point av.headpinz.com at it.

**Vercel:** builds and runs, but functions are not always-on, so the page falls back to polling every 3 s, and each function instance keeps its own copy of the floor state until it re-reads the hardware. Fine for a demo, not for the bar.

**Upstream load is independent of how many tablets are open.** Boxes: one refresh per site per 10 s, shared by all callers. Pandora: only on actions and at boot (reconcile from the decoders). TV Media: one 6-hour window per hour per lineup, cached, hard monthly cap. Previews: only while a box dialog is open, direct from the LAN gateway.

**Box recovery:** offline boxes show a banner with time down and affected screens. The box dialog offers Retry, Wake (SHEF power-on), Power cycle (when `boxes[].power` outlet URLs are configured) and one-tap Move screens to a box already on the same channel or a free one.

## Status / next

- Pandora `/v2/directv/*` is built on branch `feat/directv-shef` and verified against the real boxes; pending push, the Azure-side route check, the `directvBoxes` Square attribute, and encoder ids from `/hdtv/scan`.
- Box identity: key by `receiverId` (from SHEF `getVersion`), not IP; see the spec.
- Previews need the on-site go2rtc gateway.
