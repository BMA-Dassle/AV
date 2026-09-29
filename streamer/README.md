# Web page to RTSP streamer

Shows a web page (default https://headpinz.com) on the TVs. A headless Chrome or Edge renders the page at 1920x1080. ffmpeg encodes it to H.264, and MediaMTX serves it as RTSP on this PC. An AV-over-IP receiver then pulls the stream directly (window type 2 in the vendor protocol).

```
rtsp://<this-pc-ip>:8554/headpinz      the stream
http://<this-pc-ip>:8090               status page with a live snapshot
```

## Run it on a PC on the AV network (Windows)

1. Copy the `hp-web-rtsp` folder to the PC, for example `C:\hp-web-rtsp`. It must be on the same network as the receivers (10.43.60.x at Fort Myers, 10.40.60.x at Naples).
2. Right-click `allow-firewall.cmd`, choose **Run as administrator**, once. Without this step the receivers cannot connect.
3. Double-click `start.cmd`. The window lists the stream address. Keep it open; closing it stops the stream.
4. Open `http://localhost:8090` to see what is being streamed.

The package includes Node.js, ffmpeg and MediaMTX. It uses the Edge or Chrome already on the PC. Nothing needs installing.

To run it at logon, add a Task Scheduler task that runs `start.cmd` at logon of the PC's user. To run it without a user logged on, use `nssm install hp-web-rtsp C:\hp-web-rtsp\node\node.exe C:\hp-web-rtsp\streamer.mjs`.

## Put it on a screen

- **From the AV Control app:** set the site file's `web` source to `"rtsp": "rtsp://<this-pc-ip>:8554/headpinz"` (in `config/sites/hpfm.json` or `hpn.json`) and deploy. "HeadPinz.com" then appears under Music, signage & other.
- **Directly through Pandora:** `POST /v2/hdtv/source { "ip": "<receiver ip>", "rtspUrl": "rtsp://<this-pc-ip>:8554/headpinz", "audio": false }`.

## Options

Pass them to `start.cmd` as `--name=value`, or set them as `STREAM_NAME` environment variables.

| option | default | |
|---|---|---|
| `url` | https://headpinz.com | page to show; comma-separated for several |
| `rotate-sec` | 0 | with several urls, switch every N seconds |
| `reload-min` | 30 | reload the page every N minutes |
| `scroll` | 0 | pixels per second of slow auto-scroll (loops) |
| `width` / `height` | 1920 / 1080 | output size; 3840/2160 for 4K (page laid out like 1080p, drawn at 2x) |
| `fps` | 30 | 60 for smoother motion (more CPU) |
| `bitrate` | 8M | H.264 bitrate; about 20M for 4K |
| `codec` | h264 | `h265` if the receivers need it (4K) |
| `profile` | high | H.264 profile: baseline, main or high |
| `preset` | veryfast | encoder speed; `faster` or `medium` look slightly sharper but need more CPU |
| `quality` | 95 | JPEG quality of captured frames |
| `audio` | 1 | silent AAC 48 kHz stereo track, matching the encoders; the receivers stayed white without it. `0` drops it |
| `name` | headpinz | stream path: `rtsp://pc:8554/<name>` |
| `rtsp-port` / `status-port` | 8554 / 8090 | |
| `css` | | extra CSS, for example to hide a cookie banner |
| `browser` | auto | path to chrome.exe or msedge.exe |
| `push` | | publish to another RTSP server instead of the built-in one |

## If a receiver shows nothing

- **Test the stream from another PC.** In VLC, use Media > Open Network Stream with `rtsp://<pc>:8554/headpinz`. If VLC can't play it, it's the firewall or the address.
- **Try a simpler H.264 stream.** Try `--profile=main` or `--profile=baseline`, then `--audio=1`, then `--fps=25`.
- **Check the log.** The status page and the start.cmd window show the browser, encoder and RTSP server state.
