#!/bin/bash
set -euo pipefail

APP_NAME="零花钱记账.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/$APP_NAME"
DESKTOP_DIR="${HOME}/Desktop/$APP_NAME"
DEV_URL="${DEV_URL:-http://localhost:5173}"
ICON_SOURCE="${1:-${APP_ICON:-}}"

tmp_dir="$(mktemp -d)"
iconset_dir="$tmp_dir/MyIcon.iconset"
applescript_path="$tmp_dir/Launcher.applescript"

cleanup() {
  rm -rf "$tmp_dir"
}

trap cleanup EXIT

cat > "$applescript_path" <<EOF
tell application "Terminal"
    do script "cd '$SCRIPT_DIR' && pkill -f 'node index.js' 2>/dev/null; pkill -f 'vite' 2>/dev/null; npm run dev"
    activate
end tell
delay 3
do shell script "open '$DEV_URL'"
EOF

echo "Compiling AppleScript to $APP_DIR..."
osacompile -o "$APP_DIR" "$applescript_path"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: Failed to create app."
  exit 1
fi

if [ -n "$ICON_SOURCE" ]; then
  if [ ! -f "$ICON_SOURCE" ]; then
    echo "Error: Icon file not found: $ICON_SOURCE"
    exit 1
  fi

  echo "Generating .icns icon..."
  mkdir -p "$iconset_dir"
  sips -s format png -z 16 16     "$ICON_SOURCE" --out "$iconset_dir/icon_16x16.png" >/dev/null
  sips -s format png -z 32 32     "$ICON_SOURCE" --out "$iconset_dir/icon_16x16@2x.png" >/dev/null
  sips -s format png -z 32 32     "$ICON_SOURCE" --out "$iconset_dir/icon_32x32.png" >/dev/null
  sips -s format png -z 64 64     "$ICON_SOURCE" --out "$iconset_dir/icon_32x32@2x.png" >/dev/null
  sips -s format png -z 128 128   "$ICON_SOURCE" --out "$iconset_dir/icon_128x128.png" >/dev/null
  sips -s format png -z 256 256   "$ICON_SOURCE" --out "$iconset_dir/icon_128x128@2x.png" >/dev/null
  sips -s format png -z 256 256   "$ICON_SOURCE" --out "$iconset_dir/icon_256x256.png" >/dev/null
  sips -s format png -z 512 512   "$ICON_SOURCE" --out "$iconset_dir/icon_256x256@2x.png" >/dev/null
  sips -s format png -z 512 512   "$ICON_SOURCE" --out "$iconset_dir/icon_512x512.png" >/dev/null
  sips -s format png -z 1024 1024 "$ICON_SOURCE" --out "$iconset_dir/icon_512x512@2x.png" >/dev/null
  iconutil -c icns "$iconset_dir" -o "$tmp_dir/MyIcon.icns"

  cp "$tmp_dir/MyIcon.icns" "$APP_DIR/Contents/Resources/applet.icns"
  touch "$APP_DIR"
else
  echo "No icon provided, keeping the default app icon."
fi

echo "App created."

if mv "$APP_DIR" "$DESKTOP_DIR" 2>/dev/null; then
  echo "Successfully moved to Desktop: $DESKTOP_DIR"
else
  echo "Could not move to Desktop due to permissions. App left in $APP_DIR."
fi
