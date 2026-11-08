# Changelog

## [Unreleased]

- Animations and transitions respect the system's "Reduce motion" setting

### Changed
- Development: ESLint 9 with a flat config (`eslint.config.mjs`, replacing `.eslintrc.cjs`), since ESLint 8 is end-of-life. Same rules and the same files are linted.
- Development: `eslint-plugin-no-unsanitized` now fails the lint on any `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` with a non-literal value. Reviewed sinks carry a `reviewed: <why>` comment.

### Security
- Opening an SVG file from someone else could inject markup into the app window: the SVG viewer's sanitizer was a list of regular expressions that missed `<svg/onload=…>`, entity-encoded `javascript:` links, `<animate>`/`<set>` tricks and `<iframe>`. Script execution was still blocked by the Content-Security-Policy, but the sanitizer no longer depends on that: SVG files, Mermaid diagrams, the Markdown preview, slides and the inline KaTeX widgets now all go through DOMPurify (allow-list, bundled, no network) right before they are inserted. Animated SVG (`<animate>`, `<set>`) is no longer animated in the SVG viewer, and `<use>` may only point inside the same SVG.
- The SVG viewer's fallback for non-markup SVG content now builds its `<img>` element with React instead of a string, so a file name containing quotes can't add attributes.

## [1.5.0] - 2026-11-02

### Changed
- React 19 (react, react-dom and their type packages upgraded together).
- Tailwind CSS 4. The theme moved from `tailwind.config.cjs` into `@theme` in `src/renderer/styles/index.css`; the UI looks the same (screenshots of 36 views compared pixel by pixel in light and dark mode). The background blur behind the Web Clipper and workspace wizard dialogs now works as intended.

### Fixed
- Windows: saving could fail with "operation not permitted" when another program (or Klartext's own file watcher) briefly had the file open. Saves now retry for up to about 1.5 seconds before giving up.
- Search & Replace now shows an error when a replace fails, instead of doing nothing.
- Slide deck: in windows narrower than about 1400 px, the presentation toolbar pushed Laser Pointer and Exit off-screen (only the L and Esc shortcuts still worked). The display settings in the middle now give way first, and the buttons no longer overlap.
- Windows: `sh:` / `bash:` template variables now run in Git for Windows' bash when it's installed, instead of silently falling back to cmd.exe (which kept quotes and didn't expand `$VAR`).
- The floating selection toolbar now stays inside the editor pane. In a narrower window it could cover the AI panel's buttons, and after Select All it could be placed off-screen.

### Security
- Template commands are now off by default. Variables that run programs (`<% exec: %>`, `<% sh: %>`, …), fetch URLs (`<% url: %>`, …) or read environment variables (`<% env: %>`) used to run without asking whenever a template was inserted or a document evaluated, so a document from someone else could run commands. Turn them on in Settings → General → Template Commands; even then, Klartext lists exactly what will run and asks first. The working folder must now be inside an open workspace.
- Dependency upgrades fixing 77 Dependabot alerts: Electron 45, electron-builder 26, electron-vite 4, Vite 6.4, Vitest 4, simple-git 4, zod 4, KaTeX 0.18.
- Force every bundled copy of KaTeX (used by Mermaid, rehype-katex and remark-math) to the patched top-level version.

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
