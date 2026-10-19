#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NOTARY_PROFILE="${KLARTEXT_NOTARY_PROFILE:-wiska-notary}"
VERSION="$(node -p "require('./package.json').version")"
APP="dist/mac-arm64/Klartext.app"
ZIP="dist/Klartext-${VERSION}-mac-arm64.zip"

echo "==> 1. Building and signing Klartext v${VERSION} with Developer ID Application certificate..."
rm -rf dist
npm run build
npx electron-builder --dir

echo "==> 2. Verifying inside-out Developer ID signature..."
codesign --verify --deep --strict --verbose=2 "$APP"

echo "==> 3. Creating clean archive (--norsrc --noextattr) and submitting to Apple Notary Service (profile: ${NOTARY_PROFILE})..."
ditto -c -k --norsrc --noextattr --keepParent "$APP" "dist/Klartext-notarize.zip"
xcrun notarytool submit "dist/Klartext-notarize.zip" --keychain-profile "$NOTARY_PROFILE" --wait
rm -f "dist/Klartext-notarize.zip"

echo "==> 4. Stapling Apple Notarization Ticket to ${APP}..."
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"

echo "==> 5. Verifying Gatekeeper & syspolicy_check distribution..."
spctl --assess --type execute --verbose=2 "$APP"
syspolicy_check distribution "$APP"

echo "==> 6. Creating clean notarized release archive ${ZIP} (--norsrc --noextattr) and updating /Applications/Klartext.app..."
ditto -c -k --norsrc --noextattr --keepParent "$APP" "$ZIP"
APPLE_DOUBLE_COUNT="$(unzip -l "$ZIP" | grep -c '/\._' || true)"
if [[ "$APPLE_DOUBLE_COUNT" -ne 0 ]]; then
  echo "ERROR: Release zip still contains ${APPLE_DOUBLE_COUNT} AppleDouble (._) files!" >&2
  exit 1
fi
rm -rf /Applications/Klartext.app
ditto --norsrc --noextattr "$APP" /Applications/Klartext.app

echo "==> Done! Clean notarized release archive (0 AppleDouble files) ready at: ${ZIP}"
