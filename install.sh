#!/bin/sh
# Install the desktop app from the latest stable GitHub release.
set -eu

repo=https://github.com/4mGLn/todoffice
fail() { printf 'TodOffice: %s\n' "$*" >&2; exit 1; }
fetch() { curl --proto '=https' --proto-redir '=https' -fsSL "$@"; }

install_linux() {
  destination=${XDG_BIN_HOME:-"$HOME/.local/bin"}
  mkdir -p "$destination"
  target="$destination/todoffice-desktop"
  [ ! -d "$target" ] || fail "Expected a file at $target"
  staged=$(mktemp "$destination/.todoffice.XXXXXXXX")
  trap 'rm -f "$staged"' EXIT
  trap 'exit 1' HUP INT TERM
  fetch -o "$staged" "$base/todoffice-$version.AppImage" || fail "Linux x64 AppImage unavailable for $tag"
  [ -s "$staged" ] || fail 'Empty AppImage'
  chmod 755 "$staged"
  mv -f "$staged" "$target"
  printf 'Installed TodOffice. Run "%s" to open it.\n' "$target"
}

install_mac() {
  applications="$HOME/Applications"
  mkdir -p "$applications"
  target="$applications/TodOffice.app"
  # Stage the new bundle on the destination filesystem. Keep the previous
  # version until the replacement is ready, including on failed downloads.
  lock="$applications/.todoffice-install"
  mkdir "$lock" || fail "Installer workspace already exists: $lock"
  mounted=false
  cleanup_mac() {
    if [ "$mounted" = true ]; then hdiutil detach "$lock/volume" -quiet || return 1; fi
    if [ -e "$lock/previous.app" ] && [ ! -e "$target" ]; then
      mv "$lock/previous.app" "$target" || return 1
    fi
    rm -rf "$lock"
  }
  trap cleanup_mac EXIT
  trap 'exit 1' HUP INT TERM
  if [ -e "$target" ] || [ -L "$target" ]; then
    [ ! -L "$target" ] && [ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$target/Contents/Info.plist")" = org.todoffice.app ] || fail "Unexpected app at $target"
  fi
  fetch -o "$lock/package.dmg" "$base/TodOffice-$version-$arch.dmg" || fail "macOS $arch package unavailable for $tag"
  mkdir "$lock/volume"
  hdiutil attach -readonly -nobrowse -quiet -mountpoint "$lock/volume" "$lock/package.dmg"
  mounted=true
  bundle="$lock/volume/TodOffice.app"
  [ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$bundle/Contents/Info.plist")" = org.todoffice.app ] || fail 'Unexpected app in disk image'
  ditto "$bundle" "$lock/TodOffice.app"
  hdiutil detach "$lock/volume" -quiet
  mounted=false
  if [ -e "$target" ]; then mv "$target" "$lock/previous.app"; fi
  mv "$lock/TodOffice.app" "$target"
  printf 'Installed %s\n' "$target"
}

main() {
  case "$(uname -s):$(uname -m)" in
    Linux:x86_64) platform=linux ;;
    Darwin:arm64) platform=mac; arch=arm64 ;;
    Darwin:x86_64)
      platform=mac
      if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then arch=arm64; else arch=x64; fi ;;
    *) fail 'Supported platforms: Linux x86_64, macOS Apple silicon and Intel' ;;
  esac
  latest=$(fetch -I -o /dev/null -w '%{url_effective}' "$repo/releases/latest") || fail "Cannot resolve the latest release: $repo/releases"
  case "$latest" in
    "$repo/releases/tag/"*) tag=${latest##*/} ;;
    *) fail "No stable TodOffice release is available: $repo/releases" ;;
  esac
  version=${tag#v}
  case "$version" in ''|[!0-9]*|*[!0-9A-Za-z.+-]*) fail "Unexpected release tag: $tag" ;; esac
  base="$repo/releases/download/$tag"
  case "$platform" in linux) install_linux ;; mac) install_mac ;; esac
}

main "$@"
