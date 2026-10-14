# Klartext

**Klartext** is a fast, local-first, cross-platform Markdown editor for Windows, macOS, and Linux. It combines a single-buffer **CodeMirror 6** editing engine (Source, Live Inline Rich, and Split modes), inline **Excalidraw (`.excalidraw.svg`)** and **Mermaid** diagrams, **Multi-Root Workspaces** with strict per-root asset portability, **Concurrent Multi-Repository Git synchronization**, and an optional **Local AI Assistant** (`localhost` via Ollama or LM Studio) with a built-in **Hardware & Model Advisor** for English and Swedish.

---

## Core Features

1. **Technical Nordic UI Shell:**
   - Frameless native window chrome with Light, Dark, and OS-following themes powered by semantic CSS variables.
   - Independently collapsible Left Sidebar, Right Local AI Utility Panel, Bottom Status Bar, and **Zen Mode** (`Cmd/Ctrl + Shift + F`).
   - Instant **Command Palette** (`Cmd/Ctrl + K`) and **Quick File Switcher** (`Cmd/Ctrl + P`).

2. **Three Seamless Editing Modes on One Buffer:**
   - **Source Mode:** Full CodeMirror 6 Markdown source with line numbers and multi-cursor support.
   - **Inline Rich Mode (Live Preview):** Hides raw Markdown syntax tokens on inactive lines and renders headings, bold text, callouts, interactive task checkboxes, Mermaid diagrams, and Excalidraw cards inline while revealing raw tokens on the active cursor line.
   - **Split Mode:** Side-by-side source and sanitized preview with synchronized scrolling.

3. **Multi-Root Workspaces & Per-Root Asset Scoping:**
   - Mount multiple folders from any local path into a unified workspace and save portable `.klartext-workspace` manifests.
   - Pasted or dropped images and `.excalidraw.svg` drawings are saved strictly inside the active document's owning root (`<ActiveRoot>/<assetDir>/`).
   - Moving a Markdown file across roots automatically detects referenced local assets and offers to migrate them and rewrite relative links.

4. **Concurrent Multi-Repository Git & Isolated Conflict Resolution:**
   - Independent `GitRepoInstance` controllers per root folder with per-repo mutexes and `core.hooksPath=/dev/null` hardening.
   - **Sync All Repositories** runs `fetch -> pull -> push` concurrently across all mounted Git repositories (`Promise.allSettled`), ensuring a merge conflict in Repo A never blocks Repo B.
   - Interactive inline conflict action lenses (`Accept Current`, `Accept Incoming`, `Accept Both`, `3-Way Diff`, `Abort Merge`) backed by pre-merge crash recovery snapshots.

5. **Optional Local AI Assistant & Hardware Advisor (English & Svenska):**
   - 100% loopback (`127.0.0.1`) HTTP streaming from the Electron Main Process (zero CORS issues, strict SSRF protection).
   - Built-in **Hardware & Model Advisor** inspecting system RAM/CPU and recommending vetted English & Swedish models (`gemma4:12b`, `qwen3:8b`, `mistral-small:24b`, `gemma4:26b`, `bge-m3`).
   - Deterministic output hygiene filter stripping `<think>` reasoning blocks and conversational filler, paired with mandatory inline diff review (`Accept` / `Reject`).

---

## Development Commands

```bash
# Install dependencies
npm install

# Start Electron development mode with hot reload
npm run dev

# Run TypeScript typechecking
npm run typecheck

# Run ESLint
npm run lint

# Run Vitest unit, security, and integration test suites
npm test

# Build production Main, Preload, and Renderer bundles
npm run build

# Run Playwright Electron End-to-End tests
npm run test:e2e

# Package desktop application bundle
npm run package
```

## Documentation Index

- [Architecture Overview](docs/architecture.md)
- [Security & Threat Model](docs/security.md)
- [Markdown Compatibility Matrix](docs/markdown-compatibility.md)
- [Local AI Setup & Swedish/English Model Guide](docs/local-ai-guide.md)
- [Testing & Verification Guide](docs/testing.md)
- [Release & Packaging Process](docs/release-process.md)
- [Changelog](CHANGELOG.md)
