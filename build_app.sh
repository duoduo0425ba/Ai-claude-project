#!/bin/bash
# MacOS app launcher for Pocket Money App

APP_NAME="零花钱记账.app"
APP_DIR="/Users/huanghui/Ai-test/$APP_NAME"
DESKTOP_DIR="/Users/huanghui/Desktop/$APP_NAME"
IMG="/Users/huanghui/.gemini/antigravity/brain/d4ad5c4d-493c-4ddd-abd6-d319f4e529c7/sakura_app_icon_1775648979691.png"

# 1. Create AppleScript payload
cat << 'EOF' > /tmp/Launcher.applescript
tell application "Terminal"
    do script "cd '/Users/huanghui/Ai-test' && pkill -f 'node index.js' 2>/dev/null; pkill -f 'vite' 2>/dev/null; npm run dev"
    activate
end tell
delay 3
do shell script "open http://localhost:5173"
EOF

# 2. Compile AppleScript to the current workspace
echo "Compiling AppleScript to $APP_DIR..."
osacompile -o "$APP_DIR" /tmp/Launcher.applescript

if [ ! -d "$APP_DIR" ]; then
    echo "Error: Failed to create app."
    exit 1
fi

# 3. Create icns icon from PNG
echo "Generating .icns icon..."
rm -rf /tmp/MyIcon.iconset /tmp/MyIcon.icns
mkdir /tmp/MyIcon.iconset
sips -s format png -z 16 16     "$IMG" --out /tmp/MyIcon.iconset/icon_16x16.png
sips -s format png -z 32 32     "$IMG" --out /tmp/MyIcon.iconset/icon_16x16@2x.png
sips -s format png -z 32 32     "$IMG" --out /tmp/MyIcon.iconset/icon_32x32.png
sips -s format png -z 64 64     "$IMG" --out /tmp/MyIcon.iconset/icon_32x32@2x.png
sips -s format png -z 128 128   "$IMG" --out /tmp/MyIcon.iconset/icon_128x128.png
sips -s format png -z 256 256   "$IMG" --out /tmp/MyIcon.iconset/icon_128x128@2x.png
sips -s format png -z 256 256   "$IMG" --out /tmp/MyIcon.iconset/icon_256x256.png
sips -s format png -z 512 512   "$IMG" --out /tmp/MyIcon.iconset/icon_256x256@2x.png
sips -s format png -z 512 512   "$IMG" --out /tmp/MyIcon.iconset/icon_512x512.png
sips -s format png -z 1024 1024 "$IMG" --out /tmp/MyIcon.iconset/icon_512x512@2x.png
iconutil -c icns /tmp/MyIcon.iconset

# 4. Apply icon to app bundle
cp /tmp/MyIcon.icns "$APP_DIR/Contents/Resources/applet.icns"
touch "$APP_DIR"

echo "App Created."

# 5. Try moving to desktop
mv "$APP_DIR" "/Users/huanghui/Desktop/" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Successfully moved to Desktop."
else
    echo "Could not move to Desktop due to permissions. App left in /Users/huanghui/Ai-test/."
fi
