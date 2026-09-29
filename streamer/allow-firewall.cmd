@echo off
REM Run once as Administrator (right-click > Run as administrator): lets the receivers reach the RTSP stream
REM and lets you open the status page from another device.
netsh advfirewall firewall add rule name="HeadPinz RTSP (TCP 8554)" dir=in action=allow protocol=TCP localport=8554
netsh advfirewall firewall add rule name="HeadPinz RTSP (UDP 8000-8001)" dir=in action=allow protocol=UDP localport=8000-8001
netsh advfirewall firewall add rule name="HeadPinz RTSP status (TCP 8090)" dir=in action=allow protocol=TCP localport=8090
echo Done.
pause
