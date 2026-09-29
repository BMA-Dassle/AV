# HeadPinz AV Control

Bartender-facing TV control for HeadPinz / FastTrax venues. Replaces the Allonis "Head Pinz" TV page. Node + Express API with a single-page front end in the Team Member Portal style. Production URL: **av.headpinz.com**, one deployment for every store, the store chosen by URL: `https://av.headpinz.com/?location=fort-myers` (a Square location id works too).

Two screens: **TVs** (the real floor plan, tap screens then pick what they show; tap a box to change its channel with a live preview) and **Guide** (what's on, from TV Media, routed to screens).

## Run locally

```bash
npm install
copy .env.example .env        # set APP_TOKENS and TVMEDIA_API_KEY; keep MOCK=1 until Pandora's DirecTV endpoints are live
npm run build:mockup          # builds public/index.html (and the shareable mockup files) from docs/mockup.src.html + docs/app.js
npm run mock                  # http://localhost:3000/?location=fort-myers&token=<APP_TOKENS value>
```

The page stores the token after the first visit, so tablets only need the token in the link once.

## Layout

| Path | What |
|---|---|
| `docs/mockup.src.html`, `docs/app.js` | Front-end source (markup+CSS, and the script with the data layer). `npm run build:mockup` inlines images and the script into `public/index.html`, `docs/mockup.html` (artifact) and `docs/HeadPinz-TV-Control-mockup.html` (standalone). |
| `config/sites/*.json` | One file per location: TVs with floor-plan positions and decoder IPs, DirecTV boxes (SHEF IP, receiver id, encoder), other sources, zones, guide lineup, preview gateway. |
| `src/config.js` | Env + all sites. `findSite(slug or Square location id)`. |
| `src/state.js` | Per-site floor model: TV -> source, box -> channel; polls boxes; emits changes. |
| `src/routes.js` | `/api/*`: bearer auth, `?location=` resolution, state, SSE, source/tune/key, guide, diagnostics. |
| `src/pandora.js` | Pandora `/hdtv/*` client (the AV-over-IP matrix). |
| `src/shef.js` | DirecTV SHEF client (used directly on an on-site host; on Vercel the DirecTV calls go through Pandora's `/directv/*`). |
| `src/guide.js` | Guide providers: `tvmedia` (live, cached, capped) and `mock`. |
| `server.js` | Always-on host (SSE, box poller). `api/index.js` + `vercel.json`: Vercel serverless host (polling fallback). |
| `docs/RESEARCH.md` | Findings on the old page, Pandora HDTV API, SHEF, guide gap. |
| `docs/PANDORA-DIRECTV-SPEC.md` | The Pandora `/v2/directv/*` spec, agreed plan, bring-up results, IP and receiver-id mapping. |
| `docs/GUIDE-PROVIDERS.md` | Guide provider comparison; TV Media decision and verification. |
| `docs/PREVIEW-GATEWAY.md` | Box preview direct from the LAN via go2rtc. |
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
| GET | `/guide?from=&hours=&filter=` | Programs per channel for the site's lineup. |
| GET/POST | `/admin/...` | Decoder status, AV scan, SHEF diagnostics. |

## Deploying to Vercel

`vercel.json` serves `public/` and routes `/api/*` to `api/index.js`. Set the environment variables from `.env.example` in the Vercel project. SSE is not available on Vercel; the page polls every 10 s instead. Box and TV state will come from Pandora's cached endpoints once `/v2/directv/*` is deployed, which is what makes this host stateless.

## Status / next

- Pandora `/v2/directv/*` is built on branch `feat/directv-shef` and verified against the real boxes; pending push, the Azure-side route check, the `directvBoxes` Square attribute, and encoder ids from `/hdtv/scan`.
- Box identity: key by `receiverId` (from SHEF `getVersion`), not IP; see the spec.
- Previews need the on-site go2rtc gateway.
