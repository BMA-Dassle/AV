# Scheduled changes

A scheduled change is a time plus a list of actions, run in order. Today the guide creates "tune box X to channel N when the program starts", optionally followed by "show box X on these screens". The action list is general on purpose. The same scheduler can later drive every box, screen, video wall and projector.

## Actions (lib/server/schedule.ts)

| type | fields | runs |
|---|---|---|
| `tune` | `boxId`, `channel` | `SiteState.tuneBox` (busy boxes retried) |
| `source` | `tvIds`, `sourceId` (null = off) | `SiteState.setTvSource` |
| `wall` | `wallId`, `mode` wall/screens, `sourceId?` | `SiteState.setWallMode` |
| `power` | `tvIds`, `on` | `SiteState.setTvPower` (projectors) |

Every change also carries a `label` and, when made from the guide, the `program` (channel, title, start, end). The page uses the program to mark the listing and the box card.

## Storage and running

- The Neon table `av_schedule` holds all changes. Every tablet sees the pending ones in the live state (`snapshot.schedule`).
- A due change is claimed atomically (`FOR UPDATE SKIP LOCKED`), so exactly one server instance runs it. A claim older than 5 minutes that never finished goes back to pending.
- Late changes still run while their program is on. Once the program is over (or 30 minutes have passed when there is no program), a late change is marked `missed`.
- Due changes run whenever any page has the app open, because every state read or live-feed tick checks at most every 10 s. They also run on the always-on host timer.
- **Overnight / no tablet open:** call `GET /api/schedule/tick` every minute. On Vercel Pro, add a cron to `vercel.json` (`{"crons":[{"path":"/api/schedule/tick","schedule":"* * * * *"}]}`) and set `CRON_SECRET`; Vercel sends it as `Authorization: Bearer`. On the Hobby plan, a per-minute cron fails the deploy, so use any outside timer (cron-job.org, a Railway job, Pandora) with `Authorization: Bearer <CRON_SECRET or an app token>`.

## API

| method | path | body / result |
|---|---|---|
| GET | `/api/schedule` | `{ items }`: pending and running changes, plus 3 days of history |
| POST | `/api/schedule` | `{ runAt, actions, label, program? }` returns `{ item }` (at most 14 days ahead) |
| POST | `/api/schedule/:id/cancel` | cancels a pending change |
| POST | `/api/schedule/:id/run` | runs a pending change now |
| GET/POST | `/api/schedule/tick` | runs due changes for every venue (cron) |

## Next

- Repeating changes, for example "every Sunday 12:55 PM, put Sunday Ticket 1-8 on DTV 1-8".
- "Change back after the game": a second change at `program.end`.
- A multi-box plan for game days: several tune and screen actions in one change.
