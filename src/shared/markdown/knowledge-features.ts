import {
  extractFrontmatter,
  extractWikiLinks,
  formatAllTablesInMarkdown
} from './pipeline'
import { parseTagListInput } from './dynamic-workspace'

export interface WorkspaceDocEntry {
  rootId: string
  rootName: string
  relativePath: string
  name: string
  title: string
  content: string
  tags?: string[]
}

function parseGfmTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

// ============================================================================
// 1.1 Knowledge Graph (Global & Local 2D Force-Layout Graph)
// ============================================================================

export interface KnowledgeGraphNode {
  id: string
  label: string
  type: 'document' | 'tag'
  rootId?: string
  rootName?: string
  relativePath?: string
  degree: number
  x: number
  y: number
}

export interface KnowledgeGraphEdge {
  id: string
  source: string
  target: string
  kind: 'wikilink' | 'tag'
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

export function buildKnowledgeGraph(params: {
  documents: WorkspaceDocEntry[]
  includeTags?: boolean
  mode?: 'global' | 'local'
  activeDocKey?: string | null
  searchQuery?: string
}): KnowledgeGraphData {
  const {
    documents,
    includeTags = true,
    mode = 'global',
    activeDocKey = null,
    searchQuery = ''
  } = params

  const nodeMap = new Map<string, Omit<KnowledgeGraphNode, 'x' | 'y'>>()
  const edges: KnowledgeGraphEdge[] = []
  const edgeSet = new Set<string>()

  // Index documents by key and normalized basename
  const docByBaseName = new Map<string, string>()
  for (const doc of documents) {
    const key = `${doc.rootId}::${doc.relativePath}`
    const baseName = doc.name.replace(/\.(md|markdown)$/i, '')
    docByBaseName.set(baseName.toLowerCase(), key)
    docByBaseName.set(doc.relativePath.toLowerCase(), key)
    docByBaseName.set(doc.relativePath.replace(/\.(md|markdown)$/i, '').toLowerCase(), key)

    nodeMap.set(key, {
      id: key,
      label: baseName,
      type: 'document',
      rootId: doc.rootId,
      rootName: doc.rootName,
      relativePath: doc.relativePath,
      degree: 0
    })
  }

  for (const doc of documents) {
    const sourceKey = `${doc.rootId}::${doc.relativePath}`
    // Extract WikiLinks
    const links = extractWikiLinks(doc.content)
    for (const link of links) {
      const targetClean = link.target.split('#')[0].trim()
      if (!targetClean) continue
      const targetKey =
        docByBaseName.get(targetClean.toLowerCase()) ||
        docByBaseName.get(targetClean.replace(/\.(md|markdown)$/i, '').toLowerCase())

      if (targetKey && targetKey !== sourceKey && nodeMap.has(targetKey)) {
        const edgeId = `wl::${sourceKey}->${targetKey}`
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId)
          edges.push({
            id: edgeId,
            source: sourceKey,
            target: targetKey,
            kind: 'wikilink'
          })
          nodeMap.get(sourceKey)!.degree += 1
          nodeMap.get(targetKey)!.degree += 1
        }
      }
    }

    // Extract Frontmatter & inline tags if enabled
    if (includeTags) {
      const { frontmatter } = extractFrontmatter(doc.content)
      const rawTags = frontmatter?.tags
      const docTags = Array.isArray(rawTags)
        ? rawTags.flatMap((t) => parseTagListInput(String(t ?? '')))
        : typeof rawTags === 'string'
          ? parseTagListInput(rawTags)
          : []

      for (const tag of docTags) {
        const tagNodeId = `tag::${tag.toLowerCase()}`
        if (!nodeMap.has(tagNodeId)) {
          nodeMap.set(tagNodeId, {
            id: tagNodeId,
            label: tag,
            type: 'tag',
            degree: 0
          })
        }
        const edgeId = `tag::${sourceKey}->${tagNodeId}`
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId)
          edges.push({
            id: edgeId,
            source: sourceKey,
            target: tagNodeId,
            kind: 'tag'
          })
          nodeMap.get(sourceKey)!.degree += 1
          nodeMap.get(tagNodeId)!.degree += 1
        }
      }
    }
  }

  // Filter for Local Graph (active document + 1-hop & 2-hop neighbors)
  let allowedNodeIds = new Set<string>(nodeMap.keys())
  if (mode === 'local' && activeDocKey && nodeMap.has(activeDocKey)) {
    const localSet = new Set<string>([activeDocKey])
    // 1-hop
    for (const edge of edges) {
      if (edge.source === activeDocKey) localSet.add(edge.target)
      if (edge.target === activeDocKey) localSet.add(edge.source)
    }
    // 2-hop (via documents)
    const hop1 = Array.from(localSet)
    for (const edge of edges) {
      if (hop1.includes(edge.source)) localSet.add(edge.target)
      if (hop1.includes(edge.target)) localSet.add(edge.source)
    }
    allowedNodeIds = localSet
  }

  // Filter by search query if provided
  const q = searchQuery.trim().toLowerCase()
  if (q) {
    const matchedIds = new Set<string>()
    for (const [id, node] of nodeMap.entries()) {
      if (!allowedNodeIds.has(id)) continue
      if (
        node.label.toLowerCase().includes(q) ||
        (node.relativePath && node.relativePath.toLowerCase().includes(q))
      ) {
        matchedIds.add(id)
      }
    }
    // Also keep direct neighbors of matched nodes for context
    for (const edge of edges) {
      if (matchedIds.has(edge.source) && allowedNodeIds.has(edge.target)) {
        matchedIds.add(edge.target)
      }
      if (matchedIds.has(edge.target) && allowedNodeIds.has(edge.source)) {
        matchedIds.add(edge.source)
      }
    }
    allowedNodeIds = matchedIds
  }

  const filteredNodesList = Array.from(nodeMap.values()).filter((n) => allowedNodeIds.has(n.id))
  const filteredEdges = edges.filter(
    (e) => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target)
  )

  // Deterministic radial + force-inspired 2D layout centered at (450, 280)
  const centerX = 450
  const centerY = 280
  const positionedNodes: KnowledgeGraphNode[] = filteredNodesList.map((n, idx) => {
    if (n.id === activeDocKey) {
      return { ...n, x: centerX, y: centerY }
    }
    const total = Math.max(1, filteredNodesList.length)
    const angle = (idx / total) * Math.PI * 2
    const ringRadius = n.type === 'tag' ? 210 : 145 + (idx % 3) * 42
    return {
      ...n,
      x: Math.round(centerX + Math.cos(angle) * ringRadius),
      y: Math.round(centerY + Math.sin(angle) * ringRadius)
    }
  })

  // Perform 35 iterations of lightweight spring-repulsion relaxation for clean spacing
  const posById = new Map<string, { x: number; y: number }>()
  for (const n of positionedNodes) {
    posById.set(n.id, { x: n.x, y: n.y })
  }

  for (let iter = 0; iter < 35; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const a = positionedNodes[i]
        const b = positionedNodes[j]
        const pa = posById.get(a.id)!
        const pb = posById.get(b.id)!
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const distSq = Math.max(100, dx * dx + dy * dy)
        const dist = Math.sqrt(distSq)
        const force = 2600 / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        if (a.id !== activeDocKey) {
          pa.x -= fx
          pa.y -= fy
        }
        if (b.id !== activeDocKey) {
          pb.x += fx
          pb.y += fy
        }
      }
    }
    // Attraction along edges
    for (const edge of filteredEdges) {
      const pa = posById.get(edge.source)
      const pb = posById.get(edge.target)
      if (!pa || !pb) continue
      const dx = pb.x - pa.x
      const dy = pb.y - pa.y
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const targetDist = edge.kind === 'tag' ? 130 : 110
      const delta = (dist - targetDist) * 0.045
      const fx = (dx / dist) * delta
      const fy = (dy / dist) * delta
      if (edge.source !== activeDocKey) {
        pa.x += fx
        pa.y += fy
      }
      if (edge.target !== activeDocKey) {
        pb.x -= fx
        pb.y -= fy
      }
    }
    // Gentle gravity toward center
    for (const n of positionedNodes) {
      if (n.id === activeDocKey) continue
      const p = posById.get(n.id)!
      p.x += (centerX - p.x) * 0.02
      p.y += (centerY - p.y) * 0.02
      p.x = Math.max(60, Math.min(840, p.x))
      p.y = Math.max(50, Math.min(510, p.y))
    }
  }

  return {
    nodes: positionedNodes.map((n) => {
      const p = posById.get(n.id)!
      return {
        ...n,
        x: Math.round(p.x),
        y: Math.round(p.y)
      }
    }),
    edges: filteredEdges
  }
}

// ============================================================================
// 1.2 Note Transclusion (`![[Note]]` and `![[Note#Heading]]`) & Hover Preview
// ============================================================================

export function extractHeadingSectionFromMarkdown(
  markdownBody: string,
  headingQuery: string
): string {
  const lines = markdownBody.split(/\r?\n/)
  const targetLower = headingQuery.trim().toLowerCase()
  let capturing = false
  let captureDepth = 0
  const capturedLines: string[] = []

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (m) {
      const depth = m[1].length
      const headingText = m[2].replace(/[#*`~[\]]/g, '').trim().toLowerCase()
      if (!capturing) {
        if (headingText === targetLower || headingText.includes(targetLower)) {
          capturing = true
          captureDepth = depth
          capturedLines.push(line)
          continue
        }
      } else if (depth <= captureDepth) {
        break
      }
    }
    if (capturing) {
      capturedLines.push(line)
    }
  }

  return capturedLines.length > 0 ? capturedLines.join('\n').trim() : markdownBody.trim()
}

export function resolveTransclusionsInMarkdown(
  markdown: string,
  documents: WorkspaceDocEntry[],
  depth = 0
): string {
  if (depth > 2 || !markdown.includes('![[')) return markdown

  // Replace ![[Target]] or ![[Target#Heading]] or ![[Target|Alias]] outside code fences
  const lines = markdown.split(/\r?\n/)
  let inCodeFence = false
  const outLines: string[] = []

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      outLines.push(line)
      continue
    }
    if (inCodeFence || !line.includes('![[')) {
      outLines.push(line)
      continue
    }

    const replaced = line.replace(
      /!\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g,
      (_full, rawTarget: string, rawAlias?: string) => {
        const [filePartRaw, headingPartRaw] = rawTarget.split('#')
        const colonIdx = filePartRaw.indexOf(':')
        const explicitRoot = colonIdx > 0 ? filePartRaw.slice(0, colonIdx).trim() : null
        const targetName = (colonIdx > 0 ? filePartRaw.slice(colonIdx + 1) : filePartRaw)
          .trim()
          .replace(/\.(md|markdown)$/i, '')

        // Do not transclude image assets (those are handled as images)
        if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|pdf)$/i.test(filePartRaw.trim())) {
          return _full
        }

        const matchedDoc = documents.find((doc) => {
          if (explicitRoot && doc.rootName.toLowerCase() !== explicitRoot.toLowerCase()) {
            return false
          }
          const docBase = doc.name.replace(/\.(md|markdown)$/i, '').toLowerCase()
          const relBase = doc.relativePath.replace(/\.(md|markdown)$/i, '').toLowerCase()
          return (
            docBase === targetName.toLowerCase() || relBase === targetName.toLowerCase()
          )
        })

        if (!matchedDoc) {
          return `> **[Transcluded Note Not Found: ${rawTarget.trim()}]**`
        }

        const { body } = extractFrontmatter(matchedDoc.content)
        const sectionBody = headingPartRaw
          ? extractHeadingSectionFromMarkdown(body, headingPartRaw)
          : body.trim()

        const nestedResolved = resolveTransclusionsInMarkdown(
          sectionBody,
          documents,
          depth + 1
        )
        const headerLabel =
          rawAlias?.trim() ||
          (headingPartRaw
            ? `${matchedDoc.name.replace(/\.md$/i, '')} › ${headingPartRaw.trim()}`
            : matchedDoc.name.replace(/\.md$/i, ''))

        const quotedBody = nestedResolved
          .split(/\r?\n/)
          .map((l) => `> ${l}`)
          .join('\n')

        return `\n> [!NOTE] Embedded: [[${matchedDoc.name.replace(/\.md$/i, '')}|${headerLabel}]]\n${quotedBody}\n`
      }
    )
    outLines.push(replaced)
  }

  return outLines.join('\n')
}

// ============================================================================
// 1.3 Unlinked Mentions & Automatic WikiLink Refactoring on Rename
// ============================================================================

export interface UnlinkedMentionItem {
  sourceRootId: string
  sourceRootName: string
  sourceRelativePath: string
  lineNumber: number
  excerpt: string
  matchedTitle: string
}

export function findUnlinkedMentions(params: {
  activeDocTitle: string
  activeRootId: string
  activeRelativePath: string
  documents: WorkspaceDocEntry[]
}): UnlinkedMentionItem[] {
  const cleanTitle = params.activeDocTitle.replace(/\.(md|markdown)$/i, '').trim()
  if (cleanTitle.length < 3) return []

  const escapedTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wordBoundaryRegex = new RegExp(`\\b(${escapedTitle})\\b`, 'i')
  const results: UnlinkedMentionItem[] = []

  for (const doc of params.documents) {
    if (
      doc.rootId === params.activeRootId &&
      doc.relativePath === params.activeRelativePath
    ) {
      continue
    }

    const lines = doc.content.split(/\r?\n/)
    let inFrontmatter = false
    let inCodeFence = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (i === 0 && line.trim() === '---') {
        inFrontmatter = true
        continue
      }
      if (inFrontmatter) {
        if (line.trim() === '---') inFrontmatter = false
        continue
      }
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence
        continue
      }
      if (inCodeFence) continue

      // Strip existing [[...]] and [text](url) from the line before testing for unlinked mention
      const strippedLine = line
        .replace(/!?\[\[[^\]]*\]\]/g, (m) => ' '.repeat(m.length))
        .replace(/!?\[[^\]]*\]\([^)]*\)/g, (m) => ' '.repeat(m.length))

      const match = wordBoundaryRegex.exec(strippedLine)
      if (match) {
        results.push({
          sourceRootId: doc.rootId,
          sourceRootName: doc.rootName,
          sourceRelativePath: doc.relativePath,
          lineNumber: i + 1,
          excerpt: line.trim(),
          matchedTitle: cleanTitle
        })
      }
    }
  }

  return results
}

export function linkUnlinkedMentionInContent(
  content: string,
  lineNumber1Based: number,
  targetDocTitle: string
): string {
  const cleanTitle = targetDocTitle.replace(/\.(md|markdown)$/i, '').trim()
  if (!cleanTitle) return content
  const lines = content.split(/\r?\n/)
  const idx = lineNumber1Based - 1
  if (idx < 0 || idx >= lines.length) return content

  const escaped = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Replace first plain-text occurrence not already inside [[...]]
  const line = lines[idx]
  const regex = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'i')
  lines[idx] = line.replace(regex, `[[${cleanTitle}]]`)
  return lines.join('\n')
}

export function refactorWikiLinksOnRename(
  content: string,
  oldRelativePath: string,
  newRelativePath: string
): { nextContent: string; changed: boolean } {
  const oldBase = (oldRelativePath.split('/').pop() || oldRelativePath).replace(
    /\.(md|markdown)$/i,
    ''
  )
  const newBase = (newRelativePath.split('/').pop() || newRelativePath).replace(
    /\.(md|markdown)$/i,
    ''
  )
  if (!oldBase || !newBase || oldBase === newBase) {
    return { nextContent: content, changed: false }
  }

  let changed = false
  const nextContent = content.replace(
    /(!?\[\[)([^[\]|#]+)(#[^[\]|]+)?(\|[^[\]]+)?(\]\])/g,
    (full, open: string, rawTarget: string, hashPart = '', aliasPart = '', close: string) => {
      const colonIdx = rawTarget.indexOf(':')
      const rootPrefix = colonIdx > 0 ? `${rawTarget.slice(0, colonIdx + 1)}` : ''
      const targetPart = (colonIdx > 0 ? rawTarget.slice(colonIdx + 1) : rawTarget).trim()
      const targetBase = targetPart.replace(/\.(md|markdown)$/i, '')

      if (
        targetBase.toLowerCase() === oldBase.toLowerCase() ||
        targetPart.toLowerCase() === oldRelativePath.toLowerCase()
      ) {
        changed = true
        return `${open}${rootPrefix}${newBase}${hashPart}${aliasPart}${close}`
      }
      return full
    }
  )

  return { nextContent, changed }
}

// ============================================================================
// 2.2 Interactive Table Editor (Spreadsheet-like Row/Col/Align/Sort Operations)
// ============================================================================

export type InteractiveTableAction =
  | 'add-row-below'
  | 'add-row-above'
  | 'delete-row'
  | 'add-col-right'
  | 'add-col-left'
  | 'delete-col'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'sort-asc'
  | 'sort-desc'

export type TableManipulationAction = InteractiveTableAction

export interface DetectedMarkdownTable {
  startLine0: number
  endLine0: number
  cursorRowOffset: number
  cursorColIndex: number
  activeRowIndex: number
  activeColIndex: number
  colCount: number
  rowCount: number
}

const SEPARATOR_ROW_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/

export function detectMarkdownTableAtPosition(
  markdown: string,
  cursorOffset: number
): DetectedMarkdownTable | null {
  const lines = markdown.split(/\r?\n/)
  let charAccum = 0
  let cursorLine0 = 0
  let cursorColChar = 0

  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length
    if (cursorOffset <= charAccum + lineLen) {
      cursorLine0 = i
      cursorColChar = cursorOffset - charAccum
      break
    }
    charAccum += lineLen + 1
  }

  const currentLine = lines[cursorLine0] || ''
  if (!currentLine.includes('|')) return null

  let startLine0 = cursorLine0
  while (startLine0 > 0 && lines[startLine0 - 1].includes('|')) {
    startLine0--
  }
  let endLine0 = cursorLine0
  while (endLine0 + 1 < lines.length && lines[endLine0 + 1].includes('|')) {
    endLine0++
  }

  if (endLine0 - startLine0 < 1) return null
  if (!SEPARATOR_ROW_RE.test(lines[startLine0 + 1])) return null

  const headerCells = parseGfmTableRow(lines[startLine0])
  const colCount = Math.max(1, headerCells.length)
  const rowCount = endLine0 - startLine0 + 1

  // Determine which column index the cursor is in by counting '|' before cursorColChar
  const prefix = currentLine.slice(0, cursorColChar)
  const pipeMatches = prefix.match(/\|/g)
  const rawPipeCount = pipeMatches ? pipeMatches.length : 0
  const startsWithPipe = currentLine.trimStart().startsWith('|')
  const cursorColIndex = Math.max(
    0,
    Math.min(colCount - 1, startsWithPipe ? rawPipeCount - 1 : rawPipeCount)
  )

  return {
    startLine0,
    endLine0,
    cursorRowOffset: cursorLine0 - startLine0,
    cursorColIndex,
    activeRowIndex: cursorLine0 - startLine0,
    activeColIndex: cursorColIndex,
    colCount,
    rowCount
  }
}

export function manipulateMarkdownTable(
  markdown: string,
  cursorOffset: number,
  action: InteractiveTableAction
): string {
  const detected = detectMarkdownTableAtPosition(markdown, cursorOffset)
  if (!detected) return markdown

  const lines = markdown.split(/\r?\n/)
  const tableLines = lines.slice(detected.startLine0, detected.endLine0 + 1)
  const rows = tableLines.map((l) => parseGfmTableRow(l))
  const colCount = detected.colCount
  const normalizedRows = rows.map((r) => {
    const copy = [...r]
    while (copy.length < colCount) copy.push('')
    return copy.slice(0, colCount)
  })

  const targetRow = detected.cursorRowOffset
  const targetCol = detected.cursorColIndex

  if (action === 'add-row-below') {
    const insertIdx = Math.max(2, targetRow + 1)
    const emptyRow = Array.from({ length: colCount }, () => '   ')
    normalizedRows.splice(insertIdx, 0, emptyRow)
  } else if (action === 'add-row-above') {
    const insertIdx = Math.max(2, targetRow)
    const emptyRow = Array.from({ length: colCount }, () => '   ')
    normalizedRows.splice(insertIdx, 0, emptyRow)
  } else if (action === 'delete-row') {
    if (targetRow >= 2 && normalizedRows.length > 3) {
      normalizedRows.splice(targetRow, 1)
    } else if (normalizedRows.length > 3) {
      normalizedRows.splice(normalizedRows.length - 1, 1)
    }
  } else if (action === 'add-col-right' || action === 'add-col-left') {
    const insertCol = action === 'add-col-right' ? targetCol + 1 : targetCol
    normalizedRows.forEach((row, rIdx) => {
      if (rIdx === 0) row.splice(insertCol, 0, `Column ${insertCol + 1}`)
      else if (rIdx === 1) row.splice(insertCol, 0, '---')
      else row.splice(insertCol, 0, '')
    })
  } else if (action === 'delete-col') {
    if (colCount > 1) {
      normalizedRows.forEach((row) => {
        row.splice(targetCol, 1)
      })
    }
  } else if (
    action === 'align-left' ||
    action === 'align-center' ||
    action === 'align-right'
  ) {
    const marker =
      action === 'align-center' ? ':---:' : action === 'align-right' ? '---:' : ':---'
    normalizedRows[1][targetCol] = marker
  } else if (action === 'sort-asc' || action === 'sort-desc') {
    const bodyRows = normalizedRows.slice(2)
    bodyRows.sort((a, b) => {
      const va = (a[targetCol] || '').trim()
      const vb = (b[targetCol] || '').trim()
      const na = Number(va)
      const nb = Number(vb)
      if (!Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '') {
        return action === 'sort-asc' ? na - nb : nb - na
      }
      return action === 'sort-asc'
        ? va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
        : vb.localeCompare(va, undefined, { numeric: true, sensitivity: 'base' })
    })
    normalizedRows.splice(2, bodyRows.length, ...bodyRows)
  }

  const rebuiltTableLines = normalizedRows.map((row) => `| ${row.join(' | ')} |`)
  const updatedLines = [
    ...lines.slice(0, detected.startLine0),
    ...rebuiltTableLines,
    ...lines.slice(detected.endLine0 + 1)
  ]
  return formatAllTablesInMarkdown(updatedLines.join('\n'))
}

// ============================================================================
// 3.2 Global Task Aggregation (`- [ ]` and `- [x]` across all roots)
// ============================================================================

export interface GlobalTaskItem {
  id: string
  rootId: string
  rootName: string
  relativePath: string
  docName: string
  lineNumber: number
  checked: boolean
  text: string
  tags: string[]
}

export function extractGlobalTasks(documents: WorkspaceDocEntry[]): GlobalTaskItem[] {
  const tasks: GlobalTaskItem[] = []
  for (const doc of documents) {
    const lines = doc.content.split(/\r?\n/)
    let inCodeFence = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence
        continue
      }
      if (inCodeFence) continue

      const m = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/)
      if (m) {
        const checked = m[1].toLowerCase() === 'x'
        const rawText = m[2].trim()
        const tagMatches = rawText.match(/#[a-zA-Z0-9_-]+/g) || []
        tasks.push({
          id: `${doc.rootId}::${doc.relativePath}::${i + 1}`,
          rootId: doc.rootId,
          rootName: doc.rootName,
          relativePath: doc.relativePath,
          docName: doc.name.replace(/\.(md|markdown)$/i, ''),
          lineNumber: i + 1,
          checked,
          text: rawText,
          tags: tagMatches
        })
      }
    }
  }
  return tasks
}

export function toggleTaskAtLineInMarkdown(
  content: string,
  lineNumber1Based: number
): string {
  const lines = content.split(/\r?\n/)
  const idx = lineNumber1Based - 1
  if (idx < 0 || idx >= lines.length) return content

  lines[idx] = lines[idx].replace(
    /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/,
    (_full, prefix: string, state: string, suffix: string) => {
      const nextState = state.toLowerCase() === 'x' ? ' ' : 'x'
      return `${prefix}${nextState}${suffix}`
    }
  )
  return lines.join('\n')
}
