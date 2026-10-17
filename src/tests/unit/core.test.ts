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

  it('evaluates <% %> dynamic template variables in content and filenames including dates, relative dates, folder slugs, breadcrumbs, git, system info, and cursor placement', async () => {
    const {
      evaluateTemplateVariables,
      evaluateTemplateFileName,
      TEMPLATE_VARIABLES_DOCS
    } = await import('../../shared/templates/template-engine')
    expect(TEMPLATE_VARIABLES_DOCS.length).toBeGreaterThanOrEqual(60)

    const fixedNow = new Date('2026-10-17T14:30:45.000Z')
    const ctx = {
      now: fixedNow,
      fileName: 'Sprint Plan 2026.md',
      fileTitle: 'Sprint Plan 2026',
      relativePath: 'Engineering/Roadmap/Sprint Plan 2026.md',
      folderName: 'Q4 Roadmap',
      folderPath: 'Engineering/Q4 Roadmap',
      parentFolderName: 'Engineering',
      rootName: 'Product Hub',
      rootPath: '/Users/zeta/ProductHub',
      allRootNames: ['Product Hub', 'Docs'],
      gitBranch: 'feat/templates',
      gitStatus: 'Synced',
      userName: 'zeta',
      hostName: 'macbook-pro',
      osPlatform: 'macOS',
      cpuArch: 'arm64',
      appVersion: '1.1.0',
      locale: 'sv-SE'
    }

    const dynamicFileName = evaluateTemplateFileName(
      '<% date %>-<% folder_slug %>-Standup.md',
      ctx
    )
    expect(dynamicFileName).toBe('2026-10-17-q4-roadmap-Standup.md')

    const tpl = `# <% title %> in <% folder %> (<% root %>)
Date: <% date %> | Compact: <% date_compact %> | Plus7: <% date +7d %> | Custom: <% date:DD.MM.YYYY %>
Slugs: <% file_slug %> / <% folder_slug %> | Parent: <% parent_folder %>
Breadcrumbs: <% breadcrumbs %> | Roots (<% root_count %>): <% all_roots %>
User: <% user %>@<% host %> (<% os %> / <% arch %>)
Git: <% git_branch %> [<% git_status %>]
Range: <% random(42, 42) %>
Here: <% cursor %>End`

    const res = evaluateTemplateVariables(tpl, ctx)

    expect(res.output).toContain('# Sprint Plan 2026 in Q4 Roadmap (Product Hub)')
    expect(res.output).toContain(
      'Date: 2026-10-17 | Compact: 20261017 | Plus7: 2026-10-24 | Custom: 17.10.2026'
    )
    expect(res.output).toContain('Slugs: sprint-plan-2026 / q4-roadmap | Parent: Engineering')
    expect(res.output).toContain(
      'Breadcrumbs: Product Hub > Engineering > Q4 Roadmap | Roots (2): Product Hub, Docs'
    )
    expect(res.output).toContain('User: zeta@macbook-pro (macOS / arm64)')
    expect(res.output).toContain('Git: feat/templates [Synced]')
    expect(res.output).toContain('Range: 42')
    expect(res.output).toContain('Here: End')
    expect(res.output).not.toContain('<% cursor %>')
    expect(res.cursorOffset).toBe(res.output.indexOf('End'))
  })

  it('renders Untitled UI Free Icons (:icon[Name]:), searches the icon catalog, validates Saved Themes & 12 Highlight Colors, and evaluates Power-User dynamic variables', async () => {
    const {
      UNTITLED_ICON_CATALOG,
      searchUntitledIcons
    } = await import('../../renderer/components/icons/untitled-icons')
    const { renderUntitledIconSvgHtml } = await import(
      '../../shared/icons/untitled-icon-svg'
    )
    const {
      extractPowerTemplateExpressions,
      evaluateTemplateVariablesAsync
    } = await import('../../shared/templates/template-engine')
    const { PRESET_HIGHLIGHT_COLORS } = await import('../../shared/constants')
    const {
      SavedThemeSchema,
      AppSettingsSchema
    } = await import('../../shared/schemas')

    // 1. Untitled UI Free Icons catalog & inline :icon[Name]: rendering
    expect(UNTITLED_ICON_CATALOG.length).toBeGreaterThanOrEqual(90)
    const starMatches = searchUntitledIcons('sparkles')
    expect(starMatches.some((i) => i.id === 'Sparkles')).toBe(true)

    const svgHtml = renderUntitledIconSvgHtml('Sparkles')
    expect(svgHtml).toContain('<svg')
    expect(svgHtml).toContain('data-untitled-icon="Sparkles"')

    const renderedDoc = await renderMarkdownDocument(
      'Feature badge :icon[Sparkles]: and :icon[Rocket01]: inline.'
    )
    expect(renderedDoc.html).toContain('class="klartext-inline-icon-wrap"')
    expect(renderedDoc.html).toContain('class="klartext-inline-icon"')
    expect(renderedDoc.html).toContain('<svg viewBox="0 0 24 24"')

    // 2. 12 Pre-configured bright highlight colors + SavedThemeSchema validation
    expect(PRESET_HIGHLIGHT_COLORS).toHaveLength(12)
    const parsedTheme = SavedThemeSchema.parse({
      id: 'theme-nordic-aurora',
      name: 'Nordic Aurora',
      baseTheme: 'dark',
      lightPaperInDarkMode: false,
      highlightColor: '#3B82F6',
      colors: {
        bgApp: '#0F172A',
        bgPanel: '#1E293B',
        bgEditor: '#0F172A',
        textEditor: '#F8FAFC',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        accentPrimary: '#3B82F6',
        borderSubtle: '#334155'
      },
      createdAt: Date.now()
    })
    expect(parsedTheme.name).toBe('Nordic Aurora')
    const parsedSettings = AppSettingsSchema.parse({
      highlightColor: '#10B981',
      customHighlightColors: ['#FF00AA'],
      savedThemes: [parsedTheme],
      activeSavedThemeId: parsedTheme.id
    })
    expect(parsedSettings.highlightColor).toBe('#10B981')
    expect(parsedSettings.customHighlightColors).toEqual(['#FF00AA'])
    expect(parsedSettings.savedThemes).toHaveLength(1)

    // 3. Power-user dynamic variables extraction & async evaluation
    const powerTpl = `CLI: <% exec: echo "Klartext Power" %>
Script: <% sh: printf "ShellOK" %>
AppleScript: <% applescript: return "macOS Ready" %>
URL: <% url: https://api.example.local/status %>
JSON: <% json_url: https://api.example.local/meta | version %>
Env: <% env:KLARTEXT_UNIT_VAR %>
Sys: <% git_commit %> | <% uptime %> | <% cpu_cores %> cores`

    const exprs = extractPowerTemplateExpressions(powerTpl)
    expect(exprs).toEqual([
      'exec: echo "Klartext Power"',
      'sh: printf "ShellOK"',
      'applescript: return "macOS Ready"',
      'url: https://api.example.local/status',
      'json_url: https://api.example.local/meta | version',
      'env:KLARTEXT_UNIT_VAR',
      'git_commit',
      'uptime',
      'cpu_cores'
    ])

    const asyncEval = await evaluateTemplateVariablesAsync(
      powerTpl,
      {
        gitCommit: 'a1b2c3d',
        uptime: '4d 12h',
        cpuCores: 12
      },
      async (requested) => {
        const out: Record<string, string> = {}
        for (const k of requested) {
          if (k.startsWith('exec:')) out[k] = 'Klartext Power'
          else if (k.startsWith('sh:')) out[k] = 'ShellOK'
          else if (k.startsWith('applescript:')) out[k] = 'macOS Ready'
          else if (k.startsWith('url:')) out[k] = '200 OK'
          else if (k.startsWith('json_url:')) out[k] = '2.4.0'
          else if (k === 'env:KLARTEXT_UNIT_VAR') out[k] = 'production'
        }
        return out
      }
    )

    expect(asyncEval.output).toContain('CLI: Klartext Power')
    expect(asyncEval.output).toContain('Script: ShellOK')
    expect(asyncEval.output).toContain('AppleScript: macOS Ready')
    expect(asyncEval.output).toContain('URL: 200 OK')
    expect(asyncEval.output).toContain('JSON: 2.4.0')
    expect(asyncEval.output).toContain('Env: production')
    expect(asyncEval.output).toContain('Sys: a1b2c3d | 4d 12h | 12 cores')
  })

  it('sorts workspace tree nodes by Name A-Z, Name Z-A, Custom Order, Folders on Top, and Sticky items (folders first then files, stickies sorted A-Z)', async () => {
    const {
      sortWorkspaceTreeNodes,
      isWorkspaceItemSticky
    } = await import('../../renderer/features/workspace/MultiRootSidebar')

    const sampleNodes = [
      { name: 'Beta-Folder', relativePath: 'Beta-Folder', rootId: 'r1', isDirectory: true },
      { name: 'Alpha-Folder', relativePath: 'Alpha-Folder', rootId: 'r1', isDirectory: true },
      { name: 'Zeta-Folder', relativePath: 'Zeta-Folder', rootId: 'r1', isDirectory: true },
      { name: 'charlie.md', relativePath: 'charlie.md', rootId: 'r1', isDirectory: false },
      { name: 'alpha.md', relativePath: 'alpha.md', rootId: 'r1', isDirectory: false },
      { name: 'omega.md', relativePath: 'omega.md', rootId: 'r1', isDirectory: false }
    ]

    // 1. Default Name A-Z with Folders on Top
    const sortedAsc = sortWorkspaceTreeNodes('r1', '', sampleNodes, {
      sortOrder: 'name-asc',
      foldersOnTop: true
    })
    expect(sortedAsc.map((n) => n.name)).toEqual([
      'Alpha-Folder',
      'Beta-Folder',
      'Zeta-Folder',
      'alpha.md',
      'charlie.md',
      'omega.md'
    ])

    // 2. Name Z-A with Folders on Top
    const sortedDesc = sortWorkspaceTreeNodes('r1', '', sampleNodes, {
      sortOrder: 'name-desc',
      foldersOnTop: true
    })
    expect(sortedDesc.map((n) => n.name)).toEqual([
      'Zeta-Folder',
      'Beta-Folder',
      'Alpha-Folder',
      'omega.md',
      'charlie.md',
      'alpha.md'
    ])

    // 3. Name A-Z with Folders on Top UNCHECKED (interleaved folders & files)
    const sortedInterleaved = sortWorkspaceTreeNodes('r1', '', sampleNodes, {
      sortOrder: 'name-asc',
      foldersOnTop: false
    })
    expect(sortedInterleaved.map((n) => n.name)).toEqual([
      'Alpha-Folder',
      'alpha.md',
      'Beta-Folder',
      'charlie.md',
      'omega.md',
      'Zeta-Folder'
    ])

    // 4. Custom Sort Order with Folders on Top
    const sortedCustom = sortWorkspaceTreeNodes('r1', '', sampleNodes, {
      sortOrder: 'custom',
      foldersOnTop: true,
      customOrder: {
        'r1/': ['Zeta-Folder', 'Alpha-Folder', 'Beta-Folder', 'omega.md', 'alpha.md', 'charlie.md']
      }
    })
    expect(sortedCustom.map((n) => n.name)).toEqual([
      'Zeta-Folder',
      'Alpha-Folder',
      'Beta-Folder',
      'omega.md',
      'alpha.md',
      'charlie.md'
    ])

    // 5. Sticky items: Sticky folders first (sorted A-Z), then Sticky files (sorted A-Z), even when non-sticky sort is Z-A and foldersOnTop is false
    const stickyMap = {
      'r1/Zeta-Folder': true,
      'r1/Beta-Folder': true,
      'r1/omega.md': true,
      'r1/charlie.md': true
    }
    expect(isWorkspaceItemSticky('r1', 'Zeta-Folder', stickyMap)).toBe(true)
    const sortedWithStickies = sortWorkspaceTreeNodes('r1', '', sampleNodes, {
      sortOrder: 'name-desc',
      foldersOnTop: false,
      stickyItems: stickyMap
    })
    expect(sortedWithStickies.map((n) => n.name)).toEqual([
      // Sticky folders sorted A-Z
      'Beta-Folder',
      'Zeta-Folder',
      // Sticky files sorted A-Z
      'charlie.md',
      'omega.md',
      // Remaining non-sticky items sorted Z-A (alpha.md > Alpha-Folder)
      'alpha.md',
      'Alpha-Folder'
    ])
  })

  it('includes IT Security, Meetings, and Engineering built-in templates and validates Frontmatter Property schemas', async () => {
    const { DEFAULT_BUILT_IN_TEMPLATES } = await import('../../shared/templates/template-engine')
    const { AppSettingsSchema } = await import('../../shared/schemas')

    const templateIds = DEFAULT_BUILT_IN_TEMPLATES.map((t) => t.id)
    expect(templateIds).toContain('tpl-sec-incident')
    expect(templateIds).toContain('tpl-sec-pentest')
    expect(templateIds).toContain('tpl-sec-threat-model')
    expect(templateIds).toContain('tpl-sec-hardening')
    expect(templateIds).toContain('tpl-meeting-1on1')
    expect(templateIds).toContain('tpl-meeting-sprint')
    expect(templateIds).toContain('tpl-meeting-executive')
    expect(templateIds).toContain('tpl-adr')
    expect(templateIds).toContain('tpl-postmortem')
    expect(templateIds).toContain('tpl-release-runbook')

    const parsedSettings = AppSettingsSchema.parse({
      frontmatterStatusOptions: ['Draft', 'In Progress', 'Approved', 'Security Verified'],
      frontmatterKnownTags: ['security', 'soc', 'pentest', 'meeting'],
      globalFrontmatterProperties: [
        { key: 'review_date', type: 'date', options: [] },
        { key: 'classification', type: 'dropdown', options: ['TLP:CLEAR', 'TLP:AMBER', 'TLP:RED'] }
      ]
    })
    expect(parsedSettings.frontmatterStatusOptions).toContain('Security Verified')
    expect(parsedSettings.globalFrontmatterProperties).toHaveLength(2)
    expect(parsedSettings.globalFrontmatterProperties[0].type).toBe('date')
    expect(parsedSettings.globalFrontmatterProperties[1].options).toContain('TLP:AMBER')
  })

  it('rewrites Swedish and English text cleanly without strikethroughs and fixes Swedish särskrivningar', async () => {
    const {
      generateBuiltInBilingualFallback,
      isLikelySwedishText
    } = await import('../../main/ai/bilingual-fallback')
    const { sanitizeAndCleanAIOutput } = await import('../../main/ai/prompts')

    const swInput =
      '---\ntitle: Rapport\n---\nvi behöver kolla på våran användar gränssnitt och informations säkerhet i dagsläget'
    expect(isLikelySwedishText(swInput)).toBe(true)

    const rewrittenSv = generateBuiltInBilingualFallback({
      action: 'improve',
      prompt: 'Skriv om texten',
      selectedText: swInput
    })
    expect(rewrittenSv).toContain('title: Rapport')
    expect(rewrittenSv).toContain('användargränssnitt')
    expect(rewrittenSv).toContain('informationssäkerhet')
    expect(rewrittenSv).toContain('granska')
    expect(rewrittenSv).toContain('för närvarande')
    expect(rewrittenSv).not.toContain('~~')

    // Ensure accidental whole-block ~~strikethrough~~ from an LLM is unwrapped cleanly
    const accidentalStrike = '~~Detta är en omskriven svensk text utan genomstrykning.~~'
    expect(sanitizeAndCleanAIOutput(accidentalStrike)).toBe(
      'Detta är en omskriven svensk text utan genomstrykning.'
    )
  })

  it('includes 6 sober Nordic saved themes (3 dark and 3 light) with distinct fonts and colors', async () => {
    const { DEFAULT_NORDIC_SAVED_THEMES } = await import('../../shared/constants')
    const { AppSettingsSchema } = await import('../../shared/schemas')

    expect(DEFAULT_NORDIC_SAVED_THEMES).toHaveLength(6)
    const darkThemes = DEFAULT_NORDIC_SAVED_THEMES.filter((t) => t.baseMode === 'dark')
    const lightThemes = DEFAULT_NORDIC_SAVED_THEMES.filter((t) => t.baseMode === 'light')
    expect(darkThemes).toHaveLength(3)
    expect(lightThemes).toHaveLength(3)

    for (const theme of DEFAULT_NORDIC_SAVED_THEMES) {
      expect(theme.customColors?.bgApp).toBeTruthy()
      expect(theme.customColors?.bgEditor).toBeTruthy()
      expect(theme.customColors?.textPrimary).toBeTruthy()
      expect(theme.typography?.bodyFontFamily).toBeTruthy()
      expect(theme.typography?.monoFontFamily).toBeTruthy()
    }

    const parsed = AppSettingsSchema.parse({})
    expect(parsed.savedThemes.length).toBeGreaterThanOrEqual(6)
  })

  it('filters documents in Dynamic Workspaces and Dynamic Folders using wildcards, #tag syntax (#tag1, #tag2 or #tag1 Tag2), and all frontmatter properties', async () => {
    const {
      matchesDynamicFilterRule,
      matchWildcardPattern,
      parseTagListInput,
      formatTagWithHash
    } = await import('../../shared/markdown/dynamic-workspace')

    expect(formatTagWithHash('tag1')).toBe('#tag1')
    expect(formatTagWithHash('#tag1')).toBe('#tag1')
    expect(parseTagListInput('#tag1, #tag2')).toEqual(['#tag1', '#tag2'])
    expect(parseTagListInput('#tag1 Tag2')).toEqual(['#tag1', '#Tag2'])
    expect(parseTagListInput('tag1, tag2')).toEqual(['#tag1', '#tag2'])

    expect(matchWildcardPattern('sec-incident-2026', 'sec-*')).toBe(true)
    expect(matchWildcardPattern('sec-incident-2026', '*2026')).toBe(true)
    expect(matchWildcardPattern('sec-incident-2026', 'rfc-*')).toBe(false)

    const sampleDocs = [
      {
        rootId: 'r1',
        rootName: 'SecOps',
        relativePath: 'incidents/inc-01.md',
        name: 'inc-01.md',
        content: [
          '---',
          'title: Firewall Breach Analysis',
          'date: 2026-10-15',
          'author: Alice Lindqvist',
          'status: In Progress',
          'tags: ["#security", "#incident-p1", "#soc"]',
          'tlp: TLP:AMBER+STRICT',
          'severity: P1-Critical',
          '---',
          '# Firewall Breach Analysis',
          'Details here.'
        ].join('\n')
      },
      {
        rootId: 'r2',
        rootName: 'Product',
        relativePath: 'roadmap-2026.md',
        name: 'roadmap-2026.md',
        content: [
          '---',
          'title: Q4 Architecture Roadmap',
          'date: 2026-11-01',
          'author: Erik Sjöberg',
          'status: Approved',
          'tags: ["#architecture", "#planning"]',
          'tlp: TLP:CLEAR',
          '---',
          '# Q4 Architecture Roadmap'
        ].join('\n')
      }
    ]

    // Wildcard tag (#tag1, #tag2 or #tag1 Tag2) + date range + custom frontmatter property
    const secRule = {
      tagsPattern: '#inc* soc',
      titlePattern: '*Breach*',
      authorPattern: 'Alice*',
      statusPattern: '*Progress*',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      customFrontmatterFilters: [
        { key: 'tlp', valuePattern: 'TLP:AMBER*' },
        { key: 'sev*', valuePattern: 'P1*' }
      ]
    }

    expect(matchesDynamicFilterRule(sampleDocs[0], secRule)).toBe(true)
    expect(matchesDynamicFilterRule(sampleDocs[1], secRule)).toBe(false)
  })
})





