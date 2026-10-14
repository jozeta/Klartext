import fs from 'fs'
import path from 'path'
import { MultiRootRegistry, atomicWriteFile } from '../workspace/multi-root-registry'
import { renderMarkdownDocument } from '../../shared/markdown/pipeline'

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
}
