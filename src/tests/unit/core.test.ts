import { describe, it, expect } from 'vitest'
import {
  renderMarkdownDocument,
  extractFrontmatter,
  updateFrontmatterInMarkdown,
  formatMarkdownTable,
  convertDelimitedTextToTable
} from '../../shared/markdown/pipeline'
import {
  createDefaultExcalidrawScene,
  serializeExcalidrawSvg,
  extractExcalidrawSceneFromSvgOrJson
} from '../../shared/serialization/excalidraw-svg'
import {
  hasConflictMarkers,
  parseConflictHunks,
  resolveConflictHunkInText,
  resolveAllConflictHunksInText
} from '../../main/git/conflict-resolver'
import { calculateHardwareTierAdvice } from '../../main/ai/hardware-advisor'

describe('Unit Tests: Markdown Pipeline, Excalidraw SVG, Conflict Parser & Hardware Advisor', () => {
  it('extracts and updates YAML frontmatter losslessly', () => {
    const md = `---
title: Nordic Specification
status: draft
---
# Heading 1

Body paragraph.`

    const extracted = extractFrontmatter(md)
    expect(extracted.frontmatter).toEqual({
      title: 'Nordic Specification',
      status: 'draft'
    })
    expect(extracted.body.trim()).toContain('# Heading 1')

    const updated = updateFrontmatterInMarkdown(md, {
      title: 'Nordic Specification',
      status: 'approved'
    })
    const reExtracted = extractFrontmatter(updated)
    expect(reExtracted.frontmatter?.status).toBe('approved')
    expect(reExtracted.body.trim()).toContain('# Heading 1')
  })

  it('renders GFM tables, KaTeX math, callouts, WikiLinks, and Mermaid blocks accurately', async () => {
    const sample = `---
title: Complex Note
---
# Main Title

> [!WARNING] Important Notice
> Watch out for cross-root links.

See [[Architecture Overview|Arch Doc]] and [[RepoB:SecurityPolicy]].

Inline math $E = mc^2$ and block:

$$
\\int_0^1 x^2 dx
$$

| Feature | Supported |
| :--- | :--- |
| Tables | Yes |

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`
`
    const res = await renderMarkdownDocument(sample, { rootId: 'root-core' })
    expect(res.headings.length).toBe(1)
    expect(res.headings[0].text).toBe('Main Title')
    expect(res.wikiLinks.length).toBe(2)
    expect(res.wikiLinks[0]).toMatchObject({ target: 'Architecture Overview', alias: 'Arch Doc' })
    expect(res.wikiLinks[1]).toMatchObject({
      target: 'SecurityPolicy',
      isCrossRootExplicit: true,
      explicitRootName: 'RepoB'
    })
    expect(res.mermaidBlocks.length).toBe(1)
    expect(res.mermaidBlocks[0].code).toContain('flowchart TD')
    expect(res.html).toContain('klartext-callout-warning')
    expect(res.html).toContain('katex')
    expect(res.html).toContain('<table>')
  })

  it('formats GFM tables and converts TSV/CSV clipboard data into aligned tables', () => {
    const csv = `Name,Role,Language\nJohan,Architect,Swedish\nAnna,Engineer,English`
    const table = convertDelimitedTextToTable(csv)
    expect(table).toContain('| Name  | Role      | Language |')
    expect(table).toContain('| Johan | Architect | Swedish  |')

    const messy = `| A | B |\n|---|---|\n| LongerCell | Short |`
    const aligned = formatMarkdownTable(messy)
    expect(aligned).toContain('| LongerCell | Short |')
  })

  it('embeds and round-trips Excalidraw scene JSON inside portable .excalidraw.svg metadata', () => {
    const scene = createDefaultExcalidrawScene('dark')
    scene.elements.push({
      id: 'custom-el-99',
      type: 'ellipse',
      x: 120,
      y: 140,
      width: 90,
      height: 60,
      strokeColor: '#8AB6C3',
      backgroundColor: '#202428',
      text: 'Editable Node'
    })

    const svgString = serializeExcalidrawSvg(scene)
    expect(svgString).toContain('<svg')
    expect(svgString).toContain('klartext-excalidraw-scene')
    expect(svgString).toContain('Editable Node')

    const parsed = extractExcalidrawSceneFromSvgOrJson(svgString)
    expect(parsed).not.toBeNull()
    expect(parsed?.elements.length).toBe(3)
    expect(parsed?.elements[2].id).toBe('custom-el-99')
    expect(parsed?.elements[2].text).toBe('Editable Node')
  })

  it('parses and resolves Git merge conflict hunks (current, incoming, both)', () => {
    const conflictedDoc = `# Shared Document
Intro paragraph.
<<<<<<< HEAD
Local Swedish text: Användargränssnitt är snabbt.
=======
Remote English text: The user interface is fast.
>>>>>>> origin/main
Footer line.`

    expect(hasConflictMarkers(conflictedDoc)).toBe(true)
    const hunks = parseConflictHunks(conflictedDoc)
    expect(hunks.length).toBe(1)
    expect(hunks[0].currentContent).toContain('Användargränssnitt')
    expect(hunks[0].incomingContent).toContain('The user interface')

    const resolvedCurrent = resolveConflictHunkInText(conflictedDoc, 'current', 0)
    expect(hasConflictMarkers(resolvedCurrent)).toBe(false)
    expect(resolvedCurrent).toContain('Användargränssnitt')
    expect(resolvedCurrent).not.toContain('The user interface')

    const resolvedIncoming = resolveConflictHunkInText(conflictedDoc, 'incoming', 0)
    expect(hasConflictMarkers(resolvedIncoming)).toBe(false)
    expect(resolvedIncoming).toContain('The user interface')

    const resolvedBoth = resolveAllConflictHunksInText(conflictedDoc, 'both')
    expect(hasConflictMarkers(resolvedBoth)).toBe(false)
    expect(resolvedBoth).toContain('Användargränssnitt')
    expect(resolvedBoth).toContain('The user interface')
  })

  it('calculates all 4 Hardware Advisor tiers with vetted English & Swedish models', () => {
    const GB = 1024 * 1024 * 1024
    const tier1 = calculateHardwareTierAdvice(8 * GB)
    expect(tier1.tierId).toBe(1)
    expect(tier1.recommendedModels.some((m) => m.tag === 'gemma3:4b')).toBe(true)

    const tier2 = calculateHardwareTierAdvice(16 * GB)
    expect(tier2.tierId).toBe(2)
    expect(tier2.recommendedModels.some((m) => m.tag === 'gemma4:12b' && m.isTopPick)).toBe(true)

    const tier3 = calculateHardwareTierAdvice(32 * GB)
    expect(tier3.tierId).toBe(3)
    expect(tier3.recommendedModels.some((m) => m.tag === 'mistral-small:24b')).toBe(true)

    const tier4 = calculateHardwareTierAdvice(64 * GB)
    expect(tier4.tierId).toBe(4)
    expect(tier4.recommendedModels.some((m) => m.tag === 'gemma4:26b')).toBe(true)
    expect(tier4.embeddingModels.some((m) => m.tag === 'bge-m3')).toBe(true)
  })
})
