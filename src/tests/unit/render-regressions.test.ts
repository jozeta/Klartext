// @vitest-environment jsdom
/**
 * Regressions in the Markdown pipeline found in the SEC-DOM-2 review:
 * - rehype-sanitize matches hast property names (camelCase), so `data-*` entries written with hyphens
 *   in the schema were dropped (slides lost their Mermaid diagrams, wikilinks lost click/hover).
 * - the code-block decoder didn't understand the hex references rehype-stringify writes (`&#x3C;`).
 */
import { describe, it, expect } from 'vitest'
import { renderMarkdownDocument, decodeCharacterReferences } from '../../shared/markdown/pipeline'
import { sanitizePreviewHtml } from '../../renderer/security/sanitize-markup'
import { spliceSlideMermaid } from '../../renderer/features/presentation/slide-mermaid'

function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html').body
}

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" id="fake-diagram"><g><text>A to B</text></g></svg>'

describe('data-* attributes the app relies on survive the pipeline', () => {
  it('keeps data-mermaid-index on the Mermaid placeholder', async () => {
    const res = await renderMarkdownDocument('# Slide\n\n```mermaid\ngraph TD\n  A-->B\n```\n')
    expect(res.mermaidBlocks).toHaveLength(1)
    const placeholder = parse(res.html).querySelector('.klartext-mermaid-placeholder')
    expect(placeholder?.getAttribute('data-mermaid-index')).toBe('0')
    expect(placeholder?.getAttribute('data-start-line')).toBe('3')
  })

  it('splices the Mermaid SVG into a slide, and it survives the final sanitize', async () => {
    const res = await renderMarkdownDocument('# Slide\n\n```mermaid\ngraph TD\n  A-->B\n```\n')
    const spliced = await spliceSlideMermaid(res.html, res.mermaidBlocks, async () => FAKE_SVG)
    const body = parse(sanitizePreviewHtml(spliced))
    expect(body.querySelector('.klartext-mermaid-placeholder')).toBeNull()
    const diagram = body.querySelector('[data-testid="slide-mermaid-diagram"]')
    expect(diagram).not.toBeNull()
    expect(diagram?.querySelector('svg#fake-diagram text')?.textContent).toBe('A to B')
  })

  it('splices each diagram by its own index and leaves a failed one as a placeholder', async () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```\n\ntext\n\n```mermaid\nnot valid\n```\n'
    const res = await renderMarkdownDocument(md)
    const spliced = await spliceSlideMermaid(res.html, res.mermaidBlocks, async (code) => {
      if (code.startsWith('not valid')) throw new Error('parse error')
      return '<svg><text>$& $1</text></svg>'
    })
    const body = parse(spliced)
    expect(body.querySelectorAll('[data-testid="slide-mermaid-diagram"]')).toHaveLength(1)
    // `$&` in the SVG is kept as text, not treated as a replacement pattern
    expect(body.querySelector('[data-testid="slide-mermaid-diagram"] text')?.textContent).toBe('$& $1')
    expect(body.querySelector('.klartext-mermaid-placeholder')?.getAttribute('data-mermaid-index')).toBe('1')
  })

  it('keeps data-wikilink on wikilinks (preview click and hover preview read it)', async () => {
    const res = await renderMarkdownDocument('See [[Other Note|the other one]] and [[work:Plan]].')
    const links = parse(sanitizePreviewHtml(res.html)).querySelectorAll('a.klartext-wikilink')
    expect(links).toHaveLength(2)
    expect(decodeURIComponent(links[0].getAttribute('data-wikilink') || '')).toBe('Other Note')
    expect(decodeURIComponent(links[1].getAttribute('data-wikilink') || '')).toBe('work:Plan')
  })

  it('keeps data-callout on callouts', async () => {
    const res = await renderMarkdownDocument('> [!WARNING] Careful\n> Body text')
    expect(parse(res.html).querySelector('.klartext-callout')?.getAttribute('data-callout')).toBe('WARNING')
  })

  it('still drops data-* attributes the schema does not list', async () => {
    const res = await renderMarkdownDocument(
      '<div data-evil="1" data-mermaid-index="7">x</div>\n\n<a href="https://example.com" data-foo="1">y</a>'
    )
    const body = parse(res.html)
    expect(body.querySelector('[data-evil]')).toBeNull()
    expect(body.querySelector('[data-foo]')).toBeNull()
  })
})

describe('fenced code blocks show their text, not character references', () => {
  async function codeText(md: string): Promise<{ text: string; body: HTMLElement }> {
    const res = await renderMarkdownDocument(md)
    const body = parse(sanitizePreviewHtml(res.html))
    const code = body.querySelector('pre code')
    // the highlighter adds line-number gutters; read only the code lines
    const lines = code?.querySelectorAll('.klartext-code-line-text')
    const text = lines && lines.length > 0
      ? Array.from(lines).map((l) => l.textContent).join('\n')
      : code?.textContent ?? ''
    return { text, body }
  }

  it('renders `a < b && c > d` as that text', async () => {
    const { text } = await codeText('```js\na < b && c > d\n```\n')
    expect(text).toContain('a < b && c > d')
    expect(text).not.toMatch(/&#x|&#\d|&lt;|&amp;/)
  })

  it('keeps quotes and apostrophes readable', async () => {
    const { text } = await codeText('```\nsay "hi" it\'s\n```\n')
    expect(text).toContain('say "hi" it\'s')
  })

  it('shows a literal character reference typed in code as typed', async () => {
    const { text } = await codeText('```\n&#x3C; &lt; &amp; &#60;\n```\n')
    expect(text).toContain('&#x3C; &lt; &amp; &#60;')
  })

  it('keeps <script> inside a code block as text', async () => {
    const { text, body } = await codeText('```html\n<script>alert(1)</script><img src=x alt="a">\n```\n')
    expect(text).toContain('<script>alert(1)</script><img src=x alt="a">')
    expect(body.querySelector('script')).toBeNull()
    expect(body.querySelector('img')).toBeNull()
  })

  it('escapes decoded code again in the raw pipeline HTML (before DOMPurify)', async () => {
    const res = await renderMarkdownDocument('```\n</code></pre><script>alert(1)</script>\n```\n')
    expect(res.html).not.toMatch(/<script/i)
    expect(res.html).not.toMatch(/<\/code><\/pre><script/i)
  })
})

describe('decodeCharacterReferences', () => {
  it('decodes decimal, hex and basic named references in one pass', () => {
    expect(decodeCharacterReferences('&#60;&#x3C;&#X3c;&lt;&gt;&amp;&quot;&apos;&#39;&#x27;')).toBe('<<<<>&"\'\'\'')
    expect(decodeCharacterReferences('&#x26;lt; &amp;#x3C;')).toBe('&lt; &#x3C;')
    expect(decodeCharacterReferences('&#x1F600;')).toBe('\u{1F600}')
  })

  it('leaves unknown names and bare ampersands alone, and replaces invalid code points', () => {
    expect(decodeCharacterReferences('&copy; & &; &#; &#xZZ;')).toBe('&copy; & &; &#; &#xZZ;')
    expect(decodeCharacterReferences('&#0;&#xD800;&#x110000;')).toBe('\ufffd\ufffd\ufffd')
  })
})
