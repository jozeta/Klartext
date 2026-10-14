# Testing & Verification Guide

Klartext includes three automated test layers:

## 1. Unit & Security Tests (`src/tests/unit/`, `src/tests/security/`)
Run with:
```bash
npm run test:unit
```
Covers:
- Malicious Markdown XSS (`<script>`, `<img onerror>`, `<iframe>`, dangerous URL schemes).
- Forged IPC path traversal (`../../../../etc/passwd`) and cross-root traversal attempts.
- Sensitive system directory rejection (`/etc`, `~/.ssh`) in `.klartext-workspace` manifests.
- Symlink escape blocking outside mounted roots.
- SSRF loopback enforcement on Local AI endpoints.
- YAML frontmatter, GFM table alignment, `.excalidraw.svg` round-trip metadata serialization, Git conflict hunk resolution, and Hardware Advisor tier calculation.

## 2. Integration Tests (`src/tests/integration/`)
Run with:
```bash
npm run test:integration
```
Covers:
- Root-scoped asset saving into `<ActiveRoot>/<assetDir>/images/`.
- Cross-root Markdown file moves with automatic asset migration and relative link rewriting.
- Multi-root full-text search, per-root filtering, bulk replace, and cross-root backlinks.
- Concurrent multi-repository Git sync (`Promise.allSettled`) with isolated merge conflict resolution.
- Local mock Ollama (`127.0.0.1`) streaming, `<think>` stripping, and standalone HTML export.

## 3. End-to-End Electron Tests (`src/tests/e2e/`)
Run after building (`npm run build`):
```bash
npm run test:e2e
```
Launches the compiled Electron application via Playwright and exercises all 17 critical user journeys end-to-end.
