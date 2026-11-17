# Changelog

## [Unreleased]

## [1.5.3] - 2026-11-17

### Fixed
- Dragging an image onto a file you had just opened (without clicking in it first) put the image
  link at the very top, inside the frontmatter. Dropped files now go where you drop them (the drop
  cursor), and never inside the frontmatter.
- Renaming a file by changing only the case of its name (`note.md` → `Note.md`) deleted the file on
  macOS and Windows. It is now renamed in place.
- Renaming a file onto the name of another file overwrote that file; it is now refused.
- Moving a document to another root overwrote a different image with the same name there (pasted
  images are often all called `image.png`), and could overwrite a document with the same name. The
  image is now copied under a free name (`image-2.png`, or reused if it is identical), and the move
  is refused if the document already exists.
- Typing in a second tab (split view, or quickly switching tabs) within 0.9 s of typing in the first
  cancelled the first tab's autosave and its recovery snapshot, and quitting within 0.9 s of typing
  lost the last edits. Every tab now saves on its own timer, closing a tab saves it at once, and
  closing the window or quitting waits for pending saves.
- A change made by another program (git pull, a sync tool, another editor) to an open document was
  ignored while you had unsaved edits, or within 5 s of Klartext's own save, and the next autosave
  then overwrote it. Klartext now recognises its own saves by content, and when the file changes
  under unsaved edits it shows a banner to **Reload from disk** or **Keep my version**; until you
  choose, the file is not overwritten (your edits are kept in a recovery snapshot). Documents in the
  split view's second pane are now reloaded too.
- A burst of file changes (switching branches, a large pull) made Klartext re-read every folder and
  run `git status` on every repository once per changed file. It now refreshes once per burst.
- Regex Replace changed fewer places than Search had found (`^` and `$` matched only at the start and
  end of the file) and inserted `$1` literally. It now matches line by line like Search, and `$1`,
  `$&` and `$<name>` work. Plain-text replace still inserts `$` as typed.
- A root folder on an unplugged drive or a missing network share was recreated as an empty folder at
  startup (or when loading a manifest). It is now skipped and comes back when the folder is there
  again.
- One invalid value in `settings.json` reset every setting, custom templates included. Only that
  value now falls back to its default, and the old file is kept as `settings.json.bak`.
- The workspace state file is written atomically, so a crash while saving can't leave the workspace
  empty on the next start.
- Symlinked files and folders inside a root didn't appear in the file tree (links that point outside
  the root are still hidden).
- File names starting with two dots (`..notes.md`) were rejected as path traversal.

### Changed
- Settings → Workspace Manifest: **Save Manifest** and **Load Manifest** open the system's save/open
  dialog (a path typed in the field is the starting point). Loading a manifest always asks before
  mounting its folders.

### Security
- Resolving a Git merge conflict, staging, unstaging, diffing and committing took file paths from
  the app window without checking them, so a crafted path (`../…`) could read or rewrite files
  outside the repository. They now go through the same path guard as every other file operation.
  Branch names starting with `-` are refused and file names are passed to git after `--`, so a
  name like `--force` can't be read as an option.
- Writing, creating, deleting and renaming refuse a path that points at the root folder itself
  (`.`, `sub/..`), so a bad path can never delete a whole root.
- The app window could choose any output file for exports and any file to save or load a workspace
  manifest from, and could skip the confirmation before a manifest's folders are mounted. The output
  file is now always chosen in a native dialog shown by the main process, and the confirmation
  can't be skipped.
- When the system keychain is not available (e.g. Linux without a keyring), credentials were stored
  base64-encoded, which anyone can read. Klartext now refuses to store them and says why.
- Dev dependencies: `minimatch` 7.0.0–11.0.0 (pulled in by typescript-eslint and the Electron build tools) is
  overridden to ^11.0.1, fixing Dependabot alert 87 (denial of service via globparts amplification).
  Not shipped in the app.

## [1.5.2] - 2026-11-16

### Fixed
- The menu's "About Klartext..." entry showed a hard-coded v1.5.0; it now shows `APP_METADATA.version`,
  and a unit test keeps version numbers from being typed into `App.tsx`.
- The Playwright E2E tests compared the About page and the update check with a hard-coded 1.5.0, so
  the 1.5.1 bump failed CI on all three platforms; they now read `package.json`.

## [1.5.1] - 2026-11-12

### Added
- Animations and transitions respect the system's "Reduce motion" setting

### Changed
- README shows the current version, a "What's new" section and the screenshots in a captioned grid. A unit test keeps the version in the About page (`APP_METADATA`) the same as `package.json`.
- Development: ESLint 9 with a flat config (`eslint.config.mjs`, replacing `.eslintrc.cjs`), since ESLint 8 is end-of-life. Same rules and the same files are linted.
- Development: `eslint-plugin-no-unsanitized` now fails the lint on any `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` with a non-literal value. Reviewed sinks carry a `reviewed: <why>` comment.

### Fixed
- Code blocks and inline code show a `[text](javascript:…)` link exactly as typed; it was rewritten to `[text](#)`. Such links in normal text are still dropped by the sanitizer.
- Slides never showed Mermaid diagrams, and wikilinks in the preview pane didn't open the note or show the hover preview. The Markdown sanitizer's allow-list spelled the app's own `data-mermaid-index`, `data-wikilink`, `data-callout`, `data-start-line` and `data-icon` attributes with hyphens, so they were silently removed; they are now kept (and still no other `data-*` attributes).
- Code blocks containing `<` or `&` showed `&#x3C;` and `&#x26;` in the preview and slides instead of the characters. The code is now decoded properly (decimal, hex and the basic named references, in one pass) and escaped again before highlighting, so `<script>` in a code block is still shown as text.
- Code in code blocks and inline code lost text that looked like an event handler or a `javascript:` link: `<img src=x onerror=alert(2)>` was shown as `<img src=x>`, and `` `x onclick="y"` `` as `x`. The extra cleanup pass after the Markdown sanitizer now only edits attributes inside tags; real `on*` attributes and `javascript:` links are still removed (in the preview, slides and the HTML export).
- Pasting HTML and the Web Clipper left hex and decimal character references in the Markdown: `a < b && c` came out as `a &#x3C; b &#x26;&#x26; c`. References are now decoded once, at the end, so `&amp;lt;` stays `&lt;` and text like `&lt;b&gt;` is no longer removed as if it were a tag. Code blocks pasted from Klartext's own preview no longer pick up their line numbers.
- Inline `:icon[…]:` icons lost their rounded line caps and joins, and `aria-hidden` on a `<span>` in a document was removed: the sanitizer's allow-list spelled `aria-hidden`, `stroke-linecap` and `stroke-linejoin` as HTML attribute names, while it compares property names (`ariaHidden`, `strokeLineCap`). The allow-list now uses the right names (checked by a test) and allows nothing new.
- Mermaid node and edge labels on slides were clipped (the last letter of a label was cut off at the right, and two-line labels lost their bottom edge). The slides' larger paragraph text (1.08em, line-height 1.65) also reached the labels inside the diagram, which Mermaid had sized at its own font size. Labels on slides now keep the diagram's size; the normal preview is unchanged.

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
