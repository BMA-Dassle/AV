# Box preview: direct from the venue LAN

**Update 2026-09-29: Pandora hosts the gateway** (v2.4.106): go2rtc inside the Pandora container at `/v2/preview`, reaching the encoders over Pandora's own LAN access. With no `PREVIEW_GATEWAY` and no `site.previewGateway`, the app now uses `<PANDORA_BASE>/preview/api/ws?src=<encoder ip>`, so previews work from any network without an on-site service. The player runs MSE only (no WebRTC on App Service) and video only: the encoders advertise AAC but send none, and asking for audio stalls go2rtc's MP4 muxer. Keep the default ch0/2 stream; ch0/0 and ch0/1 are H.265 and most browsers refuse them. An on-site go2rtc (below) still works as an override.

The box dialog shows a live picture of what a DirecTV box is putting out. That stream never goes through Pandora: the tablet connects straight to an on-site gateway, tries three times, and falls back to the placeholder card when it cannot connect (off-site, gateway down, or a wrong URL).

## Why a gateway

Each DirecTV box feeds an AV-over-IP encoder. The encoders publish RTSP (`rtsp://<encoder-ip>:8554/ch0/2` is the low-rate preview stream, `/ch0/0` main, `/ch0/1` sub, per Pandora's `docs/hdtv-json-control.md`). Browsers cannot play RTSP, and the old Allonis page never had previews configured either (`livepreview_enabled = 0`, all `video_in_N_stream` empty). So one small service on the venue network turns RTSP into something a browser plays.

## Recommended: go2rtc

[go2rtc](https://github.com/AlexxIT/go2rtc) is a single binary (Windows, Linux, Docker) that ingests RTSP and serves MP4-over-HTTP, MJPEG, HLS and WebRTC. It can run on the existing controller PC (10.43.60.245) or any always-on box on the AV network.

`go2rtc.yaml`:

```yaml
api:
  listen: ":1984"
  origin: "*"          # the app page is served from another origin; allow it
streams:
  dtv1: rtsp://10.43.60.ENC1:8554/ch0/2
  dtv2: rtsp://10.43.60.ENC2:8554/ch0/2
  dtv3: rtsp://10.43.60.ENC3:8554/ch0/2
  dtv4: rtsp://10.43.60.ENC4:8554/ch0/2
  dtv5: rtsp://10.43.60.ENC5:8554/ch0/2
  dtv6: rtsp://10.43.60.ENC6:8554/ch0/2
  dtv7: rtsp://10.43.60.ENC7:8554/ch0/2
  dtv8: rtsp://10.43.60.ENC8:8554/ch0/2
```

The ready-made file with Fort Myers' real encoder addresses is `docs/go2rtc.yaml` (DTV 1-8 at 10.43.60.3-10, plus the music, signage and meeting-room encoders). Use the `/ch0/2` preview stream so eight open dialogs do not pull eight full-rate feeds.

**Install on Windows (the Allonis controller PC):** download `go2rtc_win64.zip` from the go2rtc releases page, unzip to `C:\go2rtc`, copy `docs/go2rtc.yaml` next to the exe as `go2rtc.yaml`, run `go2rtc.exe` once and confirm `http://localhost:1984` shows the streams, then keep it running as a service (`nssm install go2rtc C:\go2rtc\go2rtc.exe` or a Scheduled Task at logon). Then set `PREVIEW_GATEWAY=http://10.43.60.245:1984` (or `site.previewGateway`). Until it runs, the dialog shows "No preview gateway configured".

## App configuration

`config/site.json`:

```json
"site": { "previewGateway": "http://10.43.60.245:1984" }
```

With that set, every box's preview URL is `<gateway>/api/stream.mp4?src=<boxId>` (fragmented MP4 over HTTP, plays in a plain `<video>` on Chrome, Edge, Safari and iPad). A box can override it with its own `preview` URL. Two other formats are handled automatically:

- MJPEG or snapshot URLs (`.../api/stream.mjpeg?src=dtv7`, or anything with `mjpeg`, `.jpg`, `snapshot` in it) render in an `<img>`. Lowest latency to first frame, higher bandwidth.
- HLS (`.m3u8`) plays natively on iPad and Safari only.

## Behaviour in the page

- Opening a box dialog starts a connect attempt; each attempt waits up to 4 s for the first frame and there are 3 attempts 1.5 s apart.
- On success the video replaces the placeholder scene; channel, program and progress bar stay overlaid.
- On failure the tag reads "not reachable from this device" and the placeholder stays. No error toast; off-site use is normal.
- Closing the dialog or switching category stops the stream so a tablet never holds a stream open in the background.
- The published mockup has no gateway, so it always shows the placeholder.

## Security note

The gateway is LAN-only and unauthenticated by default. Keep it on the AV/staff VLAN and do not port-forward it. If the app is served over HTTPS, the browser will block an `http://` gateway as mixed content: either serve the app over HTTP inside the venue, or put the gateway behind the same reverse proxy with TLS.
