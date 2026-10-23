import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { MultiRootRegistry, atomicWriteFile } from '../workspace/multi-root-registry'
import { renderMarkdownDocument, extractFrontmatter } from '../../shared/markdown/pipeline'
import { htmlToCleanMarkdown } from '../../shared/markdown/export-formats'

const NORDIC_EXPORT_STYLES = `
  :root {
    --bg-app: #F5F6F7;
    --bg-panel: #FFFFFF;
    --bg-secondary: #EEF1F3;
    --text-primary: #20272D;
    --text-secondary: #687580;
    --border-subtle: #DDE2E6;
    --accent-primary: #426B79;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 24px;
    background: var(--bg-panel);
    color: var(--text-primary);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.65;
    max-width: 820px;
    margin-left: auto;
    margin-right: auto;
  }
  h1, h2, h3, h4, h5, h6 {
    color: var(--text-primary);
    font-weight: 600;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  h1 { font-size: 2rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.3em; }
  h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.25em; }
  code, pre {
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
    font-size: 0.9em;
  }
  pre {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 14px 16px;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.25em 0;
  }
  th, td {
    border: 1px solid var(--border-subtle);
    padding: 8px 12px;
    text-align: left;
  }
  th { background: var(--bg-secondary); font-weight: 600; }
  blockquote, .klartext-callout {
    border-left: 3px solid var(--accent-primary);
    background: var(--bg-secondary);
    margin: 1em 0;
    padding: 10px 16px;
    border-radius: 0 6px 6px 0;
  }
  .klartext-callout-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--accent-primary);
  }
  .klartext-bookmark-card {
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 12px 16px;
    margin: 1em 0;
    background: var(--bg-secondary);
  }
  .klartext-bookmark-title { font-weight: 600; margin-bottom: 4px; }
  .klartext-bookmark-desc { font-size: 0.9em; color: var(--text-secondary); margin-bottom: 4px; }
  .klartext-bookmark-domain { font-size: 0.8em; font-family: monospace; color: var(--accent-primary); }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  @media print {
    body { padding: 0; max-width: none; }
    pre, table, blockquote, .klartext-callout, img, svg {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    h1, h2, h3, h4 {
      break-after: avoid;
      page-break-after: avoid;
    }
  }
`

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function computeCrc32(buf: Buffer): number {
  if (typeof (zlib as any).crc32 === 'function') {
    return (zlib as any).crc32(buf) >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Create a valid PKZIP buffer from in-memory files (used to package OpenXML .docx)
 */
function buildZipArchive(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8')
    const dataBuf = file.data
    const crc = computeCrc32(dataBuf)

    const localHeader = Buffer.alloc(30 + nameBuf.length)
    localHeader.writeUInt32LE(0x04034b50, 0) // Local file header signature
    localHeader.writeUInt16LE(20, 4) // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0, 6) // General purpose bit flag
    localHeader.writeUInt16LE(0, 8) // Compression method (0 = store)
    localHeader.writeUInt16LE(0, 10) // Last mod file time
    localHeader.writeUInt16LE(0, 12) // Last mod file date
    localHeader.writeUInt32LE(crc, 14) // CRC-32
    localHeader.writeUInt32LE(dataBuf.length, 18) // Compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22) // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26) // File name length
    localHeader.writeUInt16LE(0, 28) // Extra field length
    nameBuf.copy(localHeader, 30)

    localParts.push(localHeader, dataBuf)

    const centralHeader = Buffer.alloc(46 + nameBuf.length)
    centralHeader.writeUInt32LE(0x02014b50, 0) // Central directory signature
    centralHeader.writeUInt16LE(20, 4) // Version made by
    centralHeader.writeUInt16LE(20, 6) // Version needed
    centralHeader.writeUInt16LE(0, 8) // General purpose bit flag
    centralHeader.writeUInt16LE(0, 10) // Compression method (0 = store)
    centralHeader.writeUInt16LE(0, 12) // Mod time
    centralHeader.writeUInt16LE(0, 14) // Mod date
    centralHeader.writeUInt32LE(crc, 16) // CRC-32
    centralHeader.writeUInt32LE(dataBuf.length, 20) // Compressed size
    centralHeader.writeUInt32LE(dataBuf.length, 24) // Uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28) // File name length
    centralHeader.writeUInt16LE(0, 30) // Extra field length
    centralHeader.writeUInt16LE(0, 32) // File comment length
    centralHeader.writeUInt16LE(0, 34) // Disk number start
    centralHeader.writeUInt16LE(0, 36) // Internal file attributes
    centralHeader.writeUInt32LE(0, 38) // External file attributes
    centralHeader.writeUInt32LE(offset, 42) // Relative offset of local header
    nameBuf.copy(centralHeader, 46)

    centralParts.push(centralHeader)
    offset += localHeader.length + dataBuf.length
  }

  const centralDirBuf = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // End of central directory signature
  eocd.writeUInt16LE(0, 4) // Number of this disk
  eocd.writeUInt16LE(0, 6) // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8) // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10) // Total number of central directory records
  eocd.writeUInt32LE(centralDirBuf.length, 12) // Size of central directory
  eocd.writeUInt32LE(offset, 16) // Offset of start of central directory
  eocd.writeUInt16LE(0, 20) // Comment length

  return Buffer.concat([...localParts, centralDirBuf, eocd])
}

/**
 * Convert Markdown inline text into WordprocessingML <w:r> elements
 */
function markdownInlineToWordXml(text: string): string {
  const clean = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  const tokens = clean.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean)
  return tokens
    .map((tok) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(tok.slice(2, -2))}</w:t></w:r>`
      }
      if (tok.startsWith('*') && tok.endsWith('*')) {
        return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(tok.slice(1, -1))}</w:t></w:r>`
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return `<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr><w:t xml:space="preserve">${escapeXml(tok.slice(1, -1))}</w:t></w:r>`
      }
      return `<w:r><w:t xml:space="preserve">${escapeXml(tok)}</w:t></w:r>`
    })
    .join('')
}

/**
 * Build a complete OpenXML .docx Buffer from a Markdown string
 */
export function generateDocxBufferFromMarkdown(markdown: string, title?: string): Buffer {
  const { body } = extractFrontmatter(markdown)
  const lines = body.split(/\r?\n/)
  const paragraphsXml: string[] = []
  let inCodeFence = false

  for (const rawLine of lines) {
    if (/^\s*```/.test(rawLine)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) {
      paragraphsXml.push(
        `<w:p><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(rawLine)}</w:t></w:r></w:p>`
      )
      continue
    }
    const trimmed = rawLine.trim()
    if (!trimmed) {
      paragraphsXml.push('<w:p/>')
      continue
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const fontSizeHalfPt = level === 1 ? 36 : level === 2 ? 30 : level === 3 ? 26 : 24
      paragraphsXml.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${fontSizeHalfPt}"/></w:rPr><w:t xml:space="preserve">${escapeXml(headingMatch[2].trim())}</w:t></w:r></w:p>`
      )
      continue
    }
    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (listMatch) {
      paragraphsXml.push(
        `<w:p><w:r><w:t xml:space="preserve">• </w:t></w:r>${markdownInlineToWordXml(listMatch[1])}</w:p>`
      )
      continue
    }
    paragraphsXml.push(`<w:p>${markdownInlineToWordXml(trimmed)}</w:p>`)
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(title || 'Klartext Document')}</dc:title>
  <dc:creator>Klartext</dc:creator>
</cp:coreProperties>`

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`

  return buildZipArchive([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypesXml, 'utf-8') },
    { name: '_rels/.rels', data: Buffer.from(relsXml, 'utf-8') },
    { name: 'docProps/core.xml', data: Buffer.from(coreXml, 'utf-8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf-8') }
  ])
}

export class ExportService {
  constructor(private registry: MultiRootRegistry) {}

  async generateStandaloneHtml(params: {
    rootId: string
    relativePath: string
    markdown: string
    title?: string
    inlineAssets?: boolean
  }): Promise<string> {
    const rendered = await renderMarkdownDocument(params.markdown, {
      rootId: params.rootId,
      allowRawHtml: false
    })

    let bodyHtml = rendered.html

    // Inline local klartext-asset://<rootId>/<path> images as Base64 data URIs when requested
    if (params.inlineAssets !== false) {
      const assetRegex = /src="klartext-asset:\/\/([^/]+)\/([^"]+)"/g
      const matches = Array.from(bodyHtml.matchAll(assetRegex))
      for (const m of matches) {
        const [fullAttr, rId, encodedRel] = m
        try {
          const decodedRel = decodeURIComponent(encodedRel)
          const absAsset = this.registry.pathGuard.resolveScopedPath(
            decodeURIComponent(rId),
            decodedRel
          )
          if (fs.existsSync(absAsset)) {
            const ext = path.extname(absAsset).toLowerCase()
            const mime =
              ext === '.svg'
                ? 'image/svg+xml'
                : ext === '.jpg' || ext === '.jpeg'
                  ? 'image/jpeg'
                  : ext === '.gif'
                    ? 'image/gif'
                    : ext === '.webp'
                      ? 'image/webp'
                      : 'image/png'
            const base64 = (await fs.promises.readFile(absAsset)).toString('base64')
            bodyHtml = bodyHtml.replace(fullAttr, `src="data:${mime};base64,${base64}"`)
          }
        } catch {
          // Keep original reference if asset missing
        }
      }
    }

    const safeTitle = (params.title || path.basename(params.relativePath, '.md')).replace(
      /[<>&"]/g,
      ''
    )

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>${NORDIC_EXPORT_STYLES}</style>
</head>
<body>
  <article class="klartext-exported-document">
    ${bodyHtml}
  </article>
</body>
</html>`
  }

  async exportToHtmlFile(params: {
    rootId: string
    relativePath: string
    markdown: string
    title?: string
    inlineAssets?: boolean
    targetFilePath?: string
  }): Promise<{ outputPath: string; html: string }> {
    const html = await this.generateStandaloneHtml(params)
    const defaultOut = this.registry.pathGuard.resolveScopedPath(
      params.rootId,
      params.relativePath.replace(/\.(md|markdown)$/i, '') + '.export.html'
    )
    const outputPath = params.targetFilePath || defaultOut
    await atomicWriteFile(outputPath, html)
    return { outputPath, html }
  }

  async exportToDocxFile(params: {
    rootId: string
    relativePath: string
    markdown: string
    title?: string
    targetFilePath?: string
  }): Promise<{ outputPath: string; sizeBytes: number }> {
    const docxBuffer = generateDocxBufferFromMarkdown(
      params.markdown,
      params.title || path.basename(params.relativePath, '.md')
    )
    const defaultOut = this.registry.pathGuard.resolveScopedPath(
      params.rootId,
      params.relativePath.replace(/\.(md|markdown)$/i, '') + '.docx'
    )
    const outputPath = params.targetFilePath || defaultOut
    await atomicWriteFile(outputPath, docxBuffer)
    return { outputPath, sizeBytes: docxBuffer.length }
  }

  async fetchUrlMetadata(url: string): Promise<{
    url: string
    title: string
    description: string
    domain: string
  }> {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`)
    }
    const domain = parsedUrl.hostname.replace(/^www\./, '')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Klartext-Markdown-Editor/1.3'
        }
      })
      const rawHtml = await res.text()
      const parsed = htmlToCleanMarkdown(rawHtml, url)
      return {
        url,
        title: parsed.title || domain,
        description: parsed.description || '',
        domain: parsed.domain || domain
      }
    } catch {
      return {
        url,
        title: domain || url,
        description: '',
        domain
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async clipWebPageToMarkdown(url: string): Promise<{
    url: string
    title: string
    description: string
    domain: string
    markdown: string
    bodyMarkdown: string
  }> {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Klartext-Markdown-Editor/1.3'
        }
      })
      const rawHtml = await res.text()
      const parsed = htmlToCleanMarkdown(rawHtml, url)
      return {
        url,
        title: parsed.title,
        description: parsed.description,
        domain: parsed.domain,
        markdown: parsed.fullMarkdown,
        bodyMarkdown: parsed.bodyMarkdown
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
