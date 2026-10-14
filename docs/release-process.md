# Release & Cross-Platform Packaging Process

## 1. Supported Deliverables
Klartext packages native installers for all three desktop platforms via `electron-builder.yml` and GitHub Actions (`.github/workflows/ci.yml`):

- **Windows:** NSIS `.exe` installer (`x64`, `arm64`) with `.md`, `.markdown`, and `.klartext-workspace` file associations.
- **macOS:** Hardened Runtime `.dmg` and `.zip` bundles (`arm64`, `x64`) with native inset traffic-light controls.
- **Linux:** `.AppImage` and `.deb` packages with XDG MIME associations.

## 2. Pre-Release Checklist
1. Verify clean typecheck and lint:
   ```bash
   npm run typecheck && npm run lint
   ```
2. Run full unit, security, and integration suites:
   ```bash
   npm test
   ```
3. Build production bundles and run Playwright Electron E2E tests:
   ```bash
   npm run build && npm run test:e2e
   ```
4. Build platform package:
   ```bash
   npm run package
   ```
