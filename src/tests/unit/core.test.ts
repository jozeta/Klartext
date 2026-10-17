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

  it('renders Inline Rich decorations including Mermaid widget on Welcome.md', async () => {
    const { EditorState } = await import('@codemirror/state')
    const { createLivePreviewExtension } = await import(
      '../../renderer/features/editor/live-preview-extension'
    )
    const starterContent = `---
title: Welcome to Klartext
author: Technical Nordic Workspace
tags:
  - local-first
  - markdown
  - multi-root
---

# Welcome to Klartext

Klartext is a fast, local-first Markdown editor with **Multi-Root Workspaces**, **Concurrent Multi-Repository Git**, **Excalidraw & Mermaid diagrams**, and **Optional Local AI** (English & Svenska).

> [!TIP] Progressive Complexity
> Press \`Cmd/Ctrl + K\` to open the Command Palette, \`Cmd/Ctrl + P\` for Quick File Switcher, or \`Cmd/Ctrl + Shift + F\` for Zen Mode.

## Supported Markdown Features

| Capability | Engine | Status |
| :--- | :--- | :--- |
| Live Inline Rich Editing | CodeMirror 6 Decorations | Active |
| Mathematical Expressions | KaTeX ($E = mc^2$) | Active |
| Interactive Diagrams | Mermaid + \`.excalidraw.svg\` | Active |

- [x] Single-root & Multi-root workspaces
- [x] Per-root portable assets (\`assets/\`)
- [x] Multi-repository Git sync & conflict resolution

\`\`\`mermaid
flowchart LR
    A["Multi-Root Workspace"] --> B["CodeMirror 6 Live Preview"]
    B --> C["Multi-Repo Git Sync"]
    B --> D["Local AI (SV / EN)"]
\`\`\`
`
    const ext = createLivePreviewExtension({
      inlineRichMode: true,
      rootId: 'root-starter',
      onResolveConflict: () => {},
      onNavigateLink: () => {},
      onOpenExcalidraw: () => {}
    })
    const state = EditorState.create({
      doc: starterContent,
      extensions: [ext]
    })
    const decoSet = state.field(ext[0])
    const foundWidgets: string[] = []
    decoSet.between(0, state.doc.length, (from, _to, value) => {
      const w = (value.spec as { widget?: { constructor: { name: string } } })?.widget
      if (w) {
        foundWidgets.push(`${w.constructor.name}@L${state.doc.lineAt(from).number}`)
      }
    })
    expect(foundWidgets).toEqual([
      'InlineTableWidget@L19',
      'TaskCheckboxWidget@L25',
      'TaskCheckboxWidget@L26',
      'TaskCheckboxWidget@L27',
      'InlineMermaidBlockWidget@L29'
    ])
  })

  it('color-codes code blocks with row numbers, validates spellcheck explanations & synonyms, and parses/generates Mermaid visual graphs', async () => {
    const { highlightCodeToHtml } = await import('../../shared/markdown/syntax-highlight')
    const {
      isWordSpelledCorrectly,
      getSpellingSuggestions,
      getSpellingSuggestionsDetailed
    } = await import('../../renderer/features/editor/spellcheck-extension')
    const {
      generateMermaidFromVisualGraph,
      parseMermaidToVisualGraph
    } = await import('../../renderer/features/diagrams/DiagramWidgets')

    const highlighted = highlightCodeToHtml(
      'export async function compute(x: number): Promise<string> { return "ok" // comment\n}',
      'typescript'
    )
    expect(highlighted).toContain('class="klartext-code-linenum"')
    expect(highlighted).toContain('class="hl-keyword"')
    expect(highlighted).toContain('class="hl-type"')
    expect(highlighted).toContain('class="hl-string"')
    expect(highlighted).toContain('class="hl-comment"')

    // Spellcheck: English & Swedish valid words pass; typos are flagged with explanations & synonyms
    expect(isWordSpelledCorrectly('architecture', ['en-US', 'sv-SE'])).toBe(true)
    expect(isWordSpelledCorrectly('användargränssnitt', ['en-US', 'sv-SE'])).toBe(true)
    expect(isWordSpelledCorrectly('missspelled', ['en-US', 'sv-SE'])).toBe(false)
    const suggestions = getSpellingSuggestions('missspelled', ['en-US', 'sv-SE'])
    expect(suggestions).toContain('misspelled')
    const detailed = getSpellingSuggestionsDetailed('missspelled', ['en-US', 'sv-SE'])
    expect(detailed.suggestions.length).toBeGreaterThan(0)
    expect(detailed.suggestions[0].explanation.length).toBeGreaterThan(0)
    expect(detailed.synonyms.length).toBeGreaterThan(0)
    expect(detailed.synonyms[0].explanation.length).toBeGreaterThan(0)

    // Visual Mermaid Builder code generation + round-trip parsing
    const mermaidOut = generateMermaidFromVisualGraph(
      'LR',
      [
        { id: 'A', label: 'Start', shape: 'round', x: 10, y: 10 },
        { id: 'B', label: 'Check?', shape: 'diamond', x: 150, y: 10 }
      ],
      [{ id: 'E1', from: 'A', to: 'B', style: '-->', label: 'Verify' }]
    )
    expect(mermaidOut).toContain('flowchart LR')
    expect(mermaidOut).toContain('A("Start")')
    expect(mermaidOut).toContain('B{"Check?"}')
    expect(mermaidOut).toContain('A -->|"Verify"| B')

    // Starting a new diagram in the Visual Mermaid Builder returns a clean, empty canvas
    const emptyGraph = parseMermaidToVisualGraph()
    expect(emptyGraph.nodes).toEqual([])
    expect(emptyGraph.edges).toEqual([])

    const parsedGraph = parseMermaidToVisualGraph(mermaidOut)
    expect(parsedGraph.direction).toBe('LR')
    expect(parsedGraph.nodes.length).toBe(2)
    expect(parsedGraph.nodes[0]).toMatchObject({ id: 'A', label: 'Start', shape: 'round' })
    expect(parsedGraph.nodes[1]).toMatchObject({ id: 'B', label: 'Check?', shape: 'diamond' })
    expect(parsedGraph.edges.length).toBe(1)
    expect(parsedGraph.edges[0]).toMatchObject({ from: 'A', to: 'B', style: '-->', label: 'Verify' })
  })

  it('supports extended Markdown syntax (highlight, spoiler, kbd, TOC, definition list), document formatter, and HTML-to-Markdown paste', async () => {
    const {
      formatMarkdownDocument,
      convertHtmlToMarkdown
    } = await import('../../shared/markdown/pipeline')

    const extendedDoc = `# Overview

[[_TOC_]]

Here is ==important highlight==, >!secret spoiler!<, and <kbd>⌘K</kbd>.

Markdown
: A lightweight markup language
`
    const rendered = await renderMarkdownDocument(extendedDoc)
    expect(rendered.html).toContain('class="klartext-toc"')
    expect(rendered.html).toContain('class="klartext-highlight"')
    expect(rendered.html).toContain('class="klartext-spoiler"')
    expect(rendered.html).toContain('<kbd>⌘K</kbd>')
    expect(rendered.html).toContain('class="klartext-deflist"')

    const unformatted = `#   Messy Heading   \n* Bullet one\n+ Bullet two\n- [X] Done task\n\n\n\n| Name | Value |\n|---|---|\n| LongerKey | 42 |\n`
    const pretty = formatMarkdownDocument(unformatted)
    expect(pretty).toContain('# Messy Heading')
    expect(pretty).toContain('- Bullet one\n- Bullet two\n- [x] Done task')
    expect(pretty).toContain('| LongerKey | 42    |')

    const pastedHtml = '<h2>Title</h2><p>Hello <strong>world</strong> and <a href="https://example.com">link</a></p>'
    const convertedMd = convertHtmlToMarkdown(pastedHtml)
    expect(convertedMd).toContain('## Title')
    expect(convertedMd).toContain('**world**')
    expect(convertedMd).toContain('[link](https://example.com)')
  })
})

