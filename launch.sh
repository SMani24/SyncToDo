#!/usr/bin/env bash

# SyncToDo Desktop Launcher
LOG_FILE="/tmp/synctodo-launcher.log"
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "Launching SyncToDo at $(date)"
echo "User: $(whoami), DISPLAY: $DISPLAY"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR:-/home/smani24/Desktop/Repositories/SyncToDo}"
PORT=4000
URL="http://localhost:$PORT"

# Ensure Node is found
NODE_BIN="/home/smani24/.nvm/versions/node/v24.21.0/bin/node"
if [ ! -x "$NODE_BIN" ]; then
    NODE_BIN="$(which node 2>/dev/null || echo "node")"
fi
export PATH="/home/smani24/.nvm/versions/node/v24.21.0/bin:$PATH"

echo "Using Node: $NODE_BIN"

# Check if server is already responding
if ! curl -s --max-time 1 "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo "Starting SyncToDo background server..."
    cd "$APP_DIR"
    nohup "$NODE_BIN" server/server.js >> /tmp/synctodo-server.log 2>&1 &
    SERVER_PID=$!
    disown $SERVER_PID 2>/dev/null || true
    echo "Spawned server PID: $SERVER_PID"

    # Wait for server to bind port
    for i in {1..20}; do
        if curl -s --max-time 1 "http://localhost:$PORT/health" > /dev/null 2>&1; then
            echo "Server ready after $i iterations"
            break
        fi
        sleep 0.2
    done
else
    echo "Server already running on port $PORT"
fi

# Open in browser
echo "Opening $URL in browser..."

if command -v google-chrome > /dev/null 2>&1; then
    echo "Opening with google-chrome --app"
    google-chrome --app="$URL" &
elif command -v chromium > /dev/null 2>&1; then
    echo "Opening with chromium --app"
    chromium --app="$URL" &
elif command -v firefox > /dev/null 2>&1; then
    echo "Opening with firefox"
    firefox --new-window "$URL" &
elif command -v xdg-open > /dev/null 2>&1; then
    echo "Opening with xdg-open"
    xdg-open "$URL" &
else
    echo "ERROR: No browser found!"
fi

echo "Launcher finished."
