#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/wordpress-plugin"
DIST_DIR="$ROOT_DIR/dist"
PACKAGE_DIR="$DIST_DIR/helix-wordpress-plugin"
ZIP_PATH="$DIST_DIR/helix-wordpress-plugin.zip"

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR" "$DIST_DIR"
cp -R "$PLUGIN_DIR"/. "$PACKAGE_DIR"/
rm -f "$ZIP_PATH"
(
  cd "$DIST_DIR"
  zip -rq "$(basename "$ZIP_PATH")" "$(basename "$PACKAGE_DIR")"
)

echo "Created $ZIP_PATH"
