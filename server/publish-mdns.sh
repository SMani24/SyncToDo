#!/usr/bin/env bash
# Continuous mDNS publisher for g16laptop.local across the local network

cleanup() {
  if [ -n "$PUB_PID" ]; then kill -TERM "$PUB_PID" 2>/dev/null || true; fi
  if [ -n "$SRV_PID" ]; then kill -TERM "$SRV_PID" 2>/dev/null || true; fi
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

while true; do
  # Determine active LAN IPv4 address (prefer 192.168.x.x, ignore virtual/VPN interfaces)
  IP=$(ip -4 -o addr show | awk '{print $4}' | cut -d/ -f1 | grep -E '^192\.168\.' | head -n1)
  if [ -z "$IP" ]; then
    IP=$(ip -4 -o addr show | awk '{print $4}' | cut -d/ -f1 | grep -vE '^(127\.|172\.)' | head -n1)
  fi

  if [ -n "$IP" ]; then
    echo "[mDNS] Publishing g16laptop.local on $IP..."
    /usr/bin/avahi-publish -a -R g16laptop.local "$IP" &
    PUB_PID=$!

    /usr/bin/avahi-publish -s "SyncToDo" _http._tcp 4000 "path=/" --host=g16laptop.local &
    SRV_PID=$!

    wait $PUB_PID $SRV_PID 2>/dev/null || true
  fi

  sleep 3
done
