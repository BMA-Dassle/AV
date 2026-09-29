# Box preview: direct from the venue LAN

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

Encoder IPs come from Pandora `POST /hdtv/scan` (the same list that gives the encoder `devid`s for the box registry). Use the `/ch0/2` preview stream so eight open dialogs do not pull eight full-rate feeds.

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
