// @vitest-environment jsdom
/**
 * Regressions in the Markdown pipeline found in the SEC-DOM-2 review:
 * - rehype-sanitize matches hast property names (camelCase), so `data-*` entries written with hyphens
 *   in the schema were dropped (slides lost their Mermaid diagrams, wikilinks lost click/hover).
 * - the code-block decoder didn't understand the hex references rehype-stringify writes (`&#x3C;`).
 */
import { describe, it, expect } from 'vitest'
import { html as htmlSchema, svg as svgSchema } from 'property-information'
import {
  renderMarkdownDocument,
  decodeCharacterReferences,
  convertHtmlToMarkdown,
  markdownSanitizeSchema
} from '../../shared/markdown/pipeline'
import { htmlToCleanMarkdown } from '../../shared/markdown/export-formats'
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

describe('the on* cleanup pass only touches attributes, never text', () => {
  async function codeText(md: string): Promise<string> {
    const res = await renderMarkdownDocument(md)
    const code = parse(sanitizePreviewHtml(res.html)).querySelector('pre code')
    const lines = code?.querySelectorAll('.klartext-code-line-text')
    return lines && lines.length > 0
      ? Array.from(lines).map((l) => l.textContent).join('\n')
      : code?.textContent ?? ''
  }

  it('shows `<img src=x onerror=alert(2)>` in a code block exactly as typed', async () => {
    expect(await codeText('```html\n<img src=x onerror=alert(2)>\n```\n')).toBe('<img src=x onerror=alert(2)>')
  })

  it('keeps on*= and javascript: text in inline code and paragraphs', async () => {
    const res = await renderMarkdownDocument('`x onclick="y"` and `href="javascript:void(0)"`\n\nsay onload=hi')
    const body = parse(sanitizePreviewHtml(res.html))
    const codes = Array.from(body.querySelectorAll('code')).map((c) => c.textContent)
    expect(codes).toEqual(['x onclick="y"', 'href="javascript:void(0)"'])
    expect(body.querySelectorAll('p')[1]?.textContent).toBe('say onload=hi')
  })

  it('never lets a real onerror/onclick attribute through (pipeline HTML, as exported, and the DOM)', async () => {
    const md = '<img src="x" onerror="alert(1)">\n\n<a href="https://e.com" onclick="alert(2)" ONMOUSEOVER=\'alert(3)\'>a</a>\n\n<svg onload="alert(4)"><path d="M0" onclick="x"/></svg>'
    const res = await renderMarkdownDocument(md)
    // the main process HTML export uses this string without DOMPurify
    expect(res.html).not.toMatch(/\son[a-z]+\s*=/i)
    const body = parse(sanitizePreviewHtml(res.html))
    for (const el of Array.from(body.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) expect(attr.name).not.toMatch(/^on/i)
    }
    expect(body.querySelector('img')).not.toBeNull()
  })

  it('never lets a javascript: href through', async () => {
    const res = await renderMarkdownDocument('<a href="javascript:alert(1)">x</a> <a href=" JavaScript:alert(1)">y</a>')
    expect(res.html).not.toMatch(/javascript:/i)
  })
})

describe('HTML to Markdown decodes every kind of character reference', () => {
  it('convertHtmlToMarkdown: hex and decimal references in text, tables and code', () => {
    expect(convertHtmlToMarkdown('<p>a &#x3C; b &#x26;&#x26; c</p>')).toBe('a < b && c')
    expect(convertHtmlToMarkdown('<p>a &#60; b &#38;&#38; c</p>')).toBe('a < b && c')
    expect(convertHtmlToMarkdown('<pre><code>a &#x3C; b &#x26;&#x26; c</code></pre>')).toBe('```\na < b && c\n```')
    const table = convertHtmlToMarkdown('<table><tr><th>x</th></tr><tr><td>a &#x3C; b &#x26;&#x26; c</td></tr></table>')
    expect(table).toContain('| a < b && c |')
  })

  it('convertHtmlToMarkdown: decodes once, so an escaped reference stays a reference', () => {
    expect(convertHtmlToMarkdown('<p>&amp;lt; &#x26;#x3C;</p>')).toBe('&lt; &#x3C;')
    expect(convertHtmlToMarkdown('<pre><code>&amp;lt;div&amp;gt;</code></pre>')).toBe('```\n&lt;div&gt;\n```')
  })

  it('round-trips `a < b && c` through the Klartext preview HTML (paragraph and code block)', async () => {
    const res = await renderMarkdownDocument('a < b && c\n\n```\na < b && c\n```\n')
    const md = convertHtmlToMarkdown(res.html)
    expect(md.split('\n')[0]).toBe('a < b && c')
    expect(md).toMatch(/```[a-z]*\na < b && c\n```/)
  })

  it('htmlToCleanMarkdown (Web Clipper): hex and decimal references', () => {
    const page = (inner: string) =>
      `<html><head><title>T &#x26; U</title></head><body><article>${inner}</article></body></html>`
    const clipped = htmlToCleanMarkdown(
      page('<h2>a &#x3C; b &#x26;&#x26; c</h2><p>a &#x3C; b &#x26;&#x26; c</p><ul><li>a &#60; b &#38;&#38; c</li></ul><pre><code>a &#x3C; b &#x26;&#x26; c</code></pre>')
    )
    expect(clipped.title).toBe('T & U')
    expect(clipped.bodyMarkdown).toContain('## a < b && c')
    expect(clipped.bodyMarkdown).toContain('\n\na < b && c\n\n')
    expect(clipped.bodyMarkdown).toContain('- a < b && c')
    expect(clipped.bodyMarkdown).toContain('```\na < b && c\n```')
  })

  it('htmlToCleanMarkdown: decodes once, and `&lt;b&gt;` text is not mistaken for a tag', () => {
    const clipped = htmlToCleanMarkdown('<article><p>&amp;lt; x</p><li>a &lt;b&gt; c</li></article>')
    expect(clipped.bodyMarkdown).toContain('&lt; x')
    expect(clipped.bodyMarkdown).toContain('- a <b> c')
  })
})

describe('rehype-sanitize schema uses hast property names', () => {
  it('lists only names hast can produce (no hyphenated aria-*/stroke-*, no `class`)', () => {
    const known = (name: string): boolean =>
      /^data[A-Z]/.test(name) ||
      Object.prototype.hasOwnProperty.call(htmlSchema.property, name) ||
      Object.prototype.hasOwnProperty.call(svgSchema.property, name)
    for (const [tag, list] of Object.entries(markdownSanitizeSchema.attributes)) {
      const names = (list as Array<string | [string, ...unknown[]]>).map((e) => (Array.isArray(e) ? e[0] : e))
      expect(names.filter((n) => !known(n)), tag).toEqual([])
      expect(new Set(names).size, `${tag} has duplicates`).toBe(names.length)
    }
  })

  it("keeps span's aria-hidden and the icon SVG's stroke attributes", async () => {
    const res = await renderMarkdownDocument(
      '<span aria-hidden="true" aria-label="L" title="T">x</span>\n\n<svg viewBox="0 0 24 24" stroke-width="2" aria-hidden="true"><path d="M0 0" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    )
    const body = parse(sanitizePreviewHtml(res.html))
    const span = body.querySelector('span')
    expect(span?.getAttribute('aria-hidden')).toBe('true')
    expect(span?.getAttribute('aria-label')).toBe('L')
    const svg = body.querySelector('svg')
    expect(svg?.getAttribute('stroke-width')).toBe('2')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(body.querySelector('path')?.getAttribute('stroke-linecap')).toBe('round')
    expect(body.querySelector('path')?.getAttribute('stroke-linejoin')).toBe('round')
  })

  it('still drops attributes the schema does not list', async () => {
    const res = await renderMarkdownDocument(
      '<span aria-hidden="true" aria-describedby="d" tabindex="1" hidden data-x="1" lang="en">x</span>\n\n<svg viewBox="0 0 1 1" onload="x" style="color:red" data-untitled-icon="a"><path d="M0" transform="scale(2)"/></svg>'
    )
    const body = parse(res.html)
    const span = body.querySelector('span')
    expect(span?.getAttributeNames()).toEqual(['aria-hidden'])
    expect(body.querySelector('svg')?.getAttributeNames()).toEqual(['viewBox'])
    expect(body.querySelector('path')?.getAttributeNames()).toEqual(['d'])
  })
})
