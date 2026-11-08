// @vitest-environment jsdom
/**
 * SEC-DOM-2: every value that reaches an HTML sink in the renderer is either
 * escaped text + constant markup, or passes DOMPurify (src/renderer/security/sanitize-markup.ts).
 * Documents, SVG files and Mermaid sources come from the workspace and may come from others.
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeMermaidSvg,
  sanitizeSvgDocument,
  sanitizePreviewHtml
} from '../../renderer/security/sanitize-markup'
import { renderMarkdownDocument } from '../../shared/markdown/pipeline'
import { highlightCodeToHtml } from '../../shared/markdown/syntax-highlight'
import { renderTableCellInlineHtml } from '../../renderer/features/editor/live-preview-extension'

/** Parse the sanitized markup the way the sink does and look for anything that could run script. */
function findDangerousBits(markup: string): string[] {
  const host = new DOMParser().parseFromString(`<!doctype html><body>${markup}`, 'text/html').body
  const found: string[] = []
  for (const el of Array.from(host.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase()
    if (['script', 'iframe', 'object', 'embed', 'animate', 'set', 'animatemotion', 'animatetransform', 'meta', 'base', 'form'].includes(tag)) {
      found.push(`<${tag}>`)
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = Array.from(attr.value).filter((ch) => ch.charCodeAt(0) > 0x20).join('').toLowerCase()
      if (name.startsWith('on')) found.push(`${tag}[${name}]`)
      if (/^(?:javascript|vbscript|data:text\/html)/.test(value)) found.push(`${tag}[${name}=${value}]`)
      if (name === 'srcdoc') found.push(`${tag}[srcdoc]`)
    }
  }
  return found
}

const SVG_PAYLOADS = [
  '<svg/onload=alert(1)>',
  '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:alert(1)"><text>x</text></a></svg>',
  '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
  '<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>',
  '<svg><set attributeName="onmouseover" to="alert(1)"/></svg>',
  '<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>',
  '<svg><foreignObject><iframe srcdoc="<script>alert(1)</script>"></iframe></foreignObject></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<svg><use href="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"/></svg>',
  '<svg><image href="x" onerror="alert(1)"/></svg>',
  '<svg><style><img src=x onerror=alert(1)></style></svg>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'
]

// A trimmed but structurally faithful Mermaid 11 flowchart (strict mode, HTML labels).
const MERMAID_FLOWCHART = `<svg id="m1" width="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="flowchart" style="max-width: 200px;" viewBox="0 0 200 100" role="graphics-document document" aria-roledescription="flowchart-v2"><style>#m1{font-family:Inter;fill:#333;}#m1 .node rect{fill:#eee;}</style><g><marker id="m1_flowchart-v2-pointEnd" class="marker flowchart-v2" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath"></path></marker><g class="root"><g class="edgePaths"><path d="M1,1L2,2" id="L_A_B_0" class="edge-thickness-normal" marker-end="url(#m1_flowchart-v2-pointEnd)"></path></g><g class="nodes"><g class="node default" id="flowchart-A-0" transform="translate(50, 50)"><rect class="basic label-container" x="-30" y="-20" width="60" height="40"></rect><g class="label" transform="translate(-10, -12)"><foreignObject width="20" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap;"><span class="nodeLabel"><p>Start</p></span></div></foreignObject></g></g><use x="1" y="2" xlink:href="#flowchart-A-0"></use><switch><text>t</text></switch></g></g></g></svg>`

describe('SEC-DOM-2: Mermaid SVG sanitizer (DiagramWidgets, live preview, slides)', () => {
  it.each(SVG_PAYLOADS)('neutralizes %s', (payload) => {
    expect(findDangerousBits(sanitizeMermaidSvg(payload))).toEqual([])
  })

  it('keeps what Mermaid needs: <style>, markers, foreignObject HTML labels, <use href="#…">, <switch>', () => {
    const clean = sanitizeMermaidSvg(MERMAID_FLOWCHART)
    expect(clean).toContain('<style>#m1{font-family:Inter;')
    expect(clean).toContain('marker-end="url(#m1_flowchart-v2-pointEnd)"')
    expect(clean).toContain('<foreignObject width="20" height="24"><div xmlns="http://www.w3.org/1999/xhtml"')
    expect(clean).toContain('<span class="nodeLabel"><p>Start</p></span>')
    expect(clean).toContain('xlink:href="#flowchart-A-0"')
    expect(clean).toContain('<switch>')
    expect(clean).toContain('aria-roledescription="flowchart-v2"')
  })

  it('drops <use> references that point outside the SVG', () => {
    const clean = sanitizeMermaidSvg('<svg><use href="https://evil.example/x.svg#a"/><use xlink:href="#ok"/></svg>')
    expect(clean).not.toContain('evil.example')
    expect(clean).toContain('xlink:href="#ok"')
  })
})

describe('SEC-DOM-2: SVG file preview sanitizer (MarkdownEditorWorkspace)', () => {
  it.each(SVG_PAYLOADS)('neutralizes %s', (payload) => {
    expect(findDangerousBits(sanitizeSvgDocument(payload))).toEqual([])
  })

  it('keeps ordinary drawing content: shapes, gradients, <style>, embedded raster images, internal <use>', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><symbol id="s"><circle r="2"/></symbol></defs><style>.a{fill:url(#g)}</style><rect class="a" width="10" height="10"/><use href="#s"/><image href="data:image/png;base64,iVBORw0KGgo=" width="2" height="2"/><text x="1" y="5">Hi</text></svg>'
    const clean = sanitizeSvgDocument(svg)
    expect(clean).toContain('<linearGradient id="g">')
    expect(clean).toContain('<style>.a{fill:url(#g)}</style>')
    expect(clean).toContain('<use href="#s"></use>')
    expect(clean).toContain('href="data:image/png;base64,iVBORw0KGgo="')
    expect(clean).toContain('<text x="1" y="5">Hi</text>')
  })

  it('strips <foreignObject> from SVG files (same as before: plain SVG previews need no HTML)', () => {
    expect(sanitizeSvgDocument('<svg><foreignObject><div>x</div></foreignObject></svg>')).not.toContain('foreignObject')
  })
})

describe('SEC-DOM-2: rendered Markdown preview / slide sanitizer', () => {
  const HTML_PAYLOADS = [
    ...SVG_PAYLOADS,
    '<img src=x onerror=alert(1)>',
    '<a href="jav&#x09;ascript:alert(1)">a</a>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<form action="https://evil.example"><button>go</button></form>',
    '<details open ontoggle=alert(1)><summary>s</summary></details>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'
  ]

  it.each(HTML_PAYLOADS)('neutralizes %s', (payload) => {
    expect(findDangerousBits(sanitizePreviewHtml(payload))).toEqual([])
  })

  it('keeps preview features: local assets, wikilinks, task lists, details, TOC styles, code highlighting', async () => {
    const md = [
      '[TOC]',
      '# Title',
      '![Pic|width=120](img/a.png)',
      'See [[Other Note|other]] and [site](https://example.com).',
      '- [x] done',
      '<details open><summary>More</summary>Body</details>',
      '==marked== and :icon[home-line]:',
      '```ts',
      'const a = "b"',
      '```'
    ].join('\n\n')
    const raw = (await renderMarkdownDocument(md, { rootId: 'root-1' })).html
    const clean = sanitizePreviewHtml(raw)
    expect(clean).toContain('src="klartext-asset://root-1/img/a.png"')
    expect(clean).toContain('width="120"')
    expect(clean).toContain('href="#wikilink:Other%20Note"')
    expect(clean).toContain('href="https://example.com"')
    expect(clean).toContain('type="checkbox"')
    expect(clean).toContain('<details open="">')
    expect(clean).toContain('<mark class="klartext-highlight">marked</mark>')
    expect(clean).toContain('class="klartext-inline-icon"')
    expect(clean).toContain('style="margin-left:0px"')
    expect(clean).toContain('<span class="hl-keyword">const</span> a = <span class="hl-string">"b"</span>')
  })

  it('keeps KaTeX output intact, including its MathML <semantics>/<annotation>', async () => {
    const raw = (await renderMarkdownDocument('$x^2 + \\frac{a}{b}$', { rootId: 'r' })).html
    expect(raw).toContain('<annotation encoding="application/x-tex">')
    expect(sanitizePreviewHtml(raw)).toBe(raw)
  })

  it('keeps Mermaid SVG embedded in slides', () => {
    const slide = `<h1>Deck</h1><div class="klartext-slide-mermaid" data-testid="slide-mermaid-diagram">${sanitizeMermaidSvg(MERMAID_FLOWCHART)}</div>`
    const clean = sanitizePreviewHtml(slide)
    expect(clean).toContain('<span class="nodeLabel"><p>Start</p></span>')
    expect(clean).toContain('data-testid="slide-mermaid-diagram"')
    expect(clean).toContain('<style>#m1{')
  })

  it('keeps target on links (link clicks are routed through the window-open handler)', () => {
    expect(sanitizePreviewHtml('<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>')).toContain('target="_blank"')
  })
})

describe('SEC-DOM-2: string builders whose output is escaped text plus constant markup', () => {
  it('highlightCodeToHtml escapes every character of the code', () => {
    const html = highlightCodeToHtml('<img src=x onerror=alert(1)> "</span><script>x</script>"', 'js')
    expect(findDangerousBits(html)).toEqual([])
    expect(html).not.toMatch(/<(?!\/?span\b)[a-z]/i)
  })

  it('renderTableCellInlineHtml (live preview tables) escapes cell text and adds only fixed tags', () => {
    const cell = '<img src=x onerror=alert(1)> **b** `<svg/onload=alert(1)>` [[<x>|<y>]] [a](javascript:alert(1)) "q"'
    const html = renderTableCellInlineHtml(cell)
    expect(findDangerousBits(html)).toEqual([])
    expect(html).not.toMatch(/<(?!\/?(?:span|strong|em|code|del|mark)\b)[a-z]/i)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
