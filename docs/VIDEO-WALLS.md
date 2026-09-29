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

**Open question: how each screen shows its slice.** Every node has an identical window (`0,0 5760×2160`). The vendor's wall table read through Pandora (`getwall`) is empty on both walls. So either each node was configured with its row and column some other way (for example its web UI), or Allonis sends a vendor command Pandora does not know. Commands probed and not supported: `getvideowall`, `getvwall`, `getsplice`, `getsplicing`, `getwallinfo`, `getwallparam`, `getmatrix`.

## Step 0 (before any code): capture exactly what Allonis sends

This takes one flip at a quiet time, about 10 minutes, and decides whether Pandora needs a new command.

1. On http://10.40.60.245/dashboard/, open the VOIP925 driver page and turn on **Logging** and **Verbose**.
2. On the old Naples page, flip Video Wall 1 to Single, then back to Full with a source.
3. Save the driver log and turn logging off.

The log shows the JSON sent to each node:

- whether Full uses `openwindow` with `wallid` and wall-space coordinates, as Pandora's `/hdtv/source` supports (`ips` + `wallid` + `x,y,width,height`);
- or a vendor splice command we have not seen;
- whether Single is six plain full-screen `openwindow`s.

If it is the first case, Pandora needs nothing new. If it is a splice command, Pandora needs one typed endpoint or a raw `POST /hdtv/command` payload (it is non-destructive, so the raw route already allows it).

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

### 4. Pandora calls (assuming Step 0 shows `openwindow` + `wallid`)

- Wall picture: `POST /hdtv/source { ips: [6 decoders], wallid, x: 0, y: 0, width: 5760, height: 2160, encoder }`. Pandora already unicasts this to all six and returns per-node results. A partial failure shows which screen did not switch.
- Separate screens: one `POST /hdtv/source` per tile with no coordinates, which is full screen at 1920×1080. The six calls are grouped by source to keep it to a few calls.
- Audio: open it on one tile only (the middle-bottom screen), or leave it off, so six decoders are not playing the same sound. Needs a decision from Eric.

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
| 0. Capture Allonis's wall commands (on site, with logging) | 10 min, Eric or a manager at Naples |
| 1–3. Config, state and reconcile detection, API | half a day |
| 4. Pandora calls (no Pandora change if Step 0 confirms `wallid`) | included above; +half a day in Pandora if a splice command is needed |
| 5–6. Floor-plan wall group, mode switch, guide target | half a day |
| Test at Naples, quiet hour, one wall | 30 min |

Until this ships, the app treats the 12 wall screens as ordinary screens. Picking a source for one tile while a wall is in Full mode puts a full-screen window on that tile, leaving the other five still spanning. So don't use the app on the walls at Naples until this lands.
