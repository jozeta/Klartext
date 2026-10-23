import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import yaml from 'yaml'
import { highlightCodeToHtml } from './syntax-highlight'
import { renderUntitledIconToSvgHtml } from '../icons/untitled-icon-svg'

export interface HeadingItem {
  depth: number
  text: string
  line: number
  id: string
}

export interface WikiLinkOccurrence {
  target: string
  alias?: string
  line: number
  isCrossRootExplicit: boolean
  explicitRootName?: string
}

export interface LocalAssetReference {
  rawUrl: string
  normalizedPath: string
  isExcalidrawSvg: boolean
}

export interface RenderedMarkdownResult {
  html: string
  frontmatter: Record<string, unknown> | null
  frontmatterRaw: string | null
  headings: HeadingItem[]
  wikiLinks: WikiLinkOccurrence[]
  assetReferences: LocalAssetReference[]
  mermaidBlocks: Array<{ index: number; code: string; startLine: number }>
  wordCount: number
  charCount: number
  readingTimeMinutes: number
}

const DANGEROUS_SCHEMES = /^\s*(?:javascript:|vbscript:|file:|data:(?!image\/(?:png|jpeg|gif|webp|svg\+xml);base64,))/i

export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return true
  if (DANGEROUS_SCHEMES.test(trimmed)) return false
  return true
}

export function extractFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown> | null
  frontmatterRaw: string | null
  body: string
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/)
  if (!match) {
    return { frontmatter: null, frontmatterRaw: null, body: markdown }
  }
  const raw = match[1]
  const body = markdown.slice(match[0].length)
  try {
    const parsed = yaml.parse(raw)
    return {
      frontmatter: typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {},
      frontmatterRaw: raw,
      body
    }
  } catch {
    return { frontmatter: null, frontmatterRaw: raw, body }
  }
}

export function updateFrontmatterInMarkdown(
  markdown: string,
  updatedFields: Record<string, unknown>
): string {
  const { body } = extractFrontmatter(markdown)
  const serializedYaml = yaml.stringify(updatedFields).trimEnd()
  return `---\n${serializedYaml}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split(/\r?\n/)
  const headings: HeadingItem[] = []
  let inCodeFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (m) {
      const depth = m[1].length
      const text = m[2].replace(/[#*`~[\]]/g, '').trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
      headings.push({
        depth,
        text,
        line: i + 1,
        id: `${id}-${i + 1}`
      })
    }
  }
  return headings
}

export function extractWikiLinks(markdown: string): WikiLinkOccurrence[] {
  const lines = markdown.split(/\r?\n/)
  const results: WikiLinkOccurrence[] = []
  let inCodeFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    const regex = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(line)) !== null) {
      const rawTarget = match[1].trim()
      const alias = match[2]?.trim()
      const colonIdx = rawTarget.indexOf(':')
      const isCrossRootExplicit = colonIdx > 0
      results.push({
        target: isCrossRootExplicit ? rawTarget.slice(colonIdx + 1).trim() : rawTarget,
        alias,
        line: i + 1,
        isCrossRootExplicit,
        explicitRootName: isCrossRootExplicit ? rawTarget.slice(0, colonIdx).trim() : undefined
      })
    }
  }
  return results
}

export function extractLocalAssetReferences(markdown: string): LocalAssetReference[] {
  const results: LocalAssetReference[] = []
  const seen = new Set<string>()
  const mdImageOrLink = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let m: RegExpExecArray | null
  while ((m = mdImageOrLink.exec(markdown)) !== null) {
    const rawUrl = m[1].trim()
    if (
      !rawUrl ||
      rawUrl.startsWith('http://') ||
      rawUrl.startsWith('https://') ||
      rawUrl.startsWith('mailto:') ||
      rawUrl.startsWith('#') ||
      rawUrl.startsWith('data:') ||
      rawUrl.startsWith('klartext-asset://')
    ) {
      continue
    }
    const decoded = decodeURIComponent(rawUrl).replace(/^\.\//, '')
    if (!seen.has(decoded)) {
      seen.add(decoded)
      results.push({
        rawUrl,
        normalizedPath: decoded,
        isExcalidrawSvg: decoded.endsWith('.excalidraw.svg') || decoded.endsWith('.excalidraw')
      })
    }
  }
  return results
}

export function rewriteAssetLinksInMarkdown(
  markdown: string,
  replacements: Record<string, string>
): string {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (full, prefix, url, suffix) => {
    const clean = decodeURIComponent(url.trim()).replace(/^\.\//, '')
    if (replacements[url]) {
      return `${prefix}${replacements[url]}${suffix}`
    }
    if (replacements[clean]) {
      return `${prefix}${replacements[clean]}${suffix}`
    }
    return full
  })
}

function transformInlineExtendedSyntax(line: string): string {
  // Split by inline code spans (`...`) so we never mutate inside inline code
  const segments = line.split(/(`+[^`]*`+)/g)
  return segments
    .map((seg, idx) => {
      if (idx % 2 === 1) return seg
      // ==highlight==
      let out = seg.replace(/==([^=\n]+)==/g, '<mark class="klartext-highlight">$1</mark>')
      // >!spoiler!< (Reddit / GitLab style inline spoiler)
      out = out.replace(
        />!([^!\n]+)!<\s*/g,
        '<span class="klartext-spoiler" title="Hover or click to reveal">$1</span>'
      )
      // :icon[IconName]: (Untitled UI inline icon)
      out = out.replace(/:icon\[([a-zA-Z0-9_-]+)\]:/g, (full, iconName: string) => {
        const svg = renderUntitledIconToSvgHtml(iconName, 16)
        if (!svg) return full
        return `<span class="klartext-inline-icon-wrap" data-icon="${iconName}">${svg}</span>`
      })
      return out
    })
    .join('')
}

export interface ImageAltMetadata {
  caption: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

export function parseImageAltMetadata(rawAlt: string): ImageAltMetadata {
  const parts = rawAlt.split('|').map((s) => s.trim())
  const captionParts: string[] = []
  let width: number | undefined
  let align: 'left' | 'center' | 'right' | undefined

  for (const part of parts) {
    const wMatch =
      part.match(/^(?:width|w)\s*=\s*(\d+)(?:px)?$/i) ||
      part.match(/^(\d{2,4})(?:x\d{2,4})?(?:px)?$/i)
    if (wMatch) {
      const n = Number(wMatch[1])
      if (n >= 40 && n <= 2400) {
        width = n
        continue
      }
    }
    const aMatch = part.match(/^(?:align|a)\s*=\s*(left|center|right)$/i) || part.match(/^(left|center|right)$/i)
    if (aMatch) {
      align = aMatch[1].toLowerCase() as 'left' | 'center' | 'right'
      continue
    }
    captionParts.push(part)
  }

  return {
    caption: captionParts.join(' | ').trim(),
    width,
    align
  }
}

export function formatImageAltMetadata(meta: ImageAltMetadata): string {
  const parts: string[] = []
  if (meta.caption.trim()) {
    parts.push(meta.caption.trim())
  }
  if (meta.width && meta.width >= 40) {
    parts.push(`width=${Math.round(meta.width)}`)
  }
  if (meta.align && meta.align !== 'left') {
    parts.push(`align=${meta.align}`)
  }
  return parts.join('|')
}

function preprocessExtensions(
  markdown: string,
  rootId: string,
  headingsForToc: HeadingItem[] = []
): {
  processed: string
  mermaidBlocks: Array<{ index: number; code: string; startLine: number }>
} {
  const mermaidBlocks: Array<{ index: number; code: string; startLine: number }> = []
  const lines = markdown.split(/\r?\n/)
  const outLines: string[] = []

  let i = 0
  let activeFenceTicks = 0
  while (i < lines.length) {
    const line = lines[i]

    // Detect Mermaid code fence (only when not inside an outer 4+ backtick fence)
    if (activeFenceTicks === 0 && /^\s*```mermaid\s*$/i.test(line)) {
      const startLine = i + 1
      i++
      const codeLines: string[] = []
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      const idx = mermaidBlocks.length
      const code = codeLines.join('\n')
      mermaidBlocks.push({ index: idx, code, startLine })
      outLines.push(
        `<div class="klartext-mermaid-placeholder" data-mermaid-index="${idx}" data-start-line="${startLine}"></div>`
      )
      continue
    }

    // Detect Notion-style Bookmark Card block: :::bookmark [url] ... :::
    const bookmarkHeaderMatch =
      activeFenceTicks === 0
        ? line.match(/^\s*:::bookmark(?:\s+(https?:\/\/\S+))?\s*$/i)
        : null
    if (bookmarkHeaderMatch) {
      i++
      const props: Record<string, string> = {}
      if (bookmarkHeaderMatch[1]) {
        props.url = bookmarkHeaderMatch[1].trim()
      }
      while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
        const kv = lines[i].match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
        if (kv) {
          props[kv[1].trim().toLowerCase()] = kv[2].trim()
        }
        i++
      }
      i++ // skip closing :::
      const rawUrl = props.url && isSafeUrl(props.url) ? props.url : '#'
      let domain = props.domain || ''
      if (!domain && rawUrl.startsWith('http')) {
        try {
          domain = new URL(rawUrl).hostname.replace(/^www\./, '')
        } catch {
          domain = ''
        }
      }
      const title = (props.title || domain || rawUrl).replace(/[<>&"]/g, '')
      const desc = (props.description || '').replace(/[<>&"]/g, '')
      const safeDomain = domain.replace(/[<>&"]/g, '')
      outLines.push(
        `<div class="klartext-bookmark-card"><div class="klartext-bookmark-title"><a href="${rawUrl}" target="_blank" rel="noopener noreferrer">${title}</a></div>${desc ? `<div class="klartext-bookmark-desc">${desc}</div>` : ''}<div class="klartext-bookmark-domain">${safeDomain || rawUrl}</div></div>`
      )
      continue
    }

    // Track non-mermaid fenced code blocks (supporting 3, 4, or more backticks) so we don't transform syntax inside code blocks
    const fenceLineMatch = line.match(/^\s*(`{3,})([\w-]*)\s*$/)
    if (fenceLineMatch) {
      const ticks = fenceLineMatch[1].length
      if (activeFenceTicks === 0) {
        activeFenceTicks = ticks
      } else if (ticks >= activeFenceTicks && !fenceLineMatch[2]) {
        activeFenceTicks = 0
      }
      outLines.push(line)
      i++
      continue
    }

    if (activeFenceTicks > 0) {
      outLines.push(line)
      i++
      continue
    }

    // Detect [[_TOC_]] or [TOC] on its own line (GitLab / Extended Markdown Table of Contents)
    if (/^\s*(?:\[\[_TOC_\]\]|\[TOC\])\s*$/i.test(line)) {
      if (headingsForToc.length > 0) {
        const items = headingsForToc
          .map((h) => {
            const indent = Math.max(0, (h.depth - 1) * 14)
            return `<li style="margin-left:${indent}px"><a href="#${h.id}">${h.text}</a></li>`
          })
          .join('')
        outLines.push(
          `<nav class="klartext-toc"><div class="klartext-toc-title">Table of Contents</div><ul>${items}</ul></nav>`
        )
      } else {
        outLines.push(
          `<nav class="klartext-toc"><div class="klartext-toc-title">Table of Contents</div></nav>`
        )
      }
      i++
      continue
    }

    // Detect Callout blocks: > [!NOTE] Title or > [!faq]- Title
    const calloutMatch = line.match(/^>\s*\[!([a-zA-Z0-9_-]+)\]([+-])?\s*(.*)$/i)
    if (calloutMatch) {
      const kind = calloutMatch[1].toUpperCase()
      const title = calloutMatch[3].trim() || kind
      const bodyLines: string[] = []
      i++
      while (i < lines.length && /^>\s?(.*)$/.test(lines[i])) {
        bodyLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      outLines.push(
        `<div class="klartext-callout klartext-callout-${kind.toLowerCase()}" data-callout="${kind}"><div class="klartext-callout-title">${title}</div><div class="klartext-callout-body">\n\n${bodyLines.join('\n')}\n\n</div></div>`
      )
      continue
    }

    // Detect Definition List: Term line followed by one or more `: Definition` lines
    if (
      line.trim().length > 0 &&
      !line.startsWith('#') &&
      !line.startsWith('>') &&
      !line.startsWith('-') &&
      !line.startsWith('*') &&
      !line.startsWith('|') &&
      i + 1 < lines.length &&
      /^:\s+(.+)$/.test(lines[i + 1])
    ) {
      const term = transformInlineExtendedSyntax(line.trim())
      i++
      const defs: string[] = []
      while (i < lines.length && /^:\s+(.+)$/.test(lines[i])) {
        defs.push(transformInlineExtendedSyntax(lines[i].replace(/^:\s+/, '').trim()))
        i++
      }
      outLines.push(
        `<dl class="klartext-deflist"><dt>${term}</dt>${defs.map((d) => `<dd>${d}</dd>`).join('')}</dl>`
      )
      continue
    }

    // Transform [[WikiLink|Alias]] inline outside code spans
    const wikiReplaced = line
      .split(/(`+[^`]*`+)/g)
      .map((seg, segIdx) => {
        if (segIdx % 2 === 1) return seg
        return seg.replace(/(?<!!)\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_m, target, alias) => {
          const cleanTarget = String(target).trim()
          const label = alias ? String(alias).trim() : cleanTarget
          const isCrossRoot = cleanTarget.includes(':')
          return `<a href="#wikilink:${encodeURIComponent(cleanTarget)}" class="klartext-wikilink ${isCrossRoot ? 'klartext-wikilink-crossroot' : ''}" data-wikilink="${encodeURIComponent(cleanTarget)}">${label}</a>`
        })
      })
      .join('')

    // Rewrite relative image paths to klartext-asset://<rootId>/<path>
    const assetReplaced = wikiReplaced.replace(
      /!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
      (full, alt, rawSrc, titlePart) => {
        if (!isSafeUrl(rawSrc)) {
          return `![${alt}]()`
        }
        if (
          rawSrc.startsWith('http://') ||
          rawSrc.startsWith('https://') ||
          rawSrc.startsWith('data:image/') ||
          rawSrc.startsWith('klartext-asset://')
        ) {
          return full
        }
        const cleanRel = rawSrc.replace(/^\.\//, '')
        if (cleanRel.includes('..')) {
          return `![${alt}]()`
        }
        return `![${alt}](klartext-asset://${encodeURIComponent(rootId)}/${cleanRel}${titlePart})`
      }
    )

    outLines.push(transformInlineExtendedSyntax(assetReplaced))
    i++
  }

  return {
    processed: outLines.join('\n'),
    mermaidBlocks
  }
}

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'klartext-asset', 'data'],
    href: ['http', 'https', 'mailto', 'klartext-asset']
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'div',
    'span',
    'nav',
    'mark',
    'kbd',
    'u',
    'sup',
    'sub',
    'details',
    'summary',
    'dl',
    'dt',
    'dd',
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'mfrac',
    'msqrt',
    'mtext',
    'annotation',
    'input',
    'svg',
    'path'
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': ['className', 'class', 'id', 'ariaLabel', 'aria-label', 'title'],
    div: [
      'className',
      'class',
      'data-mermaid-index',
      'data-start-line',
      'data-callout'
    ],
    details: ['open', 'className', 'class'],
    li: ['style', 'className', 'class'],
    a: ['href', 'className', 'class', 'data-wikilink', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'className', 'class'],
    input: [['type', 'checkbox'], 'checked', 'disabled', 'className'],
    code: ['className', 'class'],
    span: ['className', 'class', 'style', 'aria-hidden', 'title', 'data-icon'],
    svg: [
      'viewBox',
      'width',
      'height',
      'stroke',
      'strokeWidth',
      'stroke-width',
      'fill',
      'strokeLinecap',
      'stroke-linecap',
      'strokeLinejoin',
      'stroke-linejoin',
      'ariaHidden',
      'aria-hidden',
      'className',
      'class'
    ],
    path: ['d', 'stroke', 'strokeWidth', 'stroke-width', 'fill', 'strokeLinecap', 'stroke-linecap', 'strokeLinejoin', 'stroke-linejoin']
  }
}

export async function renderMarkdownDocument(
  markdown: string,
  options: { rootId?: string; allowRawHtml?: boolean } = {}
): Promise<RenderedMarkdownResult> {
  const rootId = options.rootId || 'default-root'
  const { frontmatter, frontmatterRaw, body } = extractFrontmatter(markdown)
  const headings = extractHeadings(markdown)
  const wikiLinks = extractWikiLinks(markdown)
  const assetReferences = extractLocalAssetReferences(markdown)
  const { processed, mermaidBlocks } = preprocessExtensions(body, rootId, headings)

  // Strip dangerous inline schemes before AST processing
  const schemeFiltered = processed.replace(
    /(\[[^\]]*\]\()\s*(?:javascript|vbscript|data:text\/html|file):[^)]*(\))/gi,
    '$1#$2'
  )

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema as any)
    .use(rehypeKatex)
    .use(rehypeStringify)

  const file = await processor.process(schemeFiltered)
  let html = String(file)

  // Extra defense-in-depth strip for any residual event handler attributes or dangerous tags
  html = html
    .replace(/<(script|iframe|object|embed|applet|meta|link)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed|applet|meta|link)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*["']\s*(javascript|vbscript|data:text\/html|file):[^"']*["']/gi, '$1="#"')

  // Apply color-coded syntax highlighting to fenced <pre><code> blocks
  html = html.replace(
    /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_m, lang, encodedCode) => {
      const decoded = String(encodedCode)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
      const highlighted = highlightCodeToHtml(decoded, lang || '')
      return `<pre class="klartext-codeblock"><code class="language-${lang || 'text'}">${highlighted}</code></pre>`
    }
  )

  // Apply image resize/alignment/caption metadata (e.g. ![Caption|width=420|align=center](url)) in rendered HTML
  html = html.replace(/<img\s+([^>]*?)>/gi, (fullImg, attrs: string) => {
    const altMatch = attrs.match(/\balt="([^"]*)"/i)
    if (!altMatch) return fullImg
    const rawAlt = altMatch[1]
    if (!rawAlt.includes('|')) return fullImg
    const meta = parseImageAltMetadata(rawAlt)
    if (!meta.width && !meta.align) return fullImg
    const updatedAttrs = attrs.replace(
      /\balt="[^"]*"/i,
      `alt="${meta.caption.replace(/"/g, '&quot;')}"`
    )
    const widthAttr = meta.width ? ` width="${meta.width}"` : ''
    const alignClass = meta.align ? ` klartext-img-align-${meta.align}` : ''
    return `<img ${updatedAttrs}${widthAttr} class="klartext-preview-img${alignClass}">`
  })


  const plainWords = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`~>_[\]()!-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const wordCount = plainWords.length
  const charCount = markdown.length
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))

  return {
    html,
    frontmatter,
    frontmatterRaw,
    headings,
    wikiLinks,
    assetReferences,
    mermaidBlocks,
    wordCount,
    charCount,
    readingTimeMinutes
  }
}

export function formatMarkdownTable(rawTable: string): string {
  const lines = rawTable
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return rawTable

  const rows = lines.map((line) => {
    const trimmed = line.replace(/^\|/, '').replace(/\|$/, '')
    return trimmed.split('|').map((cell) => cell.trim())
  })

  const colCount = Math.max(...rows.map((r) => r.length))
  const colWidths = new Array(colCount).fill(3)

  rows.forEach((row, rIdx) => {
    if (rIdx === 1 && row.every((c) => /^:?-{2,}:?$/.test(c))) return
    for (let c = 0; c < colCount; c++) {
      const val = row[c] || ''
      colWidths[c] = Math.max(colWidths[c], val.length)
    }
  })

  return rows
    .map((row, rIdx) => {
      const isSeparator = rIdx === 1 && row.every((c) => /^:?-{1,}:?$/.test(c))
      const cells: string[] = []
      for (let c = 0; c < colCount; c++) {
        const val = row[c] || ''
        if (isSeparator) {
          const leftColon = val.startsWith(':')
          const rightColon = val.endsWith(':')
          const dashLen = Math.max(3, colWidths[c])
          if (leftColon && rightColon) {
            cells.push(`:${'-'.repeat(dashLen - 2)}:`)
          } else if (rightColon) {
            cells.push(`${'-'.repeat(dashLen - 1)}:`)
          } else if (leftColon) {
            cells.push(`:${'-'.repeat(dashLen - 1)}`)
          } else {
            cells.push('-'.repeat(dashLen))
          }
        } else {
          cells.push(val.padEnd(colWidths[c], ' '))
        }
      }
      return `| ${cells.join(' | ')} |`
    })
    .join('\n')
}

export function formatAllTablesInMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []
  let inCodeFence = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      out.push(line)
      i++
      continue
    }
    if (
      !inCodeFence &&
      line.trim().startsWith('|') &&
      line.trim().endsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('|')
    ) {
      const tableLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        tableLines.push(lines[i])
        i++
      }
      out.push(formatMarkdownTable(tableLines.join('\n')))
      continue
    }
    out.push(line)
    i++
  }

  return out.join('\n')
}

export function formatMarkdownDocument(markdown: string): string {
  // Preserve YAML frontmatter untouched
  const fmMatch = markdown.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/)
  const fmPrefix = fmMatch ? fmMatch[1].replace(/\r\n/g, '\n') : ''
  const rawBody = fmMatch ? markdown.slice(fmMatch[1].length) : markdown

  // First align all GFM tables
  const tableFormatted = formatAllTablesInMarkdown(rawBody)
  const lines = tableFormatted.split(/\r?\n/)
  const out: string[] = []
  let inCodeFence = false
  let blankCount = 0

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      blankCount = 0
      out.push(line.trimEnd())
      continue
    }
    if (inCodeFence) {
      out.push(line)
      continue
    }

    // Trim trailing spaces (preserve 2-space hard line break only if followed by text)
    line = line.replace(/[ \t]+$/, '')

    if (line.length === 0) {
      blankCount++
      if (blankCount <= 2) {
        out.push('')
      }
      continue
    }
    blankCount = 0

    // Normalize ATX heading spacing: `#   Heading` -> `# Heading`
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/)
    if (headingMatch) {
      line = `${headingMatch[1]} ${headingMatch[2].trim()}`
    }

    // Standardize unordered list markers (`* item` or `+ item` -> `- item`)
    const listMatch = line.match(/^(\s*)[*+]\s+(.+)$/)
    if (listMatch) {
      line = `${listMatch[1]}- ${listMatch[2]}`
    }

    // Normalize task list checkbox `[X]` -> `[x]`
    line = line.replace(/^(\s*-\s+)\[X\](\s+)/, '$1[x]$2')

    out.push(line)
  }

  const cleanedBody = out.join('\n').trim()
  if (!cleanedBody && !fmPrefix) return ''
  return `${fmPrefix}${cleanedBody}\n`
}

export function convertHtmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return ''
  let md = html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  // Convert HTML tables into formatted GFM tables
  md = md.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableInner) => {
    const rowMatches = String(tableInner).match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)
    if (!rowMatches || rowMatches.length === 0) return ''
    const rows: string[][] = []
    for (const rowHtml of rowMatches) {
      const cellMatches = rowHtml.match(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi) || []
      const cells = cellMatches.map((c) =>
        c
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length === 0) return ''
    const cols = Math.max(...rows.map((r) => r.length))
    const header = rows[0]
    const sep = new Array(cols).fill('---')
    const body = rows.slice(1)
    const rawTable = [
      `| ${header.join(' | ')} |`,
      `| ${sep.join(' | ')} |`,
      ...body.map((r) => `| ${r.join(' | ')} |`)
    ].join('\n')
    return `\n\n${formatMarkdownTable(rawTable)}\n\n`
  })

  // Headings
  for (let level = 1; level <= 6; level++) {
    const hashes = '#'.repeat(level)
    const re = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi')
    md = md.replace(re, (_m, inner) => `\n\n${hashes} ${String(inner).replace(/<[^>]+>/g, '').trim()}\n\n`)
  }

  // Code blocks
  md = md.replace(/<pre\b[^>]*>\s*<code(?:\s+class="[^"]*language-([a-z0-9_-]+)[^"]*")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, lang, code) => {
    const cleanCode = String(code)
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
    return `\n\n\`\`\`${lang || ''}\n${cleanCode.trim()}\n\`\`\`\n\n`
  })

  // Inline formatting
  md = md
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<(del|s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~')
    .replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<kbd\b[^>]*>([\s\S]*?)<\/kbd>/gi, '<kbd>$1</kbd>')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)')
    .replace(/<hr\b[^>]*\/?>/gi, '\n\n---\n\n')
    .replace(/<br\b[^>]*\/?>/gi, '\n')
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
      const clean = String(inner).replace(/<[^>]+>/g, '').trim()
      return `\n\n> ${clean.split(/\r?\n/).join('\n> ')}\n\n`
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => `- ${String(inner).replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<\/?(ul|ol|p|div)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return md
}

export function convertDelimitedTextToTable(text: string): string {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return text
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const parsed = lines.map((l) => l.split(delimiter).map((c) => c.trim()))
  const cols = Math.max(...parsed.map((r) => r.length))
  const header = parsed[0]
  const sep = new Array(cols).fill('---')
  const body = parsed.slice(1)
  const raw = [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`)
  ].join('\n')
  return formatMarkdownTable(raw)
}
