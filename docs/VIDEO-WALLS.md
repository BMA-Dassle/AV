# Video walls (HeadPinz Naples): findings and feature plan

Written 2026-09-29 for Eric and whoever builds this. Findings are read-only observations of the Naples Allonis controller (10.40.60.245) and of the wall decoders through Pandora production.

## What exists today

Naples has two 3×2 walls of 1920×1080 screens:

| Wall | Old-system id | Top row (left→right) | Bottom row | Decoder IPs |
|---|---|---|---|---|
| Video Wall 1 | `videowall_1` | Nemos 1, 2, 3 | Nemos 4, 5, 6 | 10.40.60.14–19 |
| Video Wall 2 | `videowall_45` | Nemos 19, 20, 21 | Nemos 22, 23, 24 | 10.40.60.61–66 |

The tile order comes from the controller's variables (`videowall_N_tl_id … br_id` point at video outputs 1–6 and 45–50) and matches the positions on the old floor plan.

**Modes.** Allonis stores `videowall_N_mode` as `full` or `single` (plus an unused `partial`).

- `full` = **one picture across all six screens.** The mode icon is a solid rectangle.
- `single` = **six independent screens.** The mode icon is a 3×3 grid.

**Live state, 2026-09-28 late evening.** Both walls report `mode = full`. Wall 2 was switched at 2:41 PM that day, wall 1 on 7/4. Every one of the twelve decoders has a single window at `0,0` sized `5760×2160` (3 × 1920 by 2 × 1080), sourced from the DTV 2 encoder (10.40.60.4). So both walls are showing DTV 2 stretched across all six screens.

**Commands the old page sends** (Allonis driver `voip925`):

| Button | Command |
|---|---|
| Wall mode "Full" | `AV|<tile>~SetVideoWallMode~<wall>~Full` |
| Wall mode "Single" | `AV|<tile>~SetVideoWallMode~<wall>~Single` |
| Source for the whole wall | `AV|<tile>~VideoWallSource~<wall>~<source>` |
| Source for one screen | `Activate.Video|<tile>` then a source |

**Oddity worth fixing.** The old page shows the six per-screen buttons while the wall is in Full mode, and the one big wall button while it is in Single mode. That is the opposite of what the wall is doing, and a likely reason staff find it confusing.

**How it actually works (captured 2026-09-28 23:49, Video Wall 1, from the controller's VOIP925 driver log; wall restored to DTV 2 at 23:51).** The raw log is in `research/hpn/wall-flip-log.txt` in the old scratch folder.

1. **"Single" (separate screens)** takes about 1 second and **leaves all six screens blank**:
   - `{"cmd":"deletewall","id":1}` on each node;
   - then `{"cmd":"newmatrix"}` and `{"chn":0,"cmd":"setvoattr","width":1920,"height":1080,"hz":60}` on each node.
2. **"Full" (one picture)** rebuilds the wall **one node at a time, about 6 seconds each, 37 seconds in total**. It also **leaves the wall blank**. For each node it sends `deletewall`, `clearwindows`, `closeaudio`, `bindaudio`, `clearwindows`, `closeaudio`, then this:

   ```json
   {"cmd":"newwall","id":1,"rows":2,"cols":3,"row":R,"col":C,"w":1920,"h":1080,"hz":60,
    "ledw":5760,"ledh":2160,"type":0,"timing":0,"multiaddr":"239.1.1.1","multPort":1100,
    "allres":[{"row":0,"col":0,"width":1920,"height":1080}, ... six entries]}
   ```

   It finishes with `setprotocol 0`, `setstreamdelay 80000` and `setkeylock 1`.
3. **Wall source** takes about 0.2 seconds. It sends the same `openwindow` to all six nodes, with **no `wallid`**. Each node crops its own slice because of its `newwall` settings:

   ```json
   {"cmd":"openwindow","x":0,"y":0,"width":5760,"height":2160,"type":0,"wintype":0,"protocol":0,"stream":0,
    "url":"10.40.60.4:9705/channel=0/stream=0","suburl":"10.40.60.4:9705/channel=0/stream=1", ...}
   ```

   No audio is opened on the wall.

**Other findings from the capture:**

- **Wall settings persist on each node.** `getwall` sent raw returns `id`, `rows`, `cols`, `row`, `col` and `allres`. This is how the app can tell a node belongs to a wall. Pandora's typed `GET /hdtv/wall/{ip}` shows `walls: []` because it expects an array while the node answers with a single object. Reported to Pandora.
- **Nothing here needs new Pandora code.** None of these commands is on Pandora's blocked list, so the app can send them through `POST /hdtv/command`. The nodes are independent, so the app can send `newwall` to all six in parallel: about 6 seconds instead of Allonis's 37.

## Step 0: done

The capture above replaced the planned on-site logging session.

## Feature plan

### 1. Configuration

Add to `config/sites/hpn.json`:

```json
"walls": [
  { "id": "wall1", "name": "Video Wall 1", "rows": [["nemos-1","nemos-2","nemos-3"],["nemos-4","nemos-5","nemos-6"]], "canvas": [5760, 2160], "wallid": 1 },
  { "id": "wall2", "name": "Video Wall 2", "rows": [["nemos-19","nemos-20","nemos-21"],["nemos-22","nemos-23","nemos-24"]], "canvas": [5760, 2160], "wallid": 45 }
]
```

`wallid` is whatever Step 0 shows. The canvas follows from rows × columns × the node output size (`getvoattr` reports 1920×1080).

### 2. State

- A wall's mode is `wall` (one picture) or `screens` (independent). The UI says "Wall" and "Separate screens", never Full or Single.
- The mode is **read from the hardware**, not remembered. At startup and every reconcile, if every tile has one window matching the wall canvas from the same encoder, the wall is in `wall` mode with that source. Anything else is `screens`. This is how the app stays correct when someone uses the old page or the vendor tool.
- The mode is saved in Neon (`av_tv_state` gets a `wall_mode` row per wall) so all tablets agree between reconciles.
- Remember each tile's last individual source, so switching back to Separate screens can restore them.

### 3. API (this app)

| Route | Does |
|---|---|
| `POST /api/walls/:id/mode` `{ mode: "wall" \| "screens", sourceId? }` | `wall`: put `sourceId` across the wall. The default is the source most tiles currently show. `screens`: give each tile its remembered source. The default is the wall's current source on all six, so nothing changes visually until someone picks. |
| `POST /api/walls/:id/source` `{ sourceId }` | In wall mode, change what the whole wall shows. |

In wall mode, `POST /api/tvs/source` with a tile id returns "Nemos 3 is part of Video Wall 1 (showing one picture). Switch the wall to separate screens first." No silent side effects.

### 4. Pandora calls (all existing endpoints; confirmed by the capture)

- **To wall mode:**
  - `POST /hdtv/command { ips: [6], payload: { cmd: "deletewall" } }`
  - then, per node in parallel, the `newwall` payload above with that node's `row` and `col`
  - then the picture: `POST /hdtv/source { ips: [6], encoder, x: 0, y: 0, width: 5760, height: 2160, audio: false }`
  - about 7 seconds end to end, and the screens are never left blank at the end.
- **Change the wall's picture:** the same `POST /hdtv/source` with the wall geometry, about 0.2 seconds.
- **To separate screens:**
  - `POST /hdtv/command { ips: [6], payload: { cmd: "deletewall", id: 1 } }`
  - then `newmatrix` and `setvoattr 1920x1080` per node
  - then **immediately** `POST /hdtv/source` per node, full screen, with each node's remembered source (default: the wall's source), so there is no blank moment.
- **Detection at startup and reconcile:** raw `getwall` per node. If it returns `rows`/`cols`, the node is in a wall. The window size then says whether a picture is up.
- **Audio:** Allonis opens none on the wall. Keep that as the default; offer one tile (bottom-middle) as an option if Eric wants sound there.

### 5. Floor plan and controls

- The wall is drawn as one framed group around its six tiles, with its name and a two-state switch on the frame: **Wall | Separate screens**.
- **Wall mode:** the six tiles merge into one large tile showing the wall's source. Tapping it selects "Video Wall 1" as a single target, counted as 6 screens on the box cards.
- **Separate screens:** six normal tiles, selectable one by one, plus "Select wall" on the frame.
- **Switching to Wall:** a small sheet asks "Show which source across the wall?", pre-selecting the most common one.
- **Switching to Separate screens:** it happens immediately. The toast says "Video Wall 1 split into 6 screens, all still on DTV 2." Nothing looks different on the wall until someone picks a new source per screen.
- **Box dialog:** the "feeds N screens" list names the wall once ("Video Wall 1 (6 screens)") instead of six Nemos entries.
- **Phones:** the zone-zoom view shows the wall frame and switch at the top.

### 6. Guide

"Put on screens" can target a wall. In wall mode it is one target.

### 7. Recovery

If one tile's decoder fails during a wall change, the wall shows a warning badge naming the screen. The action is "Retry on Nemos 5". The whole wall is not rolled back.

## Effort and order

| Step | Size |
|---|---|
| 0. Capture Allonis's wall commands | done 2026-09-28 |
| 1–3. Config, state and reconcile detection, API | half a day |
| 4. Pandora calls | no Pandora change needed |
| 5–6. Floor-plan wall group, mode switch, guide target | half a day |
| Test at Naples, quiet hour, one wall | 30 min |

Until this ships, the app treats the 12 wall screens as ordinary screens. Picking a source for one tile while a wall is in Full mode puts a full-screen window on that tile, leaving the other five still spanning. So don't use the app on the walls at Naples until this lands.
