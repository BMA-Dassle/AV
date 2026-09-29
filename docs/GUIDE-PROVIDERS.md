# TV guide data: provider options and recommendation

Need: a guide grid for the Fort Myers DirecTV lineup (locals included), sports-aware so staff can "find the game", commercially licensed, cheap enough to run per venue, and something we can wire into `GET /api/guide` (see `src/guide.js`). Researched 2026-09-28.

## What the old system used

The Allonis controller's guide feed was **TV Media** (brand: TVPassport): every channel logo variable points at `cdn.tvpassport.com/image/station/...`, and its lineup id `9166` is a TV Media numeric lineup id. TVPassport lists "DirecTV - Fort Myers-Naples, FL" for the area. The subscription lapsed ("myTV is running in demo mode"), which is why the old guide page is empty. So there is prior art: the data shape the Allonis `ui-tvguide` consumed came from this provider.

## Options

| | TV Media (TVPassport) | Gracenote OnConnect (Nielsen) | Schedules Direct | DirecTV box itself (SHEF) |
|---|---|---|---|---|
| Commercial use | Yes, self-serve plans | Yes, enterprise contract | **No.** Non-commercial, natural persons only; a business cannot subscribe | n/a |
| DirecTV Fort Myers lineup | Yes ("DirecTV - Fort Myers-Naples, FL", SAT type) | Yes (`USA-DITV-DEFAULT` national + local ids by ZIP 33912) | Yes | Only what the box reports |
| Sports | Sports API: listings by league, team, sport, 14 days | Sports API (scores, schedules) on higher tiers | No | No |
| Logos and artwork | Station, show, league logos on the CDN we already use | Yes | No | No |
| Days ahead | 14 future / 7 requested (Standard), 14 / 14 (Pro) | 14 | 12-20 | 2 hours, one channel per call |
| Price | **Live pricing page (2026-09-29): Sample $0 (50 calls, 24 h, attribution, non-commercial), Standard $300/mo (5,000 calls, 14 days, all APIs incl. Sports, commercial), Pro $750/mo (20,000+ calls).** The $100 Intro tier on the older product page no longer exists | Not published; sales conversation. Historically the most expensive option | $35/yr | free |
| API | `GET http://api.tvmedia.ca/tv/v4/lineups?postalCode=33912`, `GET /lineups/{id}/listings?timezone=America/New_York&start=&end=&detail=brief`, `/sports/...`, key as query param, JSON | `data.tmsapi.com/v1.1/lineups?postalCode=`, `/lineups/{id}/grid?startDateTime=`, key as query param, JSON | JSON, token auth | HTTP JSON on the LAN via Pandora |
| Fit | Direct replacement of what we had; sports endpoints match the "find the game" flow | Best data quality, overkill and slow to procure | Disqualified on license | Useful as a fallback for "what is on this channel right now" |

### The wider field (checked 2026-09-29)

| Provider | What it is | Cost | Verdict for us |
|---|---|---|---|
| **TheSportsDB** | Crowd-sourced sports database with a TV listings endpoint (`eventstv.php?d=&s=&a=&c=`): event, channel name, country, time, logos | Free key 1 call/min; Single Developer $9/mo; Small Business $20/mo (120 calls/min, private key) | Cheapest way to answer "which games are on tonight and on which network". Channel is a name (ESPN, FS1), not a DirecTV number, so we map names to our channel list ourselves. Coverage of US cable sports networks needs a look on the free key before paying. Pairs well with Phase 1. |
| **TVmaze** | Free REST API, CC BY-SA, US network schedule by date (`/schedule?country=US&date=`) | Free with attribution (~20 calls / 10 s) | Broadcast and cable network schedules, not a satellite lineup and weak on live sports. Fine for "what's on NBC/ESPN at 8" filler, not a guide. |
| **TitanTV (Titan TV Inc.) Data Services** | Long-running listings vendor; OTA, cable, satellite lineups, SOAP/XML web services, custom feeds | Quote-based, business sales | Legitimate commercial alternative to TV Media; older SOAP API and no public price. Worth a quote only if TV Media's trial disappoints. |
| **TvProfil XMLTV** | 5,000+ channels, commercial use allowed | Quote | European catalogue; US satellite lineups are not its strength. Skip. |
| **Zap2it / Gracenote consumer feeds, iptv-org EPG scrapes** | Free XML/JSON that DVR hobby tools use | free | Personal, non-commercial terms. Same problem as Schedules Direct; do not build a business tool on them. |
| **DirecTV itself** | "DIRECTV API" exists only for its on-demand catalogue; no linear guide API. The receivers hold 14 days of guide but SHEF exposes 2 hours per channel | free | That 2-hour window is Phase 1. |
| **ESPN public JSON (unofficial)** | Scoreboard/schedule feeds many sites use | free, unsupported | Useful to cross-check game times; no license, can change without notice. Not a foundation. |

Net: for a full lineup grid the licensed choices are TV Media, Gracenote and TitanTV, and TV Media is the cheapest of those at $100/month. For the sports question specifically, TheSportsDB at $9-20/month is the bargain, and it complements the free 2-hour window from the boxes.



## Recommendation (revised 2026-09-29: keep it cheap)

Start at **$0**, add **TheSportsDB at $20/month** if staff want tonight's games listed by network, and only buy a full lineup feed once the "what's on later" grid proves it earns its keep. **Correction 2026-09-29:** TV Media's cheapest commercial plan is Standard at $300/month; the $100 Intro tier quoted earlier no longer exists. That plan does include the Sports API and 14 days.

**Phase 1, no subscription.** The boxes already have the guide. SHEF `getProgInfo` returns title, episode, start and duration for any channel, now or up to 2 hours ahead, and the box answers in well under a second. Through the planned Pandora `GET /directv/program/{ip}` the app can build a "now and next" strip for a curated channel list (locals, ESPN family, FS1/FS2, league networks, the Sunday Ticket block: about 30 channels) in one pass every 5 minutes on one box. That covers the guide flow the mockup shows for the next two hours, plus the eight boxes' current programs from `getTuned`. Cost: nothing. Limit: no 7-day grid, no artwork beyond what the box returns, and the poll is 30 calls per refresh on one box, so it should run on whichever box is idle.

**Phase 2, if staff want to plan ahead.** The entry price for a licensed full-lineup feed is TV Media **Standard at $300/month** (14 days, all APIs including Sports, 5,000 calls, commercial, no attribution). Before paying it, get a quote from TitanTV Data Services for comparison and try TV Media's free Sample key to confirm the Fort Myers DirecTV lineup and the Sunday Ticket 9555+ channels are present (the Sample key is non-commercial, so it is for evaluation only). If one subscription is shared by several venues through a Pandora guide endpoint, $300 spreads better. Gracenote remains the enterprise option.

Sports on TV Media: lineup listings carry `league`, `team1` and `team2` per program and accept a `showtype[]` filter, and the Standard plan includes the dedicated Sports API (search by team, league, sport type or event type across 14 days, with logos). There is no cheaper commercial tier.

Do not use Schedules Direct: the license bars businesses.

Call budget for Phase 2 on Standard (5,000 calls):

| Fetch | Frequency | Calls/month |
|---|---|---|
| Lineup listings, 6-hour window | every 30 min, 1 lineup | ~1,450 |
| Sports listings, next 24 h | every 30 min | ~1,450 |
| Lineup channel list refresh | weekly | ~4 |
| Total | | ~2,900, room for a second venue |

## "Knows what packages we have"

No guide provider knows a subscriber's package. Lineups are per market and headend (everything DirecTV carries in Fort Myers), not per account. Options, best first:

1. **Curated allowlist per location.** A manager screen where the channels the venue actually gets are ticked; seeded from the DirecTV for Business package on the invoice (for Fort Myers: the commercial base pack plus NFL Sunday Ticket, which the boxes were on at capture time on channels 9555-9569, and NBA League Pass 750s). Stored with the box registry in Pandora or in `config/site.json`. The guide filters to this list by default, with an "all channels" toggle.
2. **Verify against a box.** For each candidate channel, `tune` a spare box then `getTuned` a second later: an unsubscribed channel leaves the box on the "channel not purchased (721)" screen, which shows up as a `getTuned` that did not move to the requested `major` or returns no `callsign`. This needs a bench test on a real box before we rely on it; it can seed the allowlist once, off-hours.
3. Ask the DirecTV for Business account rep for the channel list of the package; they can export it.

Sunday Ticket detail: TV Media's DirecTV lineup should carry the 705-719 residential ST channels; whether it also lists the commercial 9500-series feeds the boxes use is unknown until we look at the trial data. If not, map games from the sports API (league NFL, kickoff time) to the ST channel block manually, as the old favorites list did (it had 9555-9569 pinned).

## Decision and verification (2026-09-28 evening)

Eric signed up for TV Media's **Intro plan** (it is still sold from the product page). With the key:

- `GET /lineups?postalCode=33912` lists 20 lineups; the DirecTV one is **`36463D` "DirecTV - Fort Myers-Naples, FL"** (the old controller's 9166 was a different vendor's id). Also present: DirecTV National `2381D`, Broadcast Fort Myers `32044`.
- A 2-hour brief listings pull returned 1,210 rows over 497 channels, 11 through 9567: all four locals, every sports network we care about, FS2 on 618, and the **commercial Sunday Ticket block 9555-9567 as NFLST2..NFLST14**. Each row carries `league`, `team1`, `team2`, `live`, `new`, `repeat`, `hd`, `showTypeID`, `logoFilename`.
- `src/guide.js` now has the `tvmedia` provider: one 6-hour window per hour, cached, hard monthly cap (`TVMEDIA_MONTHLY_CAP`, default 900). Verified end to end: the app served Monday Night Football live on ESPN and WZVN with correct Eastern times, and a second request cost zero calls.
- Quirks handled: TV Media's `live` means "live broadcast", not "on now" (exposed as `liveBroadcast`; `live` in our shape means airing now); alternate-feed filler rows ("Local Programming", "To Be Announced") overlap real programs and are dropped when a real program overlaps; a few channels have no callsign.

## What to build

1. Phase 1: a `shef` provider in `src/guide.js` that fills a 2-hour window for the curated channel list from Pandora's `GET /directv/program/{ip}` (needs the Pandora DirecTV endpoints first; see `PANDORA-DIRECTV-SPEC.md`). Cache 5 minutes. The Guide page shrinks its grid to "now / next" columns when only this provider is active.
2. The subscribed-channel allowlist and the Sunday Ticket mapping (below).
3. Done: TV Media Intro, lineup 36463D, `tvmedia` provider with hourly cached 6-hour windows.
4. If more than one venue wants guide data, move fetching into Pandora as `GET /v2/guide/{locationID}` so one subscription serves signage, the portal's TV pages and this app.
