# Klartext Security Model & Threat Mitigation

## 1. Electron Hardening
- All `BrowserWindow` instances run with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`.
- Content Security Policy (CSP) in `src/renderer/index.html`:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: klartext-asset:; font-src 'self' data:; connect-src 'self'`.
- Arbitrary navigation (`will-navigate`) and `setWindowOpenHandler` are intercepted; only verified `https:` and `mailto:` URLs are opened in the system browser via `shell.openExternal`.

## 2. Multi-Root Path Confinement (`path-guard.ts`)
- Every root directory mounted by the user is canonicalized via `fs.realpathSync`.
- Sensitive system paths (`/etc`, `/System`, `C:\Windows`, `~/.ssh`, `~/.gnupg`, `~/.aws`) are explicitly blocked from being mounted—even via symlinks or `.klartext-workspace` manifests.
- Every file read, write, delete, rename, or `klartext-asset://` request must pass `MultiRootPathGuard.resolveScopedPath(rootId, relativePath)`, which blocks `..` traversal, NUL bytes, cross-root escape, and symlink escape outside the owning root's `realPath`.

## 3. Markdown, HTML, and SVG Sanitization
Documents, SVG files and Mermaid sources come from the workspace, which can contain files from others
(cloned repos, downloads), so their content is untrusted.

- Markdown is parsed via `unified`/`remark` and sanitized with `rehype-sanitize` (an allow-list on the
  syntax tree) plus defense-in-depth stripping of `<script>`, `<iframe>`, `<object>`, `<embed>`, inline
  `on*` event attributes, and dangerous URL schemes (`javascript:`, `vbscript:`, `file:`, `data:text/html`).
  The allow-list names hast properties (`className`, `ariaHidden`, `strokeLineCap`, `dataWikilink`), not
  HTML attribute names; a hyphenated entry never matches (test: `src/tests/unit/render-regressions.test.ts`).
  The defense-in-depth pass (`stripUnsafeAttributes()` in `src/shared/markdown/pipeline.ts`) only edits
  attributes inside start tags, never text, so code that shows `onerror=` is displayed as written. It
  matters for the HTML export, which the main process writes from the pipeline output without DOMPurify.
- Mermaid runs in `securityLevel: 'strict'`.
- **Every HTML sink in the renderer is sanitized last, right before insertion, with DOMPurify**
  (`src/renderer/security/sanitize-markup.ts`; bundled from npm, no network loads). A regex block-list is
  never the last line of defense. Profiles:
  - `sanitizeMermaidSvg`: Mermaid output (SVG + HTML labels in `<foreignObject>`, Mermaid's `<style>`).
    The Mermaid cache only stores this output.
  - `sanitizeSvgDocument`: SVG files in the visual asset viewer (SVG only, no `<foreignObject>`, no SMIL
    animation).
  - `sanitizePreviewHtml`: the Markdown preview, slides (including their Mermaid SVG) and inline KaTeX
    widgets (HTML + SVG + MathML, `klartext-asset:` URLs). Forms are removed.
  - In all profiles `<use>` may only reference `#ids` inside the same SVG.
- `sanitizeSvgContent()` (regex, in `src/shared`) is only used by the main process for SVG it writes or
  serves through `klartext-asset://`, which the renderer loads as `<img>` (no scripting); it must not be
  used for markup that is inserted into the DOM.
- Sinks whose value is escaped text plus fixed markup (code highlighting, live-preview tables, bundled
  icons) are marked `reviewed: <why>` in the code. ESLint's `no-unsanitized` rule fails on any new
  unreviewed `innerHTML`/`outerHTML`/`insertAdjacentHTML`; `dangerouslySetInnerHTML` sinks carry a plain
  `// reviewed: <why>` comment. Tests: `src/tests/security/dom-sinks.test.ts`.
- If a renderer XSS ever got through, the injected script would have the whole `window.klartext` bridge:
  read, write and delete documents in every mounted root, commit and push with Git, change settings, and
  send data out via the Web Clipper/URL metadata fetch or `openExternalUrl`. It would not get Node, `fs`
  or a shell (`contextIsolation`, `sandbox`, no `nodeIntegration`; template commands still need the
  native confirmation dialog). The CSP (`script-src 'self'`, no `'unsafe-inline'`) blocks inline event
  handlers and `javascript:` URLs as a second layer.

## 4. Subprocess & AI Loopback Security
- Git operations execute via `simple-git` with argument arrays (`shell: false`) and `-c core.hooksPath=/dev/null` so untrusted repositories cannot execute malicious `.git/hooks`.
- `MultiRootPathGuard.validateLoopbackUrl()` verifies that Local AI requests target `127.0.0.1`, `localhost`, or `[::1]` unless the user explicitly enables non-loopback servers, preventing SSRF.
- AI outputs pass through `sanitizeAndCleanAIOutput()` and require explicit user approval in the inline diff review flow.
- Template commands: power-template variables that run programs (`<% exec: %>`, `<% sh: %>`, `<% bash: %>`, `<% applescript: %>`, …), fetch URLs (`<% url: %>`, `<% json_url: %>`, …) or read environment variables (`<% env:NAME %>`) are **off by default** (Settings → General → Template Commands), because a Markdown file from someone else can contain them. When enabled, the main process still shows a native dialog listing exactly what will run before anything executes; the renderer cannot skip either check. Blocked variables are replaced with a `[blocked: …]` note. The working folder must be inside a mounted root (`resolveTemplateCwd`). Policy: `src/main/security/template-command-policy.ts`, tests: `src/tests/security/template-commands.test.ts`.
