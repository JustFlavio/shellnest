#!/bin/sh
# Installs the latest Shellnest AppImage for the current user and adds it to the application menu.
# It stays an AppImage, so the in-app updater keeps working (a .deb cannot update itself).
#   curl -fsSL https://raw.githubusercontent.com/JustFlavio/shellnest/main/install.sh | sh
set -eu

BASE="https://github.com/JustFlavio/shellnest/releases/download/updater"
FILE="Shellnest_amd64.AppImage"
BIN="${HOME}/.local/bin"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps"

[ "$(uname -s)" = "Linux" ] && [ "$(uname -m)" = "x86_64" ] || {
  echo "This installer is for Linux x86_64 only." >&2
  exit 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading Shellnest…"
curl -fsSL "$BASE/$FILE" -o "$tmp/$FILE"
curl -fsSL "$BASE/SHA256SUMS" -o "$tmp/SHA256SUMS"
# The builds are not code-signed: the checksum only proves the download is the published file.
(cd "$tmp" && grep " $FILE\$" SHA256SUMS | sha256sum -c -)

mkdir -p "$BIN" "$APPS" "$ICONS"
install -m 755 "$tmp/$FILE" "$BIN/shellnest.AppImage"

# The icon is read out of the AppImage itself.
(cd "$tmp" && "$BIN/shellnest.AppImage" --appimage-extract 'usr/share/icons/hicolor/*/apps/*.png' >/dev/null 2>&1) || true
icon="$(ls "$tmp"/squashfs-root/usr/share/icons/hicolor/*/apps/*.png 2>/dev/null | tail -n 1 || true)"
[ -n "$icon" ] && cp "$icon" "$ICONS/shellnest.png"

cat > "$APPS/shellnest.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Shellnest
Comment=SSH client
Exec=$BIN/shellnest.AppImage
Icon=shellnest
Categories=Network;System;
Terminal=false
DESKTOP

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" || true
echo "Installed. Open Shellnest from the application menu."
