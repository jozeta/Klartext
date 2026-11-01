# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Klartext is a local-first, cross-platform Markdown editor (Electron + React + TypeScript) built
on a single-buffer CodeMirror 6 engine with Source, Live Inline Rich and Split View modes, plus
Mermaid, KaTeX, a visual diagram builder, multi-root workspaces with concurrent multi-repo Git
sync, and a bilingual (Swedish/English) local AI assistant.

## Commands

```sh
npm install
npm run dev            # Electron dev mode with hot reload (electron-vite)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src --ext .ts,.tsx
npm test               # vitest: unit + security + integration
npm run test:unit      # src/tests/unit + src/tests/security
npm run test:integration
npm run build          # production main/preload/renderer bundles
npm run test:e2e       # Playwright Electron E2E (needs a build first)
npm run package        # dist/mac-arm64/Klartext.app (electron-builder --dir)
npm run release:mac    # scripts/release.sh (signing; see docs/release-process.md)
```

CI (`.github/workflows/ci.yml`, Node 22, OS matrix) runs typecheck → lint → test → build → e2e →
package. Run at least typecheck, lint and `npm test` before committing.

## Architecture (see docs/architecture.md, docs/security.md)

Three strictly separated processes:

1. **Renderer** (`src/renderer/`): React, CodeMirror, Mermaid (strict SVG). `contextIsolation`,
   `sandbox: true`, `nodeIntegration: false`: no `fs`, `child_process` or network access.
2. **Preload** (`src/preload/index.ts`): exposes a typed allowlist as `window.klartext` via
   `contextBridge`. Never expose raw `ipcRenderer` or a generic invoke.
3. **Main** (`src/main/`): validates **every** IPC payload with Zod schemas
   (`src/shared/schemas/`); confines all paths to mounted roots via `MultiRootPathGuard`
   (`src/main/security/path-guard.ts`); serves assets through `klartext-asset://<rootId>/<path>`.
   Services live in `ai/`, `assets/`, `export/`, `git/`, `ipc/`, `recovery/`, `search/`,
   `security/`, `settings/`, `watcher/`, `workspace/`.

Shared code is in `src/shared/` (types, schemas, markdown, serialization, templates, icons).

## Rules

- **Adding an IPC channel** means: a Zod schema in `src/shared/schemas`, a handler in
  `src/main/ipc`, a typed method on the preload bridge, and a security test.
- Never let a path from the renderer reach `fs` without going through the path guard.
- Git: each root has its own `GitRepoInstance` with a serialized command queue and
  `core.hooksPath=/dev/null`. Keep commands queued; never run hooks from opened repos.
  `syncAllRepositories()` uses `Promise.allSettled` so one conflict doesn't block others.
- Pasted/dropped assets go into `<ActiveRoot>/assets/` of the document's own root.
- `showcase/` and `demo-workspace/` are user-facing sample Markdown (also used for the README
  screenshots); keep them rendering correctly.
- Update `CHANGELOG.md` for user-visible changes.
