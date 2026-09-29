@echo off
REM HeadPinz web page -> RTSP streamer. Double-click to start. Close this window to stop.
REM Options, e.g.:  start.cmd --url=https://headpinz.com --fps=30 --bitrate=8M
REM Status page: http://localhost:8090   Stream: rtsp://<this-pc-ip>:8554/headpinz
cd /d "%~dp0"
title HeadPinz web to RTSP
if exist "%~dp0node\node.exe" (set "NODE=%~dp0node\node.exe") else (set "NODE=node")
if not exist "%~dp0bin\mediamtx.exe" "%NODE%" setup.mjs
"%NODE%" streamer.mjs %*
echo.
echo Streamer stopped. Press any key to close.
pause >nul
