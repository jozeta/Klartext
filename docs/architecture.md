# Klartext Architecture

## 1. Process Boundaries

Klartext enforces strict separation between three Electron processes:

1. **Sandboxed Renderer Process (`src/renderer/`):**
   - Runs React 18, CodeMirror 6 (`EditorState` / `EditorView`), Mermaid strict SVG rendering, and the Excalidraw `.excalidraw.svg` editor.
   - Configured with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
   - Zero direct access to Node.js `fs`, `child_process`, or external network sockets.

2. **Preload ContextBridge (`src/preload/index.ts`):**
   - Exposes a strictly typed allowlist (`window.klartext`) over `contextBridge.exposeInMainWorld`.
   - Does **not** expose raw `ipcRenderer` or arbitrary channel invocation.

3. **Electron Main Process (`src/main/`):**
   - Validates every incoming IPC payload with Zod schemas (`src/shared/schemas/index.ts`).
   - Enforces canonical path confinement across all mounted root directories via `MultiRootPathGuard` (`src/main/security/path-guard.ts`).
   - Serves local root-scoped images and `.excalidraw.svg` drawings via the custom `klartext-asset://<rootId>/<relativePath>` protocol.
   - Orchestrates `MultiRootWatcher`, `MultiRepoManager`, `RecoveryService`, `SettingsAndCredentialService`, `ExportService`, and `LocalAIOrchestrator`.

## 2. Multi-Root & Multi-Repo State Model

- `MultiRootRegistry` (`src/main/workspace/multi-root-registry.ts`) maintains the ordered list of mounted workspace roots and synchronizes them with `MultiRootPathGuard`.
- `MultiRepoManager` (`src/main/git/multi-repo-manager.ts`) maintains a `Map<RootId, GitRepoInstance>`. Each `GitRepoInstance` serializes Git commands for its root via an internal promise queue so concurrent UI actions or background fetches never collide on `.git/index.lock`.
- `syncAllRepositories()` uses `Promise.allSettled()` across all Git-backed roots so clean repositories complete pushing even when another repository enters `Merge Conflict` state.
