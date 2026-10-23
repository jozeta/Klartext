/**
 * Shared Markdown conversion utilities for:
 * - 4.1 Smart URL Paste & Bookmark Cards
 * - 4.2 Web Clipper (HTML -> Clean Local Markdown)
 * - 4.3 Slide Deck Presentation Mode & Slack / Jira / GFM Markdown Exporters
 */

export type SlideSplitMode = 'auto' | 'hr' | 'h1-h2' | 'all-headings'

export interface SlideDeckItem {
  index: number
  title: string
  markdown: string
  speakerNotes: string
  layout?: 'cover' | 'section' | 'content'
  hasMermaid?: boolean
  hasCode?: boolean
  hasTable?: boolean
  hasImage?: boolean
  hasMath?: boolean
}

/**
 * Strip YAML frontmatter from the top of a Markdown document
 */
export function stripYamlFrontmatter(markdown: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!fmMatch) {
    return { frontmatter: {}, body: markdown }
  }
  const fmRaw = fmMatch[1]
  const frontmatter: Record<string, string> = {}
  for (const line of fmRaw.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (m) {
      frontmatter[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  return {
    frontmatter,
    body: markdown.slice(fmMatch[0].length)
  }
}

function splitChunkByHeadings(chunk: string, maxHeadingDepth: number): string[] {
  const lines = chunk.split(/\r?\n/)
  const headingPattern = new RegExp(`^#{1,${maxHeadingDepth}}\\s+.+$`)
  const sections: string[] = []
  let current: string[] = []
  let activeFenceTicks = 0
  let seenHeadingInCurrent = false

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,})([\w-]*)\s*$/)
    if (fenceMatch) {
      const ticks = fenceMatch[1].length
      if (activeFenceTicks === 0) {
        activeFenceTicks = ticks
      } else if (ticks >= activeFenceTicks && !fenceMatch[2]) {
        activeFenceTicks = 0
      }
      current.push(line)
      continue
    }

    if (activeFenceTicks === 0 && headingPattern.test(line)) {
      if (seenHeadingInCurrent && current.join('\n').trim().length > 0) {
        sections.push(current.join('\n').trim())
        current = [line]
      } else {
        current.push(line)
      }
      seenHeadingInCurrent = true
    } else {
      current.push(line)
    }
  }

  if (current.join('\n').trim().length > 0) {
    sections.push(current.join('\n').trim())
  }

  return sections.length > 0 ? sections : [chunk.trim()]
}

function countHeadingsOutsideFences(chunk: string, maxHeadingDepth: number): number {
  const lines = chunk.split(/\r?\n/)
  const headingPattern = new RegExp(`^#{1,${maxHeadingDepth}}\\s+.+$`)
  let activeFenceTicks = 0
  let count = 0
  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,})([\w-]*)\s*$/)
    if (fenceMatch) {
      const ticks = fenceMatch[1].length
      if (activeFenceTicks === 0) {
        activeFenceTicks = ticks
      } else if (ticks >= activeFenceTicks && !fenceMatch[2]) {
        activeFenceTicks = 0
      }
      continue
    }
    if (activeFenceTicks === 0 && headingPattern.test(line)) {
      count++
    }
  }
  return count
}

/**
 * 4.3 Parse a Markdown document into a Slide Deck.
 * - `hr`: Split strictly on `---` / `***` / `___` horizontal rules outside code fences.
 * - `h1-h2`: Split on `---` rules AND `#` / `##` headings.
 * - `all-headings`: Split on `---` rules AND `#` / `##` / `###` headings.
 * - `auto` (default): Split on `---` horizontal rules, and automatically split any chunk that
 *   contains multiple `#` / `##` sections so regular structured notes present cleanly as multi-slide decks.
 * Supports speaker notes via `Note:\n...`, `???\n...`, or `<!-- note: ... -->`.
 */
export function parseSlideDeck(
  markdown: string,
  splitMode: SlideSplitMode = 'auto'
): SlideDeckItem[] {
  const { frontmatter, body } = stripYamlFrontmatter(markdown)
  // First pass: split on horizontal rules (`---`, `***`, `___`) outside fenced code blocks
  const lines = body.split(/\r?\n/)
  const hrChunks: string[] = []
  let currentLines: string[] = []
  let activeFenceTicks = 0

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,})([\w-]*)\s*$/)
    if (fenceMatch) {
      const ticks = fenceMatch[1].length
      if (activeFenceTicks === 0) {
        activeFenceTicks = ticks
      } else if (ticks >= activeFenceTicks && !fenceMatch[2]) {
        activeFenceTicks = 0
      }
      currentLines.push(line)
      continue
    }
    if (activeFenceTicks === 0 && /^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      hrChunks.push(currentLines.join('\n').trim())
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentLines.join('\n').trim() || hrChunks.length === 0) {
    hrChunks.push(currentLines.join('\n').trim())
  }

  const nonEmptyHrChunks = hrChunks.filter((s) => s.length > 0)
  const baseChunks =
    nonEmptyHrChunks.length > 0 ? nonEmptyHrChunks : [body.trim() || '# Slide 1']

  let rawSlides: string[] = []
  if (splitMode === 'hr') {
    rawSlides = baseChunks
  } else if (splitMode === 'h1-h2') {
    rawSlides = baseChunks.flatMap((chunk) => splitChunkByHeadings(chunk, 2))
  } else if (splitMode === 'all-headings') {
    rawSlides = baseChunks.flatMap((chunk) => splitChunkByHeadings(chunk, 3))
  } else {
    // 'auto' mode: preserve explicit --- chunks when each chunk is a single slide,
    // and automatically split any multi-heading chunk by # / ## headings!
    rawSlides = baseChunks.flatMap((chunk) => {
      const h12Count = countHeadingsOutsideFences(chunk, 2)
      if (h12Count >= 2) {
        return splitChunkByHeadings(chunk, 2)
      }
      if (baseChunks.length === 1 && countHeadingsOutsideFences(chunk, 3) >= 2) {
        return splitChunkByHeadings(chunk, 3)
      }
      return [chunk]
    })
  }

  const effectiveSlides =
    rawSlides.filter((s) => s.length > 0).length > 0
      ? rawSlides.filter((s) => s.length > 0)
      : [body.trim() || '# Slide 1']

  return effectiveSlides.map((rawSlide, idx) => {
    let slideMd = rawSlide
    const notesParts: string[] = []

    // Extract HTML comment speaker notes: <!-- note: ... -->
    slideMd = slideMd.replace(/<!--\s*notes?:\s*([\s\S]*?)-->/gi, (_m, noteText) => {
      if (noteText.trim()) notesParts.push(noteText.trim())
      return ''
    })

    // Extract Remark-style `???` speaker notes or `Note:` section at bottom of slide
    const remarkSplit = slideMd.split(/\r?\n\?\?\?\r?\n/)
    if (remarkSplit.length > 1) {
      slideMd = remarkSplit[0].trim()
      notesParts.push(remarkSplit.slice(1).join('\n\n').trim())
    } else {
      const noteMatch = slideMd.match(/(?:^|\n)Notes?:\s*(?:\r?\n)?([\s\S]+)$/i)
      if (noteMatch && typeof noteMatch.index === 'number') {
        notesParts.push(noteMatch[1].trim())
        slideMd = slideMd.slice(0, noteMatch.index).trim()
      }
    }

    const headingMatch = slideMd.match(/^#{1,6}\s+(.+)$/m)
    const cleanHeadingTitle = headingMatch
      ? headingMatch[1]
          .replace(/[*_`~]/g, '')
          .replace(/:icon\[[^\]]+\]:/g, '')
          .trim()
      : ''
    const fallbackTitle =
      idx === 0 && frontmatter.title ? frontmatter.title : `Slide ${idx + 1}`

    const trimmedMd = slideMd.trim()
    const nonEmptyBodyLines = trimmedMd
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^#{1,6}\s+/.test(l))

    const isCover =
      (idx === 0 && /^#\s+/.test(trimmedMd) && nonEmptyBodyLines.length <= 3) ||
      (nonEmptyBodyLines.length === 0 && /^#{1,2}\s+/.test(trimmedMd))

    const hasMermaid = /```mermaid/i.test(trimmedMd)
    const hasCode = /```(?!mermaid)\w*/i.test(trimmedMd)
    const hasTable = /^\|.+\|\s*$/m.test(trimmedMd)
    const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(trimmedMd)
    const hasMath = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$/.test(trimmedMd)

    return {
      index: idx,
      title: cleanHeadingTitle || fallbackTitle,
      markdown: trimmedMd,
      speakerNotes: notesParts.join('\n\n').trim(),
      layout: isCover ? 'cover' : 'content',
      hasMermaid,
      hasCode,
      hasTable,
      hasImage,
      hasMath
    }
  })
}

/**
 * 4.3 Convert Markdown to Slack `mrkdwn` format
 */
export function convertMarkdownToSlack(markdown: string): string {
  const { body } = stripYamlFrontmatter(markdown)
  let out = body

  // Headings -> *Bold Heading*
  out = out.replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
  // Bold/Italic: **text** -> *text*
  out = out.replace(/\*\*([^*]+)\*\*/g, '*$1*')
  // Strikethrough: ~~text~~ -> ~text~
  out = out.replace(/~~([^~]+)~~/g, '~$1~')
  // Links: [label](url) -> <url|label>
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<$2|$1>')
  // Checklists: - [x] -> ☑, - [ ] -> ☐
  out = out.replace(/^(\s*)[-*+]\s+\[x\]\s+/gim, '$1• ☑ ')
  out = out.replace(/^(\s*)[-*+]\s+\[ \]\s+/gm, '$1• ☐ ')
  // Bullet lists: - item -> • item
  out = out.replace(/^(\s*)[-*+]\s+/gm, '$1• ')

  return out.trim()
}

/**
 * 4.3 Convert Markdown to Jira Wiki Markup format
 */
export function convertMarkdownToJira(markdown: string): string {
  const { body } = stripYamlFrontmatter(markdown)
  let out = body

  // Fenced code blocks: ```lang\ncode\n``` -> {code:lang}\ncode\n{code}
  out = out.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const header = lang ? `{code:${lang}}` : '{code}'
    return `${header}\n${code.replace(/\r?\n$/, '')}\n{code}`
  })

  // Headings: # H1 -> h1. H1
  out = out.replace(/^(#{1,6})\s+(.+)$/gm, (_m, hashes: string, text: string) => {
    return `h${hashes.length}. ${text.trim()}`
  })

  // Bold: **text** -> *text*
  out = out.replace(/\*\*([^*]+)\*\*/g, '*$1*')
  // Strikethrough: ~~text~~ -> -text-
  out = out.replace(/~~([^~]+)~~/g, '-$1-')
  // Inline code: `code` -> {{code}}
  out = out.replace(/`([^`\n]+)`/g, '{{$1}}')
  // Links: [label](url) -> [label|url]
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '[$1|$2]')

  return out.trim()
}

/**
 * 4.3 Convert Klartext extended Markdown to clean GitHub-Flavored Markdown (GFM)
 */
export function convertMarkdownToGfm(markdown: string): string {
  const { body } = stripYamlFrontmatter(markdown)
  let out = body

  // Convert [[WikiLink|Alias]] -> [Alias](WikiLink.md) and [[WikiLink]] -> [WikiLink](WikiLink.md)
  out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, target, alias) => {
    const cleanTarget = target.trim().endsWith('.md') ? target.trim() : `${target.trim()}.md`
    return `[${alias.trim()}](${encodeURI(cleanTarget)})`
  })
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_m, target) => {
    const cleanTarget = target.trim().endsWith('.md') ? target.trim() : `${target.trim()}.md`
    return `[${target.trim()}](${encodeURI(cleanTarget)})`
  })

  // Convert :::bookmark blocks into clean GFM blockquotes
  out = out.replace(/:::bookmark\r?\n([\s\S]*?)\r?\n:::/g, (_m, inner) => {
    const props: Record<string, string> = {}
    for (const line of String(inner).split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
      if (m) props[m[1].trim()] = m[2].trim()
    }
    const title = props.title || props.url || 'Bookmark'
    const url = props.url || '#'
    const desc = props.description ? `\n> ${props.description}` : ''
    return `> **[${title}](${url})**${desc}`
  })

  return out.trim()
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
}

/**
 * 4.1 & 4.2 Extract metadata and clean Markdown from raw HTML
 */
export function htmlToCleanMarkdown(
  rawHtml: string,
  sourceUrl = ''
): {
  title: string
  description: string
  domain: string
  bodyMarkdown: string
  fullMarkdown: string
} {
  let domain = ''
  try {
    if (sourceUrl) {
      domain = new URL(sourceUrl).hostname.replace(/^www\./, '')
    }
  } catch {
    domain = ''
  }

  // Extract <title> or og:title
  const titleMatch =
    rawHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    rawHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : ''

  // Extract description
  const descMatch =
    rawHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    rawHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
    rawHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    rawHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
  const description = descMatch
    ? decodeHtmlEntities(descMatch[1].replace(/\s+/g, ' ').trim())
    : ''

  // Prefer <article> or <main>, fallback to <body>
  const articleMatch =
    rawHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    rawHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let html = articleMatch ? articleMatch[1] : rawHtml

  // Strip scripts, styles, nav, footer, header, noscript, svg
  html = html
    .replace(/<(script|style|noscript|nav|footer|aside|iframe|svg)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Convert <pre><code>...</code></pre>
  html = html.replace(/<pre[^>]*>\s*(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi, (_m, code) => {
    const cleanCode = decodeHtmlEntities(code.replace(/<[^>]+>/g, '')).trim()
    return `\n\n\`\`\`\n${cleanCode}\n\`\`\`\n\n`
  })

  // Convert headings h1-h6
  html = html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, inner) => {
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    if (!text) return ''
    return `\n\n${'#'.repeat(Number(level))} ${text}\n\n`
  })

  // Convert links <a href="...">text</a>
  html = html.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    if (!text) return ''
    let resolvedUrl = href.trim()
    if (sourceUrl && resolvedUrl.startsWith('/')) {
      try {
        resolvedUrl = new URL(resolvedUrl, sourceUrl).toString()
      } catch {
        // keep relative
      }
    }
    return `[${text}](${resolvedUrl})`
  })

  // Convert images <img src="..." alt="...">
  html = html.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (fullTag, src) => {
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i)
    const alt = altMatch ? decodeHtmlEntities(altMatch[1].trim()) : 'Image'
    let resolvedSrc = src.trim()
    if (sourceUrl && resolvedSrc.startsWith('/')) {
      try {
        resolvedSrc = new URL(resolvedSrc, sourceUrl).toString()
      } catch {
        // keep
      }
    }
    return `\n![${alt}](${resolvedSrc})\n`
  })

  // Convert bold, italic, inline code
  html = html
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // Convert blockquotes
  html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').trim())
    return `\n\n> ${text.split(/\r?\n/).join('\n> ')}\n\n`
  })

  // Convert list items
  html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
    const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    return text ? `\n- ${text}` : ''
  })
  html = html.replace(/<\/?(ul|ol)[^>]*>/gi, '\n')

  // Convert paragraphs and line breaks
  html = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<\/?(div|section|header|main|article|tr|td|th|table)[^>]*>/gi, '\n')

  // Strip remaining HTML tags
  const stripped = decodeHtmlEntities(html.replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const title = rawTitle || domain || 'Clipped Web Page'
  const today = new Date().toISOString().slice(0, 10)
  const hasTopHeading = /^#\s+/m.test(stripped)
  const bodyMarkdown = hasTopHeading ? stripped : `# ${title}\n\n${stripped}`
  const fullMarkdown = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: "${today}"`,
    ...(sourceUrl ? [`source_url: "${sourceUrl}"`] : []),
    'status: "Clipped"',
    '---',
    '',
    bodyMarkdown,
    ''
  ].join('\n')

  return {
    title,
    description,
    domain,
    bodyMarkdown,
    fullMarkdown
  }
}
