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
- Markdown is parsed via `unified`/`remark` and sanitized with `rehype-sanitize` plus defense-in-depth stripping of `<script>`, `<iframe>`, `<object>`, `<embed>`, inline `on*` event attributes, and dangerous URL schemes (`javascript:`, `vbscript:`, `file:`, `data:text/html`).
- Mermaid runs in `securityLevel: 'strict'` and all generated or loaded SVGs pass through `sanitizeSvgContent()`.

## 4. Subprocess & AI Loopback Security
- Git operations execute via `simple-git` with argument arrays (`shell: false`) and `-c core.hooksPath=/dev/null` so untrusted repositories cannot execute malicious `.git/hooks`.
- `MultiRootPathGuard.validateLoopbackUrl()` verifies that Local AI requests target `127.0.0.1`, `localhost`, or `[::1]` unless the user explicitly enables non-loopback servers, preventing SSRF.
- AI outputs pass through `sanitizeAndCleanAIOutput()` and require explicit user approval in the inline diff review flow.
- Template commands: power-template variables that run programs (`<% exec: %>`, `<% sh: %>`, `<% bash: %>`, `<% applescript: %>`, …), fetch URLs (`<% url: %>`, `<% json_url: %>`, …) or read environment variables (`<% env:NAME %>`) are **off by default** (Settings → General → Template Commands), because a Markdown file from someone else can contain them. When enabled, the main process still shows a native dialog listing exactly what will run before anything executes; the renderer cannot skip either check. Blocked variables are replaced with a `[blocked: …]` note. The working folder must be inside a mounted root (`resolveTemplateCwd`). Policy: `src/main/security/template-command-policy.ts`, tests: `src/tests/security/template-commands.test.ts`.
