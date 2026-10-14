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

function preprocessExtensions(markdown: string, rootId: string): {
  processed: string
  mermaidBlocks: Array<{ index: number; code: string; startLine: number }>
} {
  const mermaidBlocks: Array<{ index: number; code: string; startLine: number }> = []
  const lines = markdown.split(/\r?\n/)
  const outLines: string[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Detect Mermaid code fence
    if (/^\s*```mermaid\s*$/i.test(line)) {
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

    // Detect Callout blocks: > [!NOTE] Title
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i)
    if (calloutMatch) {
      const kind = calloutMatch[1].toUpperCase()
      const title = calloutMatch[2].trim() || kind
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

    // Transform [[WikiLink|Alias]] inline outside code fences
    const wikiReplaced = line.replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_m, target, alias) => {
      const cleanTarget = String(target).trim()
      const label = alias ? String(alias).trim() : cleanTarget
      const isCrossRoot = cleanTarget.includes(':')
      return `<a href="#wikilink:${encodeURIComponent(cleanTarget)}" class="klartext-wikilink ${isCrossRoot ? 'klartext-wikilink-crossroot' : ''}" data-wikilink="${encodeURIComponent(cleanTarget)}">${label}</a>`
    })

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

    outLines.push(assetReplaced)
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
    'input'
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
    a: ['href', 'className', 'class', 'data-wikilink', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'className', 'class'],
    input: [['type', 'checkbox'], 'checked', 'disabled', 'className'],
    code: ['className', 'class'],
    span: ['className', 'class', 'style', 'aria-hidden']
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
  const { processed, mermaidBlocks } = preprocessExtensions(body, rootId)

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
