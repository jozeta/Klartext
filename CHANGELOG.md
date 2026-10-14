# Changelog

## [1.0.0] - 2026-10-14

### Added
- **Phase 0 (Architecture & Security Foundation):**
  - Electron + `electron-vite` + React 18 + TypeScript + Tailwind CSS + Zod IPC boundary (`window.klartext`).
  - `MultiRootPathGuard` enforcing per-root `fs.realpath` confinement, symlink escape detection, sensitive directory blocking, and `klartext-asset://<rootId>/` custom protocol.
  - CodeMirror 6 Live Inline Rich mode (`live-preview-extension.ts`) and interactive Mermaid diagram rendering.
- **Phase 1 (Technical Nordic UI Shell & Multi-Root Workspace):**
  - Frameless Technical Nordic window shell with Light, Dark (plus optional White Paper Canvas), and OS themes, collapsible Left/Right panels, configurable page tab placement, Zen mode (`Cmd/Ctrl + Shift + F`), Command Palette (`Cmd/Ctrl + K`), and Quick Switcher (`Cmd/Ctrl + P`).
  - Clean-slate first-launch experience and full persistence of window bounds, sidebar widths, Split View divider ratio, open tabs, and settings across restarts.
  - `MultiRootRegistry` supporting single-folder and multi-root workspaces, root path hover tooltip and double-click to open in Finder, portable `.klartext-workspace` manifests, `MultiRootWatcher`, and `RecoveryService`.
- **Phase 2 (Rich Markdown, Per-Root Assets & Visual Diagram Builder):**
  - Full GFM tables, TSV/CSV smart paste, KaTeX math, YAML frontmatter property editor, callouts, `[[WikiLinks]]`, Outline, and Backlinks panels.
  - Root-scoped asset importing (`AssetAndDocumentService`), interactive image resizing handles, and automatic cross-root asset migration when moving Markdown files across roots.
  - Interactive Mermaid (`securityLevel: 'strict'`) diagram widgets and built-in 2D Visual Diagram Builder starting on a clean canvas.
- **Phase 3 (Multi-Root Search & Concurrent Multi-Repo Git):**
  - `MultiRootSearchService` with per-root filtering and bulk replace confirmation.
  - `MultiRepoManager` and `GitRepoInstance` supporting concurrent `Sync All Repositories` (`Promise.allSettled`), per-repo mutexes, and interactive inline/3-way merge conflict resolution (`conflict-resolver.ts`).
- **Phase 4 (Local AI Assistant, Hardware Advisor & Export):**
  - Main-process `LocalAIOrchestrator` for Ollama (`127.0.0.1:11434`) and OpenAI-compatible servers (`127.0.0.1:1234/v1`) with streaming cancellation, `<think>`/preamble stripping, and mandatory inline diff review.
  - `HardwareAdvisor` detecting system RAM/CPU and recommending vetted English & Swedish models across 4 hardware tiers.
  - Standalone HTML and print-CSS PDF export via `ExportService`.
