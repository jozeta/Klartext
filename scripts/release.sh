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

echo "==> 3. Creating archive and submitting to Apple Notary Service (profile: ${NOTARY_PROFILE})..."
ditto -c -k --sequesterRsrc --keepParent "$APP" "dist/Klartext-notarize.zip"
xcrun notarytool submit "dist/Klartext-notarize.zip" --keychain-profile "$NOTARY_PROFILE" --wait
rm -f "dist/Klartext-notarize.zip"

echo "==> 4. Stapling Apple Notarization Ticket to ${APP}..."
xcrun stapler staple "$APP"

echo "==> 5. Verifying Gatekeeper acceptance (Notarized Developer ID)..."
spctl --assess --type execute --verbose=2 "$APP"

echo "==> 6. Creating notarized release archive ${ZIP} and updating /Applications/Klartext.app..."
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
rm -rf /Applications/Klartext.app
ditto "$APP" /Applications/Klartext.app

echo "==> Done! Notarized release archive ready at: ${ZIP}"
