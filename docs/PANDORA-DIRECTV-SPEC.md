# Pandora: DirecTV set-top box control (spec)

Written for the Pandora API maintainers. Goal: let the TV control app (cloud-hosted, no LAN access) read and change what each DirecTV receiver at a venue is tuned to, through Pandora, the way `/v2/hdtv/*` already drives the AV-over-IP nodes.

Findings are from the Pandora_API repo (`src/utils/hdtv.utils.ts`, `docs/hdtv-json-control.md`, `qsys/README.md`, `src/utils/qsys.utils.ts`), the DirecTV SHEF spec (DTV-MD-0359 rev 1.3.C), and a live capture of the Fort Myers Allonis controller on 2026-09-28.

## 1. What the boxes speak

DirecTV receivers (H21/HR20 and newer, including H25, H44, HR44, HR54, HS17 Genie) expose **SHEF**, a plain HTTP JSON API on **port 8080** of the box's LAN address. No auth. Must be enabled once per box: Menu > Settings > Whole-Home > External Device > External Access: **Allow**. Fort Myers has 8 boxes (DTV 1-8) already driven by the Allonis "DirecTV" driver, so SHEF is presumably enabled on all of them.

| SHEF call | Purpose | Notes |
|---|---|---|
| `GET /tv/getTuned?clientAddr=0` | Current channel: `major`, `minor` (65535 = none), `callsign`, `title`, `episodeTitle`, `startTime`, `duration`, `isRecording`, `rating`, `programId` | The read we poll |
| `GET /tv/tune?major=618[&minor=][&clientAddr=]` | Change channel | 500 + `commandResult: 1` "Request conflict" if the box is busy |
| `GET /remote/processKey?key=chanup&hold=keyPress[&clientAddr=]` | Remote key | keys: power poweron poweroff format pause rew replay stop advance ffwd record play guide active list exit back menu info up down left right select red green yellow blue chanup chandown prev 0-9 dash enter |
| `GET /tv/getProgInfo?major=&minor=&time=` | What is on a channel now or up to 2 h ahead | Same fields as getTuned |
| `GET /info/getLocations` | Genie server: lists mini clients and their `clientAddr` (MAC hex, no colons) | Pass `clientAddr` on tune/getTuned/processKey to address a client; `0` = the server itself |
| `GET /info/getVersion`, `/info/getOptions`, `/info/mode` | Receiver id, software version, supported commands, standby state | Diagnostics |

Every reply: `{ status: { code, commandResult, msg, query }, ...fields }`. Only `code: 200` is success; errors use HTTP status 400/403/409/500/503. **403** on newer firmware means External Device Access got reset after an update. SHEF is single-threaded per box: sub-second responses, no request queueing, so callers must serialize per box.

## 2. How Pandora reaches them

Pandora runs in Azure App Service joined to VNet `bma-virtual-network`, subnet `bma-tools` (PR slots: `.github/workflows/deploy-pull.yml:42`; production is configured on the app). From there the site LANs (10.43.x, 10.47.x, 10.48.x) are routable, and `hdtv.utils.ts` already dials node IPs with plain `dgram`/`net` sockets, no gateway or env var. Every other LAN integration goes the same way: Firebird TCP 3050 to the BMI box (`src/utils/firebird.utils.ts`), HTTPS 8083 to Conqueror (`src/utils/conqueror.utils.ts:56`), MSSQL to Intercard, HTTP 8000/8001/8002 to the Q-SYS Cores. So plain `axios` GETs to `http://<box-ip>:8080/...` need no new plumbing (confirmed by the Pandora session on main 4b01a26).

Fallback, only if TCP 8080 to the receivers' VLAN turns out to be blocked: the Core's `avoip-discovery.lua` (port 8002) has no HTTP client today, only `UdpSocket`/`TcpSocketServer` and a UDP-only `POST /avoip/relay` (line 299). Q-SYS Lua has `HttpClient.Download`, so a sibling script that proxies a GET to `<box>:8080` is about a day. Keep it out of scope unless step 6 fails.

## 3. Box registry (new per-location config)

The app must not carry LAN IPs. Pandora should own a per-location list, as a Square location custom attribute read with `getLocationCustomAttribute(locationID, key)` in `src/utils/square.utils.ts`, the same mechanism as `qsysAddress` and `bmiAddress`. Fort Myers is two Square locations sharing one building (`TXBSQN0FEKQ11` HeadPinz, `LAB52GY480CJF` FastTrax). Put the attribute on **both** locations, the way `bmiAddress` already is, so no location id is hardcoded. The custom attribute **definition** `directvBoxes` (string) must be created once by hand in Square; Pandora has no code to create location definitions. Check the definition's string length limit allows about 1.5 KB for 8 boxes; if it does not, the registry becomes a Prisma table and the attribute is dropped. Registry reads are cached 10 minutes per location (only the poller reads it; `GET /directv/boxes` never calls Square) and `POST /directv/registry` invalidates the cache.

```json
// Square location custom attribute "directvBoxes" (JSON string), or a small config table
[
  { "id": "dtv1", "name": "DTV 1", "shefIp": "10.43.60.x", "clientAddr": "0",
    "encoder": { "ip": "10.43.60.y", "devid": 8 }, "model": "H25" },
  ...
]
```

- `shefIp` / `clientAddr`: where SHEF lives (a Genie server with clients has one `shefIp` and several `clientAddr`s).
- `encoder`: the AV-over-IP encoder that box feeds, so the app can go from "put DTV 7 on Bar 3" to `POST /hdtv/source { ip: <decoder>, encoder: {...} }` without knowing addresses.
- The IPs are not in the Allonis variable store. Get them from the Allonis DirecTV driver config (MyDesigner > Drivers > DirecTV, 8 units) or the DHCP table; the AV encoder ids come from `POST /hdtv/scan`.

## 4. Endpoints to add (tag `DirecTV`, prefix `/v2/directv`)

Follow the repo's Routes → Controllers → Utils layout (`.claude/docs/architectural_patterns.md`). Files to add:

- `src/models/directv.models.ts`: zod params/query/body schemas, one `z.object({ params, query, body })` request schema per route, response schemas extending `GenericSingleResponse` / `GenericArrayResponse` (`src/types/responses.ts`).
- `src/routes/directvV2.routes.ts`: `router.use(passport.authenticate("bearer", { session: false }))`, then per route `validate(reqSchema)`, controller, `validateJSONResponse(resSchema)`; mount with `apiRouterV2.use("/directv", ...)` in `src/routes/indexV2.routes.ts`.
- `src/controllers/directv.controllers.ts`: read validated input from `res.locals.params|query|body`, set `res.status(...)` and `res.locals.response = { success, data }` or `{ success: false, message, error }`, then `next()`; never `res.json`. Mirror `makeHdtvReadController` / `makeHdtvWriteController` and `handleHdtvDeviceError` (`src/controllers/hdtv.controllers.ts` ~line 355) for the device error mapping.
- `src/utils/directv.utils.ts`: the SHEF client (axios, 3 s timeout, per-ip queue) and the poller/cache.
- `src/paths/directv.paths.ts`: `registry.registerPath` per route with tag `DirecTV`, spread `globalResponses`; add `import "./paths/directv.paths"` to `src/openAPI.ts`; `npm run docs` regenerates Swagger.
- `docs/directv-shef.md`: the protocol page, sibling of `docs/hdtv-json-control.md`.

Template to copy: `GET /hdtv/wall/:ip` (route `src/routes/hdtvV2.routes.ts:252-262`, models `hdtvWallSchema` line 313 and `hdtvWallResponseSchema` line 432, path registration `src/paths/hdtv.paths.ts` ~line 250).

| Method | Route | Body / query | Does | Reply `data` |
|---|---|---|---|---|
| GET | `/directv/boxes/{locationID}` | | Registry plus the **cached** tuned state of every box (see §5). Instant. | `{ polledAt, boxes: [ { id, name, online, tuned: { major, minor, callsign, title, episodeTitle, startTime, duration, isRecording }, error } ] }` |
| GET | `/directv/tuned/{ip}` | `clientAddr?` | Live `getTuned` on one box (bypasses the cache). | getTuned fields, status envelope stripped |
| POST | `/directv/tune` | `{ locationID, boxId }` or `{ ip }`, `major` 1-9999, `minor?` 0-999, `clientAddr?` | `tv/tune`. If the box answers busy (500, `commandResult: 1`) Pandora retries once after 500 ms before returning 409. Then re-polls the box after 1.5 s. | the box's re-polled tuned state (`{ ip, tuned: {...} }`), so the app needs no second call; costs ~1.5 s on the request |
| POST | `/directv/key` | target as above, `key` (enum), `hold?` keyPress\|keyDown\|keyUp | `remote/processKey` | `{ ip, key, hold }` |
| GET | `/directv/program/{ip}` | `major`, `minor?`, `time?` (epoch s, integer only; the 2-hour horizon is the box's rule and is not enforced by Pandora), `clientAddr?` | `tv/getProgInfo` | program fields |
| GET | `/directv/info/{ip}` | | `getVersion` + `mode` + `getLocations` with `allSettled`, merged (like `getHdtvStatus`); `locations` omitted when the box rejects `getLocations` (non-Genie boxes) | `{ receiverId, accessCardId, stbSoftwareVersion, systemTime, mode, locations?: [{ locationName, clientAddr }] }` |
| POST | `/directv/registry/{locationID}` | the array in §3 | Replace the location's box list (manager/installer only) | the stored list |

Target resolution: `boxId` + `locationID` looks up `shefIp`/`clientAddr` in the registry; raw `ip` is allowed for installers (mirrors `/hdtv/*`, which takes IPs). `clientAddr` regex `^(0|[0-9A-Fa-f]{12})$`.

Error mapping (put in `directv.utils.ts`):

| Condition | HTTP | `message` | `error` |
|---|---|---|---|
| Bad body | 400 | Validation Exception | zod issues |
| Box unreachable / timeout (3 s) | 502 | Failed to reach the DirecTV receiver | `{ ip, reason: "timeout" \| socket code }` |
| SHEF 403 | 502 | Receiver refused the request (External Device Access is not set to Allow) | `{ ip, query, code: 403 }` |
| SHEF 500 `commandResult: 1` | 409 | Receiver is busy, retry | `{ ip, query, msg }` |
| Other non-200 | 502 | Receiver rejected the command | `{ ip, query, code, msg }` |

Concurrency: one in-flight request per `shefIp` (a promise queue keyed by ip), 150 ms spacing, because SHEF is single-threaded. The poller and on-demand calls share the same queue, otherwise a 10 s poll collides with a tune and produces the very 409 the retry is for.

## 5. Poller and cache

The app shows "what is on each box" on its first screen and refreshes every 10 s. Do not have every tablet hit the boxes. Reuse the in-process cache pattern of `src/utils/qsysAudioSocket.utils.ts` (a `Map` keyed by address, opened lazily on first request, latest state cached, served by `GET /qsys/audio/live/:locationID` via `getQsysAudioLiveState`), with a `setInterval` per location in place of the WebSocket. It is per process, so a slot swap starts cold; acceptable, the audio cache accepts the same. A BullMQ repeat job (`src/config/bullmq.config.ts`, e.g. the 10 s `bmiNotificationSyncScheduler`) is the alternative if the state must survive restarts; not needed for 8 boxes.

- On first `GET /directv/boxes/{locationID}`, start a poller for that location: `getTuned` on every box every 10 s (configurable), in parallel across boxes, serialized per box.
- Keep the last good reading per box plus `online` and `error`; stop the poller after 10 min without a read (same idle rule as the audio cache).
- `POST /directv/tune` and `/key` schedule an early re-poll of that box after 1.5 s so the UI reflects the change quickly.

Optional later: an SSE or WebSocket push like the audio feed, so the app does not poll Pandora either.

## 6. Bring-up checklist (Fort Myers)

0. **Before any code is written:** from the Pandora App Service Kudu console, `curl http://<box-ip>:8080/info/getVersion` against one box. Five minutes, and it is the only unknown that changes the design (if it times out, the Core HTTP proxy fallback moves into scope). Needs one box IP from the Allonis DirecTV driver config.
1. Confirm the answer above; if it times out, check the receivers' VLAN route before anything else.
2. On each box confirm External Access = Allow (a 403 on getTuned is the symptom when it is not).
3. Run `getLocations` on each box to learn whether any are Genie servers with mini clients (then `clientAddr` matters).
4. Fill the registry (§3) with the 8 `shefIp`s and the 8 encoder `devid`s from `/hdtv/scan`.
5. Tests: add `qsys/fake-directv-box.js` (an HTTP server answering the SHEF routes with SHEF-shaped JSON, with `--busy` and `--deny` flags for the 409 and 403 paths) next to `fake-avoip-node.js`, and `qsys/smoke-directv.js` that runs a local Pandora against it and asserts status codes. Note: the "smoke suite" that `qsys/README.md` mentions for HDTV was never committed, so this is the first one.

## 7. Related but separate

- **Preview of a box's picture** in the app: not SHEF. The box's encoder already publishes RTSP (`rtsp://<encoder>:8554/ch0/2` is the low-rate preview stream per `docs/hdtv-json-control.md`). Browsers cannot play RTSP, so a small on-prem gateway (go2rtc or mediamtx) turning RTSP into WebRTC/HLS is needed, then the app embeds that. Worth a separate ticket.
- **Guide data** (what is on channel 618 at 8 pm, which games are on tonight) does not come from the boxes, except `getProgInfo` for a single channel up to 2 h ahead. See `docs/GUIDE-PROVIDERS.md`.
- **Which channels the venue subscribes to** is not exposed by SHEF. See the same doc for the approach.

## 8. Implementation plan agreed with the Pandora session (2026-09-29)

Branch `feat/directv-shef`, one PR through the normal main to slot-swap pipeline. Files: `src/utils/directv.utils.ts` (SHEF client, per-ip queue, errors, registry cache, poller), `src/models/directv.models.ts`, `src/controllers/directv.controllers.ts`, `src/routes/directvV2.routes.ts` plus the mount, `src/paths/directv.paths.ts` plus the import, `upsertLocationCustomAttribute` in `src/utils/square.utils.ts`, `qsys/fake-directv-box.js`, `qsys/smoke-directv.js`, `docs/directv-shef.md`. Estimate: about two working days of coding, plus bring-up on site for External Access and the box IPs.

Answers to the Pandora side's questions from the app:
- Busy tune: Pandora retries once after 500 ms; the app treats a 409 as "try again in a few seconds" and does not retry on its own.
- `clientAddr`: unknown until bring-up. Keep it in the API; the app hides it in the UI unless `GET /directv/info/{ip}` reports Genie clients for that box.

Decisions that need Eric: approve the two days; run the Kudu curl (step 0); create the `directvBoxes` custom attribute definition in Square.

## 9. Bring-up results (2026-09-28, evening)

Pandora session, read-only against the live receivers from the site VPN:

- All 8 answer SHEF on 8080 at 10.43.60.70-77. Same model (modelId 89, firmware 0x1ddb, SHEF 2.5), External Access = Allow on all, no Genie servers (every `getLocations` lists only itself, clientAddr "0"). The poller read all 8 in 443 ms.
- Real `getTuned` carries extra fields (date, isOffAir, isPclocked, isPpv, isVod, offset, stationId); Pandora passes them through.
- Box self-names are not the DTV numbers (.70 "99", .71 "4", .72 "Y", .73 "HPFM4", .74 "Z", .75 "HPF", .76 "5", .77 "HPFM").

IP to DTV number, by matching Pandora's per-IP channel against the Allonis per-DTV channel variables at 22:03 ET:

| IP | DTV | Confidence |
|---|---|---|
| 10.43.60.71 | DTV 2 | exact (9561 unique) |
| 10.43.60.72 | DTV 3 | exact (9562 unique) |
| 10.43.60.74 | DTV 5 | exact (9565 unique) |
| 10.43.60.77 | DTV 8 | exact (20 unique) |
| 10.43.60.73 | DTV 4 | pair with .75 (both on 218); self-name "HPFM4" favours DTV 4 |
| 10.43.60.75 | DTV 6 | the other half of that pair |
| 10.43.60.70 | DTV 1 | pair with .76 (both on 26); unresolved, assigned by order |
| 10.43.60.76 | DTV 7 | the other half of that pair |

To resolve the two pairs without touching the floor: poll `getTuned` on the four IPs and `http://10.43.60.245/api/getvariables` (`av_56..63_channel`, 56 = DTV 1) and wait for one of them to change channel during normal operation; the one that moves together is the match. Still open: the Azure-side Kudu curl, the encoder devids from `POST /hdtv/scan`, and the `directvBoxes` definition in Square.

## 10. Identity: receiver id, not IP (requested 2026-09-28)

Eric asked to map boxes by MAC rather than IP so a DHCP change or a swapped box does not break the mapping. SHEF does not expose the MAC, and Pandora in Azure cannot read ARP, but `GET /info/getVersion` returns `receiverId` (the DirecTV receiver ID, e.g. "0288 7745 5858"), which is unique and permanent per box. So:

- The registry keys a box by `receiverId`; `shefIp` becomes a cached, discovered value rather than configuration.
- Pandora adds `POST /directv/discover/{locationID}`: sweep the site subnet(s) for TCP 8080 (the same idea as the AV scan, but Pandora can do this one itself over the VNet), call `getVersion` on each responder, and return `[{ ip, receiverId, locationName, stbSoftwareVersion }]`. The poller uses the discovered `receiverId -> ip` map and re-runs discovery when a box stops answering at its last IP.
- `GET /directv/boxes` returns both `receiverId` and the current `shefIp`.
- Subnet(s) to sweep: a `directvSubnets` field in the registry, Fort Myers `10.43.60.0/24`.

The 8 receiver ids still have to be read once (`getVersion` on 10.43.60.70-77) and paired with the DTV numbers; the IP table in section 9 is the bridge until then.

## 11. Mapping settled (2026-09-28, late)

The Allonis controller's device tables answer everything the scan would have (`http://10.43.60.245/api/getdevices/directv/all` and `/api/getdevices/avoip900/all`):

| DTV | SHEF IP | receiverId | Encoder IP | Encoder node id (devid) |
|---|---|---|---|---|
| DTV 1 | 10.43.60.70 | 0323 6087 7164 | 10.43.60.3 | 102 |
| DTV 2 | 10.43.60.71 | 0323 6087 6760 | 10.43.60.4 | 104 |
| DTV 3 | 10.43.60.72 | 0323 6086 0277 | 10.43.60.5 | 105 |
| DTV 4 | 10.43.60.73 | 0323 6086 1275 | 10.43.60.6 | 107 |
| DTV 5 | 10.43.60.74 | 0323 6086 3032 | 10.43.60.7 | 108 |
| DTV 6 | 10.43.60.75 | 0323 6086 0145 | 10.43.60.8 | 110 |
| DTV 7 | 10.43.60.76 | 0323 6047 5852 | 10.43.60.9 | 112 |
| DTV 8 | 10.43.60.77 | 0323 6087 4336 | 10.43.60.10 | 144 |

Both provisional pairs from section 9 resolved as assigned. All 46 decoder IPs and the other sources' encoders (Bowling Music 1/2, MMS 1/2, Atmosphere = "ChiveTV", Meeting Room) are in `config/sites/hpfm.json`. The registry body for `POST /directv/registry/TXBSQN0FEKQ11` can be generated from that file.

