#!/bin/bash
#
# install-autobugfix.sh
# One-time installer. Writes a launchd job that runs scripts/auto-bugfix.sh
# every day at 5:00 AM local (just after the 4:06 AM triage), and loads it.
#
# Run once:   bash scripts/install-autobugfix.sh
# Uninstall:  launchctl unload -w ~/Library/LaunchAgents/com.linestry.autobugfix.plist
#
set -euo pipefail

REPO="${LINESTRY_REPO:-$HOME/lineage}"
SCRIPT="$REPO/scripts/auto-bugfix.sh"
LABEL="com.linestry.autobugfix"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HOUR=5
MINUTE=0

[ -f "$SCRIPT" ] || { echo "ERROR: $SCRIPT not found"; exit 1; }
chmod +x "$SCRIPT" "$REPO/scripts/install-autobugfix.sh"

# Build a PATH that includes wherever claude, gh, node, npm, git actually live,
# because launchd jobs start with a bare PATH.
detect_dir() { command -v "$1" >/dev/null 2>&1 && dirname "$(command -v "$1")"; }
PATHS="$(printf '%s\n' \
  "$(detect_dir claude)" "$(detect_dir gh)" "$(detect_dir node)" \
  "$(detect_dir npm)" "$(detect_dir npx)" "$(detect_dir git)" \
  /opt/homebrew/bin /usr/local/bin /usr/bin /bin /usr/sbin /sbin \
  | awk 'NF' | awk '!seen[$0]++' | paste -sd: -)"

for tool in claude gh node npm git; do
  command -v "$tool" >/dev/null 2>&1 || echo "WARNING: '$tool' not found on PATH; the job may fail until it is installed."
done

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$PATHS</string>
    <key>HOME</key><string>$HOME</string>
    <key>LINESTRY_REPO</key><string>$REPO</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$HOUR</integer>
    <key>Minute</key><integer>$MINUTE</integer>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/linestry-autobugfix/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/linestry-autobugfix/launchd.err.log</string>
</dict>
</plist>
PLISTEOF

mkdir -p "$HOME/Library/Logs/linestry-autobugfix"
launchctl unload -w "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo "Installed and loaded: $LABEL"
echo "Runs daily at $(printf '%02d:%02d' $HOUR $MINUTE) local."
echo "PATH baked in: $PATHS"
echo
echo "Test it now without waiting (always leaves a draft, never merges):"
echo "    bash $SCRIPT --dry-run"
