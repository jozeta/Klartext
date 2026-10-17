import React, { useState } from 'react'

export interface PaletteItemDef {
  id: string
  label: string
  badge: string
  defaultPayload: string
}

export const DIAGRAM_PALETTE_ITEMS: Record<string, PaletteItemDef[]> = {
  sequence: [
    { id: 'seq-actor', label: '+ Actor', badge: '🧑', defaultPayload: 'actor' },
    { id: 'seq-participant', label: '+ Service / Participant', badge: '🖥️', defaultPayload: 'participant' },
    { id: 'seq-call', label: '+ Request Call (->>)', badge: '→', defaultPayload: 'call' },
    { id: 'seq-reply', label: '+ Reply (-->>)', badge: '⇠', defaultPayload: 'reply' },
    { id: 'seq-note', label: '+ Note Block', badge: '📝', defaultPayload: 'note' }
  ],
  kanban: [
    { id: 'kb-col', label: '+ Kanban Column', badge: '📋', defaultPayload: 'column' },
    { id: 'kb-card-high', label: '+ High Priority Task', badge: '🔥', defaultPayload: 'card-high' },
    { id: 'kb-card-normal', label: '+ Normal Task', badge: '✓', defaultPayload: 'card-normal' }
  ],
  er: [
    { id: 'er-entity', label: '+ Entity Table', badge: '🗃️', defaultPayload: 'entity' },
    { id: 'er-rel-1n', label: '+ 1-to-Many (||--o{)', badge: '1:N', defaultPayload: 'rel-1n' },
    { id: 'er-rel-11', label: '+ 1-to-One (||--||)', badge: '1:1', defaultPayload: 'rel-11' },
    { id: 'er-rel-nm', label: '+ Many-to-Many (}o--o{)', badge: 'N:M', defaultPayload: 'rel-nm' }
  ],
  class: [
    { id: 'cls-class', label: '+ UML Class', badge: '📦', defaultPayload: 'class' },
    { id: 'cls-inherit', label: '+ Inheritance (<|--)', badge: '◁─', defaultPayload: 'inherit' },
    { id: 'cls-assoc', label: '+ Association (-->)', badge: '→', defaultPayload: 'assoc' },
    { id: 'cls-comp', label: '+ Composition (*--)', badge: '◆─', defaultPayload: 'comp' }
  ],
  state: [
    { id: 'st-transition', label: '+ State Transition', badge: '⚡', defaultPayload: 'transition' },
    { id: 'st-start', label: '+ [*] Start Transition', badge: '●', defaultPayload: 'start' },
    { id: 'st-end', label: '+ [*] End Transition', badge: '◉', defaultPayload: 'end' }
  ],
  mindmap: [
    { id: 'mm-branch', label: '+ Main Branch (Level 1)', badge: '🌿', defaultPayload: 'level-1' },
    { id: 'mm-topic', label: '+ Sub-Topic (Level 2)', badge: '🔹', defaultPayload: 'level-2' },
    { id: 'mm-leaf', label: '+ Detail Leaf (Level 3)', badge: '•', defaultPayload: 'level-3' }
  ],
  packet: [
    { id: 'pkt-16', label: '+ 16-bit Field', badge: '16b', defaultPayload: '16' },
    { id: 'pkt-32', label: '+ 32-bit Word', badge: '32b', defaultPayload: '32' },
    { id: 'pkt-8', label: '+ 8-bit Byte', badge: '8b', defaultPayload: '8' },
    { id: 'pkt-1', label: '+ 1-bit Flag', badge: '1b', defaultPayload: '1' }
  ],
  quadrant: [
    { id: 'quad-point', label: '+ Strategic Point', badge: '🎯', defaultPayload: 'point' }
  ],
  pie: [
    { id: 'pie-slice', label: '+ Pie Slice', badge: '🥧', defaultPayload: 'slice' }
  ],
  xychart: [
    { id: 'xy-bar', label: '+ Bar Series', badge: '📊', defaultPayload: 'bar' },
    { id: 'xy-line', label: '+ Line Series', badge: '📈', defaultPayload: 'line' },
    { id: 'xy-cat', label: '+ X Category', badge: '🏷️', defaultPayload: 'cat' }
  ],
  sankey: [
    { id: 'sk-flow', label: '+ Flow Link', badge: '🌊', defaultPayload: 'flow' }
  ],
  timeline: [
    { id: 'tl-event', label: '+ Milestone Event', badge: '📅', defaultPayload: 'event' }
  ],
  gantt: [
    { id: 'gt-task', label: '+ Project Task', badge: '🗓️', defaultPayload: 'task' },
    { id: 'gt-milestone', label: '+ Milestone', badge: '🚩', defaultPayload: 'milestone' }
  ],
  journey: [
    { id: 'jr-step', label: '+ User Step', badge: '🚶', defaultPayload: 'step' }
  ],
  gitGraph: [
    { id: 'git-commit', label: '+ Commit', badge: '●', defaultPayload: 'commit' },
    { id: 'git-branch', label: '+ New Branch', badge: '⑂', defaultPayload: 'branch' },
    { id: 'git-checkout', label: '+ Checkout', badge: '↪', defaultPayload: 'checkout' },
    { id: 'git-merge', label: '+ Merge Branch', badge: '⑃', defaultPayload: 'merge' }
  ],
  c4: [
    { id: 'c4-person', label: '+ Person / Actor', badge: '👤', defaultPayload: 'Person' },
    { id: 'c4-system', label: '+ Internal System', badge: '🏢', defaultPayload: 'System' },
    { id: 'c4-ext', label: '+ External System', badge: '☁️', defaultPayload: 'System_Ext' },
    { id: 'c4-rel', label: '+ Relationship (Rel)', badge: '⇄', defaultPayload: 'Rel' }
  ],
  architecture: [
    { id: 'arch-group', label: '+ Cloud Group', badge: '☁️', defaultPayload: 'group' },
    { id: 'arch-svc', label: '+ Service Node', badge: '⚙️', defaultPayload: 'service' },
    { id: 'arch-edge', label: '+ Service Connection', badge: '→', defaultPayload: 'edge' }
  ],
  block: [
    { id: 'blk-node', label: '+ System Block', badge: '▭', defaultPayload: 'block' },
    { id: 'blk-db', label: '+ Database Block', badge: '🗄️', defaultPayload: 'db' },
    { id: 'blk-link', label: '+ Arrow Link', badge: '→', defaultPayload: 'link' }
  ]
}

/* ============================================================================
 * PARSERS & GENERATORS FOR ALL STRUCTURED DIAGRAM TYPES
 * ============================================================================ */

// 1. SEQUENCE DIAGRAM
export interface SeqParticipant {
  id: string
  kind: 'actor' | 'participant'
  alias: string
  label: string
}
export interface SeqStep {
  id: string
  kind: 'message' | 'note'
  from: string
  to: string
  arrow: '->>' | '-->>' | '->>+' | '-->>-' | '-x'
  text: string
}
export function parseSequenceCode(code: string): {
  autonumber: boolean
  participants: SeqParticipant[]
  steps: SeqStep[]
} {
  const lines = code.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let autonumber = false
  const participants: SeqParticipant[] = []
  const steps: SeqStep[] = []
  const seenAliases = new Set<string>()

  const ensureParticipant = (alias: string) => {
    const clean = alias.replace(/^[+-]/, '').trim()
    if (!clean || seenAliases.has(clean)) return
    seenAliases.add(clean)
    participants.push({
      id: `p-${participants.length + 1}`,
      kind: 'participant',
      alias: clean,
      label: clean
    })
  }

  for (const line of lines) {
    if (/^sequenceDiagram/i.test(line)) continue
    if (/^autonumber\b/i.test(line)) {
      autonumber = true
      continue
    }
    const partMatch = line.match(/^(actor|participant)\s+([^\s]+)(?:\s+as\s+(.+))?$/i)
    if (partMatch) {
      const kind = partMatch[1].toLowerCase() === 'actor' ? 'actor' : 'participant'
      const alias = partMatch[2].trim()
      const label = (partMatch[3] || alias).trim()
      if (!seenAliases.has(alias)) {
        seenAliases.add(alias)
        participants.push({ id: `p-${participants.length + 1}`, kind, alias, label })
      }
      continue
    }
    const noteMatch = line.match(/^Note\s+(?:over|right of|left of)\s+([^:]+):\s*(.+)$/i)
    if (noteMatch) {
      const targets = noteMatch[1].split(',').map((s) => s.trim())
      steps.push({
        id: `s-${steps.length + 1}`,
        kind: 'note',
        from: targets[0] || 'User',
        to: targets[1] || targets[0] || 'User',
        arrow: '->>',
        text: noteMatch[2].trim()
      })
      continue
    }
    const msgMatch = line.match(/^([A-Za-z0-9_-]+)\s*(-->>-|->>\+|-->|-->>|->>|-x)\s*([+-]?[A-Za-z0-9_-]+)\s*:\s*(.+)$/)
    if (msgMatch) {
      let rawArrow = msgMatch[2]
      let target = msgMatch[3]
      if (target.startsWith('+') && rawArrow === '->>') {
        rawArrow = '->>+'
        target = target.slice(1)
      } else if (target.startsWith('-') && rawArrow === '-->>') {
        rawArrow = '-->>-'
        target = target.slice(1)
      }
      ensureParticipant(msgMatch[1])
      ensureParticipant(target)
      steps.push({
        id: `s-${steps.length + 1}`,
        kind: 'message',
        from: msgMatch[1],
        to: target,
        arrow: (['->>', '-->>', '->>+', '-->>-', '-x'].includes(rawArrow) ? rawArrow : '->>') as SeqStep['arrow'],
        text: msgMatch[4].trim()
      })
    }
  }

  if (participants.length === 0) {
    participants.push(
      { id: 'p-1', kind: 'actor', alias: 'User', label: 'User' },
      { id: 'p-2', kind: 'participant', alias: 'App', label: 'Klartext App' }
    )
  }
  return { autonumber, participants, steps }
}

export function buildSequenceCode(
  autonumber: boolean,
  participants: SeqParticipant[],
  steps: SeqStep[]
): string {
  const lines: string[] = ['sequenceDiagram']
  if (autonumber) lines.push('    autonumber')
  for (const p of participants) {
    if (p.label && p.label !== p.alias) {
      lines.push(`    ${p.kind} ${p.alias} as ${p.label}`)
    } else {
      lines.push(`    ${p.kind} ${p.alias}`)
    }
  }
  for (const s of steps) {
    if (s.kind === 'note') {
      const span = s.to && s.to !== s.from ? `${s.from},${s.to}` : s.from
      lines.push(`    Note over ${span}: ${s.text}`)
    } else {
      lines.push(`    ${s.from}${s.arrow}${s.to}: ${s.text}`)
    }
  }
  return lines.join('\n')
}

// 2. KANBAN BOARD
export interface KanbanCardItem {
  id: string
  title: string
  assigned: string
  priority: 'Very High' | 'High' | 'Normal' | 'Low'
}
export interface KanbanColItem {
  id: string
  name: string
  cards: KanbanCardItem[]
}
export function parseKanbanCode(code: string): KanbanColItem[] {
  const lines = code.split(/\r?\n/)
  const cols: KanbanColItem[] = []
  let currentCol: KanbanColItem | null = null

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || /^kanban\b/i.test(trimmed) || trimmed.startsWith('%%')) continue
    const cardMatch = trimmed.match(/^\[([^\]]+)\](?:@\{([^}]*)\})?$/)
    if (cardMatch) {
      if (!currentCol) {
        currentCol = { id: `col-${cols.length + 1}`, name: 'Backlog', cards: [] }
        cols.push(currentCol)
      }
      const title = cardMatch[1].trim()
      const meta = cardMatch[2] || ''
      const assignedMatch = meta.match(/assigned:\s*"([^"]+)"/i)
      const prioMatch = meta.match(/priority:\s*"([^"]+)"/i)
      const rawPrio = prioMatch ? prioMatch[1] : 'Normal'
      const priority = (['Very High', 'High', 'Normal', 'Low'].includes(rawPrio)
        ? rawPrio
        : 'Normal') as KanbanCardItem['priority']
      currentCol.cards.push({
        id: `card-${currentCol.id}-${currentCol.cards.length + 1}`,
        title,
        assigned: assignedMatch ? assignedMatch[1] : '',
        priority
      })
    } else {
      currentCol = {
        id: `col-${cols.length + 1}`,
        name: trimmed,
        cards: []
      }
      cols.push(currentCol)
    }
  }
  if (cols.length === 0) {
    cols.push({
      id: 'col-1',
      name: 'Backlog',
      cards: [{ id: 'card-1', title: 'New Task', assigned: 'team', priority: 'Normal' }]
    })
  }
  return cols
}

export function buildKanbanCode(cols: KanbanColItem[]): string {
  const lines: string[] = ['kanban']
  for (const col of cols) {
    lines.push(`  ${col.name.trim() || 'Column'}`)
    for (const c of col.cards) {
      const metaParts: string[] = []
      if (c.assigned.trim()) metaParts.push(`assigned: "${c.assigned.trim()}"`)
      if (c.priority) metaParts.push(`priority: "${c.priority}"`)
      const metaSuffix = metaParts.length > 0 ? `@{ ${metaParts.join(', ')} }` : ''
      lines.push(`    [${c.title.replace(/[\[\]]/g, '') || 'Task'}]${metaSuffix}`)
    }
  }
  return lines.join('\n')
}

// 3. PACKET DIAGRAM
export interface PacketFieldItem {
  id: string
  bits: number
  label: string
}
export function parsePacketCode(code: string): { title: string; fields: PacketFieldItem[] } {
  let title = 'TCP Packet'
  const titleMatch = code.match(/title:\s*"?([^"\r\n]+)"?/i)
  if (titleMatch) title = titleMatch[1].trim()

  const fields: PacketFieldItem[] = []
  const lines = code.split(/\r?\n/).map((l) => l.trim())
  for (const line of lines) {
    const rangeMatch = line.match(/^(\d+)(?:-(\d+))?\s*:\s*"?([^"]+)"?$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : start
      const bits = Math.max(1, end - start + 1)
      fields.push({
        id: `pkt-${fields.length + 1}`,
        bits,
        label: rangeMatch[3].trim()
      })
    }
  }
  if (fields.length === 0) {
    fields.push(
      { id: 'pkt-1', bits: 16, label: 'Source Port' },
      { id: 'pkt-2', bits: 16, label: 'Destination Port' },
      { id: 'pkt-3', bits: 32, label: 'Sequence Number' }
    )
  }
  return { title, fields }
}

export function buildPacketCode(title: string, fields: PacketFieldItem[]): string {
  const lines: string[] = ['---', `title: "${title.replace(/"/g, "'") || 'Packet Header'}"`, '---', 'packet']
  let cursor = 0
  for (const f of fields) {
    const w = Math.max(1, f.bits)
    const start = cursor
    const end = cursor + w - 1
    const rangeStr = start === end ? `${start}` : `${start}-${end}`
    lines.push(`${rangeStr}: "${f.label.replace(/"/g, "'") || 'Field'}"`)
    cursor = end + 1
  }
  return lines.join('\n')
}

// 4. QUADRANT CHART (Interactive 2D Drag-and-Drop Matrix!)
export interface QuadrantPointItem {
  id: string
  label: string
  x: number
  y: number
}
export interface QuadrantModel {
  title: string
  xLeft: string
  xRight: string
  yBottom: string
  yTop: string
  q1: string
  q2: string
  q3: string
  q4: string
  points: QuadrantPointItem[]
}
export function parseQuadrantCode(code: string): QuadrantModel {
  const model: QuadrantModel = {
    title: 'Strategic Initiative Matrix',
    xLeft: 'Low Effort',
    xRight: 'High Effort',
    yBottom: 'Low Impact',
    yTop: 'High Impact',
    q1: 'Strategic Investments',
    q2: 'Quick Wins',
    q3: 'Low Priority',
    q4: 'Complex Projects',
    points: []
  }
  const lines = code.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const tMatch = line.match(/^title\s+(.+)$/i)
    if (tMatch) {
      model.title = tMatch[1].trim()
      continue
    }
    const xMatch = line.match(/^x-axis\s+(.+?)\s*-->\s*(.+)$/i)
    if (xMatch) {
      model.xLeft = xMatch[1].trim()
      model.xRight = xMatch[2].trim()
      continue
    }
    const yMatch = line.match(/^y-axis\s+(.+?)\s*-->\s*(.+)$/i)
    if (yMatch) {
      model.yBottom = yMatch[1].trim()
      model.yTop = yMatch[2].trim()
      continue
    }
    const qMatch = line.match(/^quadrant-([1-4])\s+(.+)$/i)
    if (qMatch) {
      const idx = qMatch[1]
      if (idx === '1') model.q1 = qMatch[2].trim()
      if (idx === '2') model.q2 = qMatch[2].trim()
      if (idx === '3') model.q3 = qMatch[2].trim()
      if (idx === '4') model.q4 = qMatch[2].trim()
      continue
    }
    const ptMatch = line.match(/^"([^"]+)"\s*:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]$/)
    if (ptMatch) {
      model.points.push({
        id: `qp-${model.points.length + 1}`,
        label: ptMatch[1],
        x: Math.min(0.98, Math.max(0.02, parseFloat(ptMatch[2]) || 0.5)),
        y: Math.min(0.98, Math.max(0.02, parseFloat(ptMatch[3]) || 0.5))
      })
    }
  }
  return model
}

export function buildQuadrantCode(m: QuadrantModel): string {
  const lines: string[] = [
    'quadrantChart',
    `    title ${m.title || 'Strategic Matrix'}`,
    `    x-axis ${m.xLeft || 'Low'} --> ${m.xRight || 'High'}`,
    `    y-axis ${m.yBottom || 'Low'} --> ${m.yTop || 'High'}`,
    `    quadrant-1 ${m.q1 || 'Quadrant 1'}`,
    `    quadrant-2 ${m.q2 || 'Quadrant 2'}`,
    `    quadrant-3 ${m.q3 || 'Quadrant 3'}`,
    `    quadrant-4 ${m.q4 || 'Quadrant 4'}`
  ]
  for (const pt of m.points) {
    lines.push(
      `    "${pt.label.replace(/"/g, "'") || 'Item'}": [${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}]`
    )
  }
  return lines.join('\n')
}

// 5. PIE CHART
export interface PieSliceItem {
  id: string
  label: string
  value: number
}
export function parsePieCode(code: string): {
  title: string
  showData: boolean
  slices: PieSliceItem[]
} {
  let title = 'Distribution Breakdown'
  let showData = /pie\s+showData/i.test(code)
  const slices: PieSliceItem[] = []
  for (const rawLine of code.split(/\r?\n/)) {
    const line = rawLine.trim()
    const tMatch = line.match(/^title\s+(.+)$/i)
    if (tMatch) {
      title = tMatch[1].trim()
      continue
    }
    const sMatch = line.match(/^"([^"]+)"\s*:\s*([0-9.]+)$/)
    if (sMatch) {
      slices.push({
        id: `sl-${slices.length + 1}`,
        label: sMatch[1],
        value: parseFloat(sMatch[2]) || 10
      })
    }
  }
  return { title, showData, slices }
}

export function buildPieCode(title: string, showData: boolean, slices: PieSliceItem[]): string {
  const lines: string[] = [showData ? 'pie showData' : 'pie', `    title ${title || 'Chart'}`]
  for (const s of slices) {
    lines.push(`    "${s.label.replace(/"/g, "'") || 'Slice'}" : ${s.value}`)
  }
  return lines.join('\n')
}

// 6. GENERIC VISUAL LINE / BLOCK ITEM MODEL FOR REMAINING TYPES
// (ER, Class, State, Mindmap, Timeline, GitGraph, Gantt, XYChart, Sankey, Journey, C4, Architecture, Block)
export interface VisualDiagramRow {
  id: string
  kind: string
  col1: string
  col2: string
  col3: string
  col4: string
}

export function parseDiagramToVisualRows(
  diagramType: string,
  code: string
): { headerTitle: string; rows: VisualDiagramRow[] } {
  const lines = code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  let headerTitle = ''
  const rows: VisualDiagramRow[] = []

  if (diagramType === 'state') {
    for (const l of lines) {
      if (/^stateDiagram/i.test(l)) continue
      const m = l.match(/^([^\s]+)\s*-->\s*([^\s:]+)(?:\s*:\s*(.+))?$/)
      if (m) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'transition',
          col1: m[1],
          col2: m[2],
          col3: (m[3] || '').trim(),
          col4: ''
        })
      }
    }
    return { headerTitle, rows }
  }

  if (diagramType === 'er') {
    let currentEntity = ''
    for (const l of lines) {
      if (/^erDiagram/i.test(l)) continue
      const relMatch = l.match(/^([A-Za-z0-9_-]+)\s+(\|\|--o\{|\|\|--\|\||\}o--o\{|\|\|--\|\{|\}o--\|\|)\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/)
      if (relMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'rel',
          col1: relMatch[1],
          col2: relMatch[2],
          col3: relMatch[3],
          col4: relMatch[4].trim()
        })
        continue
      }
      const entOpen = l.match(/^([A-Za-z0-9_-]+)\s*\{$/)
      if (entOpen) {
        currentEntity = entOpen[1]
        continue
      }
      if (l === '}') {
        currentEntity = ''
        continue
      }
      if (currentEntity) {
        const parts = l.split(/\s+/)
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'field',
          col1: currentEntity,
          col2: parts[0] || 'string',
          col3: parts[1] || 'id',
          col4: parts[2] || ''
        })
      }
    }
    return { headerTitle, rows }
  }

  if (diagramType === 'class') {
    let currentClass = ''
    for (const l of lines) {
      if (/^classDiagram/i.test(l)) continue
      const relMatch = l.match(/^([A-Za-z0-9_-]+)\s+(<\|--|\*--|o--|-->|\.\.>)\s+([A-Za-z0-9_-]+)(?:\s*:\s*(.+))?$/)
      if (relMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'rel',
          col1: relMatch[1],
          col2: relMatch[2],
          col3: relMatch[3],
          col4: (relMatch[4] || '').trim()
        })
        continue
      }
      const clsOpen = l.match(/^class\s+([A-Za-z0-9_-]+)\s*\{$/)
      if (clsOpen) {
        currentClass = clsOpen[1]
        continue
      }
      if (l === '}') {
        currentClass = ''
        continue
      }
      if (currentClass) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'member',
          col1: currentClass,
          col2: l,
          col3: '',
          col4: ''
        })
      }
    }
    return { headerTitle, rows }
  }

  if (diagramType === 'mindmap') {
    const rawLines = code.split(/\r?\n/).filter((l) => l.trim().length > 0 && !/^\s*mindmap\b/i.test(l))
    for (const raw of rawLines) {
      const indentSpaces = (raw.match(/^\s*/) || [''])[0].length
      const trimmed = raw.trim()
      const rootMatch = trimmed.match(/^root\(\((.+)\)\)$/)
      if (rootMatch) {
        headerTitle = rootMatch[1]
        continue
      }
      const level = indentSpaces <= 4 ? '1' : indentSpaces <= 6 ? '2' : '3'
      rows.push({
        id: `r-${rows.length + 1}`,
        kind: 'node',
        col1: level,
        col2: trimmed,
        col3: '',
        col4: ''
      })
    }
    return { headerTitle: headerTitle || 'Central Topic', rows }
  }

  if (diagramType === 'gitGraph') {
    for (const l of lines) {
      if (/^gitGraph/i.test(l)) continue
      const commitMatch = l.match(/^commit(?:\s+id:\s*"([^"]+)")?(?:\s+tag:\s*"([^"]+)")?/i)
      if (commitMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'commit',
          col1: (commitMatch[1] || `c-${rows.length + 1}`).trim(),
          col2: (commitMatch[2] || '').trim(),
          col3: '',
          col4: ''
        })
        continue
      }
      const branchMatch = l.match(/^(branch|checkout|merge)\s+([^\s]+)(?:.*tag:\s*"([^"]+)")?/i)
      if (branchMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: branchMatch[1].toLowerCase(),
          col1: branchMatch[2].trim(),
          col2: (branchMatch[3] || '').trim(),
          col3: '',
          col4: ''
        })
      }
    }
    return { headerTitle, rows }
  }

  if (diagramType === 'timeline' || diagramType === 'journey') {
    let currentSection = 'Phase 1'
    for (const l of lines) {
      if (/^(timeline|journey)\b/i.test(l)) continue
      const tMatch = l.match(/^title\s+(.+)$/i)
      if (tMatch) {
        headerTitle = tMatch[1].trim()
        continue
      }
      const secMatch = l.match(/^section\s+(.+)$/i)
      if (secMatch) {
        currentSection = secMatch[1].trim()
        continue
      }
      if (diagramType === 'journey') {
        const jMatch = l.match(/^([^:]+):\s*(\d+)\s*:\s*(.+)$/)
        if (jMatch) {
          rows.push({
            id: `r-${rows.length + 1}`,
            kind: 'step',
            col1: currentSection,
            col2: jMatch[1].trim(),
            col3: jMatch[2].trim(),
            col4: jMatch[3].trim()
          })
        }
      } else {
        const parts = l.split(':').map((p) => p.trim())
        if (parts.length >= 2 && parts[0]) {
          rows.push({
            id: `r-${rows.length + 1}`,
            kind: 'milestone',
            col1: currentSection,
            col2: parts[0],
            col3: parts.slice(1).join(' : '),
            col4: ''
          })
        } else if (l.startsWith(':') && rows.length > 0) {
          rows[rows.length - 1].col3 += `, ${l.slice(1).trim()}`
        }
      }
    }
    return { headerTitle: headerTitle || 'Roadmap & Milestones', rows }
  }

  if (diagramType === 'gantt') {
    let currentSection = 'Workstream'
    for (const l of lines) {
      if (/^(gantt|dateFormat)\b/i.test(l)) continue
      const tMatch = l.match(/^title\s+(.+)$/i)
      if (tMatch) {
        headerTitle = tMatch[1].trim()
        continue
      }
      const secMatch = l.match(/^section\s+(.+)$/i)
      if (secMatch) {
        currentSection = secMatch[1].trim()
        continue
      }
      const taskMatch = l.match(/^([^:]+):\s*(.+)$/)
      if (taskMatch) {
        const meta = taskMatch[2].split(',').map((s) => s.trim())
        let status = 'normal'
        let rest = meta
        if (['done', 'active', 'crit', 'milestone'].includes(meta[0])) {
          status = meta[0]
          rest = meta.slice(1)
        }
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: status,
          col1: currentSection,
          col2: taskMatch[1].trim(),
          col3: rest[1] || rest[0] || '2026-10-01',
          col4: rest[2] || '5d'
        })
      }
    }
    return { headerTitle: headerTitle || 'Project Rollout Schedule', rows }
  }

  if (diagramType === 'sankey') {
    for (const l of lines) {
      if (/^sankey/i.test(l)) continue
      const parts = l.split(',').map((p) => p.trim())
      if (parts.length >= 3) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'flow',
          col1: parts[0],
          col2: parts[1],
          col3: parts[2],
          col4: ''
        })
      }
    }
    return { headerTitle, rows }
  }

  if (diagramType === 'xychart') {
    for (const l of lines) {
      if (/^xychart/i.test(l)) continue
      const tMatch = l.match(/^title\s+"?([^"]+)"?$/i)
      if (tMatch) {
        headerTitle = tMatch[1].trim()
        continue
      }
      const xMatch = l.match(/^x-axis\s+\[([^\]]+)\]/i)
      if (xMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'x-axis',
          col1: xMatch[1].trim(),
          col2: '',
          col3: '',
          col4: ''
        })
        continue
      }
      const yMatch = l.match(/^y-axis\s+"?([^"]*)"?\s+(\d+)\s*-->\s*(\d+)/i)
      if (yMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'y-axis',
          col1: yMatch[1].trim(),
          col2: yMatch[2],
          col3: yMatch[3],
          col4: ''
        })
        continue
      }
      const seriesMatch = l.match(/^(bar|line)\s+\[([^\]]+)\]/i)
      if (seriesMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: seriesMatch[1].toLowerCase(),
          col1: seriesMatch[2].trim(),
          col2: '',
          col3: '',
          col4: ''
        })
      }
    }
    return { headerTitle: headerTitle || 'Metrics Overview', rows }
  }

  if (diagramType === 'c4') {
    for (const l of lines) {
      if (/^C4/i.test(l)) continue
      const tMatch = l.match(/^title\s+(.+)$/i)
      if (tMatch) {
        headerTitle = tMatch[1].trim()
        continue
      }
      const nodeMatch = l.match(/^(Person|System|System_Ext)\(\s*([^,]+),\s*"([^"]+)"(?:,\s*"([^"]*)")?\s*\)/i)
      if (nodeMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: nodeMatch[1],
          col1: nodeMatch[2].trim(),
          col2: nodeMatch[3].trim(),
          col3: (nodeMatch[4] || '').trim(),
          col4: ''
        })
        continue
      }
      const relMatch = l.match(/^Rel\(\s*([^,]+),\s*([^,]+),\s*"([^"]+)"\s*\)/i)
      if (relMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'Rel',
          col1: relMatch[1].trim(),
          col2: relMatch[2].trim(),
          col3: relMatch[3].trim(),
          col4: ''
        })
      }
    }
    return { headerTitle: headerTitle || 'System Context Diagram', rows }
  }

  if (diagramType === 'architecture') {
    for (const l of lines) {
      if (/^architecture/i.test(l)) continue
      const grpMatch = l.match(/^group\s+([A-Za-z0-9_-]+)\(([^)]+)\)\[([^\]]+)\]/i)
      if (grpMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'group',
          col1: grpMatch[1],
          col2: grpMatch[2],
          col3: grpMatch[3],
          col4: ''
        })
        continue
      }
      const svcMatch = l.match(/^service\s+([A-Za-z0-9_-]+)\(([^)]+)\)\[([^\]]+)\](?:\s+in\s+([A-Za-z0-9_-]+))?/i)
      if (svcMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'service',
          col1: svcMatch[1],
          col2: svcMatch[2],
          col3: svcMatch[3],
          col4: svcMatch[4] || ''
        })
        continue
      }
      const edgeMatch = l.match(/^([A-Za-z0-9_-]+):([LRTB])\s*-->\s*([LRTB]):([A-Za-z0-9_-]+)/i)
      if (edgeMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'edge',
          col1: edgeMatch[1],
          col2: `${edgeMatch[2]} --> ${edgeMatch[3]}`,
          col3: edgeMatch[4],
          col4: ''
        })
      }
    }
    return { headerTitle, rows }
  }

  if (diagramType === 'block') {
    headerTitle = '3'
    for (const l of lines) {
      if (/^block-beta/i.test(l)) continue
      const colMatch = l.match(/^columns\s+(\d+)/i)
      if (colMatch) {
        headerTitle = colMatch[1]
        continue
      }
      const linkMatch = l.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)$/)
      if (linkMatch) {
        rows.push({
          id: `r-${rows.length + 1}`,
          kind: 'link',
          col1: linkMatch[1],
          col2: linkMatch[2],
          col3: '',
          col4: ''
        })
        continue
      }
      const tokens = l.match(/[A-Za-z0-9_-]+(?:\["[^"]+"\]|\[\("[^"]+"\)\])?(?::\d+)?/g) || []
      for (const tok of tokens) {
        if (tok.startsWith('space')) continue
        const dbMatch = tok.match(/^([A-Za-z0-9_-]+)\[\("([^"]+)"\)\](?::(\d+))?$/)
        if (dbMatch) {
          rows.push({
            id: `r-${rows.length + 1}`,
            kind: 'db',
            col1: dbMatch[1],
            col2: dbMatch[2],
            col3: dbMatch[3] || '1',
            col4: ''
          })
          continue
        }
        const blkMatch = tok.match(/^([A-Za-z0-9_-]+)\["([^"]+)"\](?::(\d+))?$/)
        if (blkMatch) {
          rows.push({
            id: `r-${rows.length + 1}`,
            kind: 'block',
            col1: blkMatch[1],
            col2: blkMatch[2],
            col3: blkMatch[3] || '1',
            col4: ''
          })
        }
      }
    }
    return { headerTitle, rows }
  }

  return { headerTitle, rows }
}

export function buildMermaidFromVisualRows(
  diagramType: string,
  headerTitle: string,
  rows: VisualDiagramRow[]
): string {
  if (diagramType === 'state') {
    const lines = ['stateDiagram-v2']
    for (const r of rows) {
      const labelPart = r.col3.trim() ? ` : ${r.col3.trim()}` : ''
      lines.push(`    ${r.col1 || '[*]'} --> ${r.col2 || 'State'}${labelPart}`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'er') {
    const lines = ['erDiagram']
    const rels = rows.filter((r) => r.kind === 'rel')
    const fields = rows.filter((r) => r.kind === 'field')
    for (const r of rels) {
      lines.push(`    ${r.col1 || 'ENTITY_A'} ${r.col2 || '||--o{'} ${r.col3 || 'ENTITY_B'} : ${r.col4 || 'relates'}`)
    }
    const grouped = new Map<string, VisualDiagramRow[]>()
    for (const f of fields) {
      const ent = f.col1.trim() || 'ENTITY'
      const list = grouped.get(ent) || []
      list.push(f)
      grouped.set(ent, list)
    }
    for (const [ent, fList] of grouped.entries()) {
      lines.push(`    ${ent} {`)
      for (const f of fList) {
        const keyPart = f.col4.trim() ? ` ${f.col4.trim()}` : ''
        lines.push(`        ${f.col2 || 'string'} ${f.col3 || 'id'}${keyPart}`)
      }
      lines.push('    }')
    }
    return lines.join('\n')
  }

  if (diagramType === 'class') {
    const lines = ['classDiagram']
    const members = rows.filter((r) => r.kind === 'member')
    const rels = rows.filter((r) => r.kind === 'rel')
    const grouped = new Map<string, VisualDiagramRow[]>()
    for (const m of members) {
      const cls = m.col1.trim() || 'MyClass'
      const list = grouped.get(cls) || []
      list.push(m)
      grouped.set(cls, list)
    }
    for (const [cls, mList] of grouped.entries()) {
      lines.push(`    class ${cls} {`)
      for (const m of mList) {
        lines.push(`        ${m.col2 || '+string id'}`)
      }
      lines.push('    }')
    }
    for (const r of rels) {
      const lbl = r.col4.trim() ? ` : ${r.col4.trim()}` : ''
      lines.push(`    ${r.col1 || 'ClassA'} ${r.col2 || '-->'} ${r.col3 || 'ClassB'}${lbl}`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'mindmap') {
    const lines = ['mindmap', `  root((${headerTitle.trim() || 'Central Topic'}))`]
    for (const r of rows) {
      const lvl = r.col1 === '1' ? '    ' : r.col1 === '2' ? '      ' : '        '
      lines.push(`${lvl}${r.col2 || 'Topic'}`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'gitGraph') {
    const lines = ['gitGraph']
    for (const r of rows) {
      if (r.kind === 'commit') {
        const tagPart = r.col2.trim() ? ` tag: "${r.col2.trim()}"` : ''
        lines.push(`    commit id: "${r.col1.trim() || 'commit'}"${tagPart}`)
      } else if (r.kind === 'branch') {
        lines.push(`    branch ${r.col1.trim() || 'feature'}`)
      } else if (r.kind === 'checkout') {
        lines.push(`    checkout ${r.col1.trim() || 'main'}`)
      } else if (r.kind === 'merge') {
        const tagPart = r.col2.trim() ? ` tag: "${r.col2.trim()}"` : ''
        lines.push(`    merge ${r.col1.trim() || 'feature'}${tagPart}`)
      }
    }
    return lines.join('\n')
  }

  if (diagramType === 'timeline') {
    const lines = ['timeline', `    title ${headerTitle.trim() || 'Timeline Roadmap'}`]
    let lastSec = ''
    for (const r of rows) {
      const sec = r.col1.trim() || 'Phase'
      if (sec !== lastSec) {
        lines.push(`    section ${sec}`)
        lastSec = sec
      }
      const events = r.col3
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (events.length <= 1) {
        lines.push(`        ${r.col2 || 'Milestone'} : ${r.col3 || 'Deliverable'}`)
      } else {
        lines.push(`        ${r.col2 || 'Milestone'} : ${events[0]}`)
        for (let i = 1; i < events.length; i++) {
          lines.push(`                    : ${events[i]}`)
        }
      }
    }
    return lines.join('\n')
  }

  if (diagramType === 'journey') {
    const lines = ['journey', `    title ${headerTitle.trim() || 'User Journey'}`]
    let lastSec = ''
    for (const r of rows) {
      const sec = r.col1.trim() || 'Stage'
      if (sec !== lastSec) {
        lines.push(`    section ${sec}`)
        lastSec = sec
      }
      lines.push(`      ${r.col2 || 'Action'}: ${r.col3 || '5'}: ${r.col4 || 'User'}`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'gantt') {
    const lines = [
      'gantt',
      `    title ${headerTitle.trim() || 'Project Schedule'}`,
      '    dateFormat YYYY-MM-DD'
    ]
    let lastSec = ''
    rows.forEach((r, idx) => {
      const sec = r.col1.trim() || 'Phase'
      if (sec !== lastSec) {
        lines.push(`    section ${sec}`)
        lastSec = sec
      }
      const statusPart = r.kind && r.kind !== 'normal' ? `${r.kind}, ` : ''
      lines.push(
        `        ${r.col2 || 'Task'} :${statusPart}t${idx + 1}, ${r.col3 || '2026-10-01'}, ${r.col4 || '5d'}`
      )
    })
    return lines.join('\n')
  }

  if (diagramType === 'sankey') {
    const lines = ['sankey-beta', '']
    for (const r of rows) {
      lines.push(`${r.col1 || 'Source'},${r.col2 || 'Target'},${r.col3 || '50'}`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'xychart') {
    const lines = ['xychart-beta', `    title "${headerTitle.replace(/"/g, "'") || 'Metrics'}"`]
    for (const r of rows) {
      if (r.kind === 'x-axis') {
        lines.push(`    x-axis [${r.col1 || 'Jan, Feb, Mar'}]`)
      } else if (r.kind === 'y-axis') {
        lines.push(`    y-axis "${r.col1 || 'Value'}" ${r.col2 || '0'} --> ${r.col3 || '100'}`)
      } else {
        lines.push(`    ${r.kind === 'line' ? 'line' : 'bar'} [${r.col1 || '20, 40, 60'}]`)
      }
    }
    return lines.join('\n')
  }

  if (diagramType === 'c4') {
    const lines = ['C4Context', `    title ${headerTitle.trim() || 'System Context'}`]
    const nodes = rows.filter((r) => r.kind !== 'Rel')
    const rels = rows.filter((r) => r.kind === 'Rel')
    for (const n of nodes) {
      lines.push(
        `    ${n.kind || 'System'}(${n.col1 || 'sys'}, "${n.col2 || 'System'}", "${n.col3 || 'Description'}")`
      )
    }
    for (const r of rels) {
      lines.push(`    Rel(${r.col1 || 'author'}, ${r.col2 || 'klartext'}, "${r.col3 || 'Uses'}")`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'architecture') {
    const lines = ['architecture-beta']
    for (const r of rows.filter((x) => x.kind === 'group')) {
      lines.push(`    group ${r.col1 || 'core'}(${r.col2 || 'cloud'})[${r.col3 || 'Group'}]`)
    }
    for (const r of rows.filter((x) => x.kind === 'service')) {
      const inPart = r.col4.trim() ? ` in ${r.col4.trim()}` : ''
      lines.push(`    service ${r.col1 || 'api'}(${r.col2 || 'server'})[${r.col3 || 'Service'}]${inPart}`)
    }
    for (const r of rows.filter((x) => x.kind === 'edge')) {
      const dirs = (r.col2 || 'R --> L').split('-->').map((s) => s.trim())
      lines.push(`    ${r.col1 || 'api'}:${dirs[0] || 'R'} --> ${dirs[1] || 'L'}:${r.col3 || 'db'}`)
    }
    return lines.join('\n')
  }

  if (diagramType === 'block') {
    const cols = parseInt(headerTitle, 10) || 3
    const lines = ['block-beta', `    columns ${cols}`]
    const blocks = rows.filter((r) => r.kind !== 'link')
    const links = rows.filter((r) => r.kind === 'link')
    for (const b of blocks) {
      const span = parseInt(b.col3, 10) > 1 ? `:${b.col3.trim()}` : ''
      if (b.kind === 'db') {
        lines.push(`    ${b.col1 || 'DB'}[("${b.col2 || 'Database'}")]${span}`)
      } else {
        lines.push(`    ${b.col1 || 'BLK'}["${b.col2 || 'Block'}"]${span}`)
      }
    }
    for (const l of links) {
      lines.push(`    ${l.col1 || 'UI'} --> ${l.col2 || 'Main'}`)
    }
    return lines.join('\n')
  }

  return ''
}

/* ============================================================================
 * GRAPHICAL DRAG-AND-DROP BUILDER COMPONENT FOR NON-FLOWCHART DIAGRAMS
 * ============================================================================ */

export const StructuredMermaidVisualBuilder: React.FC<{
  diagramType: string
  code: string
  theme: 'light' | 'dark'
  onChangeCode: (nextCode: string) => void
}> = ({ diagramType, code, theme, onChangeCode }) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragKanbanCard, setDragKanbanCard] = useState<{ colIdx: number; cardIdx: number } | null>(
    null
  )
  const [draggingQuadPointId, setDraggingQuadPointId] = useState<string | null>(null)

  const handleDropZoneFromPalette = (e: React.DragEvent) => {
    e.preventDefault()
    const payload = e.dataTransfer.getData('text/klartext-mermaid-palette')
    if (!payload) return
    triggerAddFromPalettePayload(payload)
  }

  const triggerAddFromPalettePayload = (payload: string) => {
    if (diagramType === 'sequence') {
      const parsed = parseSequenceCode(code)
      if (payload === 'actor' || payload === 'participant') {
        const nextId = `Actor${parsed.participants.length + 1}`
        parsed.participants.push({
          id: `p-${Date.now()}`,
          kind: payload,
          alias: nextId,
          label: nextId
        })
      } else if (payload === 'note') {
        const first = parsed.participants[0]?.alias || 'User'
        parsed.steps.push({
          id: `s-${Date.now()}`,
          kind: 'note',
          from: first,
          to: first,
          arrow: '->>',
          text: 'Important note'
        })
      } else {
        const from = parsed.participants[0]?.alias || 'User'
        const to = parsed.participants[1]?.alias || from
        parsed.steps.push({
          id: `s-${Date.now()}`,
          kind: 'message',
          from,
          to,
          arrow: payload === 'reply' ? '-->>' : '->>',
          text: payload === 'reply' ? '200 OK Response' : 'Send Request'
        })
      }
      onChangeCode(buildSequenceCode(parsed.autonumber, parsed.participants, parsed.steps))
      return
    }

    if (diagramType === 'kanban') {
      const cols = parseKanbanCode(code)
      if (payload === 'column') {
        cols.push({
          id: `col-${Date.now()}`,
          name: `Stage ${cols.length + 1}`,
          cards: [{ id: `c-${Date.now()}`, title: 'New Task Card', assigned: '', priority: 'Normal' }]
        })
      } else {
        const targetCol = cols[0] || { id: 'col-1', name: 'Backlog', cards: [] }
        if (cols.length === 0) cols.push(targetCol)
        targetCol.cards.push({
          id: `c-${Date.now()}`,
          title: payload === 'card-high' ? 'High Priority Deliverable' : 'New Task Item',
          assigned: 'team',
          priority: payload === 'card-high' ? 'High' : 'Normal'
        })
      }
      onChangeCode(buildKanbanCode(cols))
      return
    }

    if (diagramType === 'packet') {
      const parsed = parsePacketCode(code)
      const bits = parseInt(payload, 10) || 16
      parsed.fields.push({
        id: `pkt-${Date.now()}`,
        bits,
        label: `${bits}-bit Header Field`
      })
      onChangeCode(buildPacketCode(parsed.title, parsed.fields))
      return
    }

    if (diagramType === 'quadrant') {
      const m = parseQuadrantCode(code)
      m.points.push({
        id: `qp-${Date.now()}`,
        label: `Initiative ${m.points.length + 1}`,
        x: 0.5,
        y: 0.65
      })
      onChangeCode(buildQuadrantCode(m))
      return
    }

    if (diagramType === 'pie') {
      const parsed = parsePieCode(code)
      parsed.slices.push({
        id: `sl-${Date.now()}`,
        label: `Category ${parsed.slices.length + 1}`,
        value: 15
      })
      onChangeCode(buildPieCode(parsed.title, parsed.showData, parsed.slices))
      return
    }

    // Generic row-based visual builders
    const parsed = parseDiagramToVisualRows(diagramType, code)
    const nextIdx = parsed.rows.length + 1
    if (diagramType === 'state') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: 'transition',
        col1: payload === 'start' ? '[*]' : 'Idle',
        col2: payload === 'end' ? '[*]' : `State${nextIdx}`,
        col3: 'Trigger event',
        col4: ''
      })
    } else if (diagramType === 'er') {
      if (payload === 'entity') {
        const entName = `ENTITY_${nextIdx}`
        parsed.rows.push(
          { id: `r-${Date.now()}-1`, kind: 'field', col1: entName, col2: 'string', col3: 'id', col4: 'PK' },
          { id: `r-${Date.now()}-2`, kind: 'field', col1: entName, col2: 'string', col3: 'name', col4: '' }
        )
      } else {
        const card = payload === 'rel-11' ? '||--||' : payload === 'rel-nm' ? '}o--o{' : '||--o{'
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'rel',
          col1: 'WORKSPACE',
          col2: card,
          col3: 'DOCUMENT',
          col4: 'links_to'
        })
      }
    } else if (diagramType === 'class') {
      if (payload === 'class') {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'member',
          col1: `Service${nextIdx}`,
          col2: '+execute() Promise~void~',
          col3: '',
          col4: ''
        })
      } else {
        const arrow = payload === 'inherit' ? '<|--' : payload === 'comp' ? '*--' : '-->'
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'rel',
          col1: 'WorkspaceManager',
          col2: arrow,
          col3: 'GitOrchestrator',
          col4: 'uses'
        })
      }
    } else if (diagramType === 'mindmap') {
      const lvl = payload === 'level-1' ? '1' : payload === 'level-3' ? '3' : '2'
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: 'node',
        col1: lvl,
        col2: `New Idea ${nextIdx}`,
        col3: '',
        col4: ''
      })
    } else if (diagramType === 'gitGraph') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: payload,
        col1: payload === 'commit' ? `feat-${nextIdx}` : 'feat/new-branch',
        col2: '',
        col3: '',
        col4: ''
      })
    } else if (diagramType === 'timeline') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: 'milestone',
        col1: 'Q4 - Next',
        col2: `Milestone ${nextIdx}`,
        col3: 'Key Deliverable',
        col4: ''
      })
    } else if (diagramType === 'gantt') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: payload === 'milestone' ? 'milestone' : 'active',
        col1: 'Delivery',
        col2: payload === 'milestone' ? `Release v${nextIdx}` : `Task ${nextIdx}`,
        col3: '2026-10-15',
        col4: payload === 'milestone' ? '0d' : '5d'
      })
    } else if (diagramType === 'journey') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: 'step',
        col1: 'Onboarding',
        col2: `User Action ${nextIdx}`,
        col3: '5',
        col4: 'User'
      })
    } else if (diagramType === 'sankey') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: 'flow',
        col1: 'API Gateway',
        col2: `Worker ${nextIdx}`,
        col3: '40',
        col4: ''
      })
    } else if (diagramType === 'xychart') {
      parsed.rows.push({
        id: `r-${Date.now()}`,
        kind: payload === 'line' ? 'line' : 'bar',
        col1: '35, 50, 65, 80, 95, 110',
        col2: '',
        col3: '',
        col4: ''
      })
    } else if (diagramType === 'c4') {
      if (payload === 'Rel') {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'Rel',
          col1: 'author',
          col2: 'klartext',
          col3: 'Interacts with',
          col4: ''
        })
      } else {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: payload,
          col1: `sys_${nextIdx}`,
          col2: `Component ${nextIdx}`,
          col3: 'System description',
          col4: ''
        })
      }
    } else if (diagramType === 'architecture') {
      if (payload === 'group') {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'group',
          col1: `zone${nextIdx}`,
          col2: 'cloud',
          col3: `Zone ${nextIdx}`,
          col4: ''
        })
      } else if (payload === 'edge') {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'edge',
          col1: 'api',
          col2: 'R --> L',
          col3: 'db',
          col4: ''
        })
      } else {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'service',
          col1: `svc${nextIdx}`,
          col2: 'server',
          col3: `Service ${nextIdx}`,
          col4: 'core'
        })
      }
    } else if (diagramType === 'block') {
      if (payload === 'link') {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: 'link',
          col1: 'Main',
          col2: `BLK${nextIdx}`,
          col3: '',
          col4: ''
        })
      } else {
        parsed.rows.push({
          id: `r-${Date.now()}`,
          kind: payload === 'db' ? 'db' : 'block',
          col1: `BLK${nextIdx}`,
          col2: `Module ${nextIdx}`,
          col3: '1',
          col4: ''
        })
      }
    }
    onChangeCode(buildMermaidFromVisualRows(diagramType, parsed.headerTitle, parsed.rows))
  }

  /* ------------------------------------------------------------------------
   * RENDER 1: SEQUENCE DIAGRAM VISUAL BUILDER
   * ------------------------------------------------------------------------ */
  if (diagramType === 'sequence') {
    const { autonumber, participants, steps } = parseSequenceCode(code)
    return (
      <div
        data-testid="mermaid-visual-sequence-builder"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropZoneFromPalette}
        className="flex-1 overflow-y-auto p-3 bg-panel border border-subtle rounded space-y-3 min-h-0"
      >
        {/* Participants Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase text-muted">
              1. Actors & Services (Drag to Reorder Lifelines)
            </span>
            <label className="flex items-center gap-1.5 text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={autonumber}
                onChange={(e) =>
                  onChangeCode(buildSequenceCode(e.target.checked, participants, steps))
                }
              />
              <span>Auto-number steps</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {participants.map((p, idx) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation()
                  if (dragIndex === null || dragIndex === idx) return
                  const next = [...participants]
                  const [moved] = next.splice(dragIndex, 1)
                  next.splice(idx, 0, moved)
                  setDragIndex(null)
                  onChangeCode(buildSequenceCode(autonumber, next, steps))
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary border border-subtle text-xs cursor-grab active:cursor-grabbing"
              >
                <span className="text-muted select-none">⋮⋮</span>
                <select
                  value={p.kind}
                  onChange={(e) => {
                    const next = participants.map((item, i) =>
                      i === idx ? { ...item, kind: e.target.value as 'actor' | 'participant' } : item
                    )
                    onChangeCode(buildSequenceCode(autonumber, next, steps))
                  }}
                  className="bg-panel border border-subtle rounded px-1 py-0.5 text-[11px] text-primary"
                >
                  <option value="actor">🧑 Actor</option>
                  <option value="participant">🖥️ Service</option>
                </select>
                <input
                  type="text"
                  value={p.label}
                  onChange={(e) => {
                    const next = participants.map((item, i) =>
                      i === idx ? { ...item, label: e.target.value } : item
                    )
                    onChangeCode(buildSequenceCode(autonumber, next, steps))
                  }}
                  className="w-28 px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary text-xs"
                  title={`ID: ${p.alias}`}
                />
                {participants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = participants.filter((_, i) => i !== idx)
                      onChangeCode(buildSequenceCode(autonumber, next, steps))
                    }}
                    className="text-danger hover:opacity-80 px-1"
                    title="Remove Participant"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Message Steps List */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase text-muted">
            2. Message & Interaction Flow (Drag Steps Vertically to Reorder)
          </div>
          <div className="space-y-1.5">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragIndex(1000 + idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation()
                  if (dragIndex === null || dragIndex < 1000) return
                  const fromIdx = dragIndex - 1000
                  if (fromIdx === idx) return
                  const next = [...steps]
                  const [moved] = next.splice(fromIdx, 1)
                  next.splice(idx, 0, moved)
                  setDragIndex(null)
                  onChangeCode(buildSequenceCode(autonumber, participants, next))
                }}
                className="flex flex-wrap items-center gap-1.5 p-2 rounded bg-app border border-subtle text-xs cursor-grab active:cursor-grabbing hover:border-accent/60"
              >
                <span className="text-muted font-mono text-[11px] w-5">
                  ⋮⋮ {idx + 1}.
                </span>
                <select
                  value={s.kind}
                  onChange={(e) => {
                    const next = steps.map((st, i) =>
                      i === idx ? { ...st, kind: e.target.value as 'message' | 'note' } : st
                    )
                    onChangeCode(buildSequenceCode(autonumber, participants, next))
                  }}
                  className="px-1.5 py-1 rounded bg-panel border border-subtle text-primary"
                >
                  <option value="message">Message</option>
                  <option value="note">Note</option>
                </select>
                <select
                  value={s.from}
                  onChange={(e) => {
                    const next = steps.map((st, i) =>
                      i === idx ? { ...st, from: e.target.value } : st
                    )
                    onChangeCode(buildSequenceCode(autonumber, participants, next))
                  }}
                  className="px-1.5 py-1 rounded bg-panel border border-subtle text-primary font-medium"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.alias}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {s.kind === 'message' && (
                  <select
                    value={s.arrow}
                    onChange={(e) => {
                      const next = steps.map((st, i) =>
                        i === idx
                          ? { ...st, arrow: e.target.value as SeqStep['arrow'] }
                          : st
                      )
                      onChangeCode(buildSequenceCode(autonumber, participants, next))
                    }}
                    className="px-1.5 py-1 rounded bg-panel border border-subtle text-accent font-mono"
                  >
                    <option value="->>">──▶ Solid Call (-&gt;&gt;)</option>
                    <option value="-->>">- -▶ Dashed Reply (--&gt;&gt;)</option>
                    <option value="->>+">──▶+ Call &amp; Activate</option>
                    <option value="-->>-">- -▶- Reply &amp; Deactivate</option>
                    <option value="-x">──✕ Async / Error (-x)</option>
                  </select>
                )}
                <select
                  value={s.to}
                  onChange={(e) => {
                    const next = steps.map((st, i) =>
                      i === idx ? { ...st, to: e.target.value } : st
                    )
                    onChangeCode(buildSequenceCode(autonumber, participants, next))
                  }}
                  className="px-1.5 py-1 rounded bg-panel border border-subtle text-primary font-medium"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.alias}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={s.text}
                  placeholder="Message payload or note..."
                  onChange={(e) => {
                    const next = steps.map((st, i) =>
                      i === idx ? { ...st, text: e.target.value } : st
                    )
                    onChangeCode(buildSequenceCode(autonumber, participants, next))
                  }}
                  className="flex-1 min-w-[140px] px-2 py-1 rounded bg-panel border border-subtle text-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = steps.filter((_, i) => i !== idx)
                    onChangeCode(buildSequenceCode(autonumber, participants, next))
                  }}
                  className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger hover:border-danger"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------------
   * RENDER 2: KANBAN BOARD DRAG-AND-DROP VISUAL BUILDER
   * ------------------------------------------------------------------------ */
  if (diagramType === 'kanban') {
    const cols = parseKanbanCode(code)
    return (
      <div
        data-testid="mermaid-visual-kanban-builder"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropZoneFromPalette}
        className="flex-1 overflow-x-auto overflow-y-auto p-3 bg-panel border border-subtle rounded min-h-0"
      >
        <div className="text-[11px] font-semibold uppercase text-muted mb-2">
          Interactive Kanban Board (Drag &amp; Drop Cards Across Columns or Click + to Add)
        </div>
        <div className="flex gap-3 items-start min-w-max">
          {cols.map((col, colIdx) => (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation()
                if (!dragKanbanCard) return
                const nextCols = cols.map((c) => ({ ...c, cards: [...c.cards] }))
                const [moved] = nextCols[dragKanbanCard.colIdx].cards.splice(
                  dragKanbanCard.cardIdx,
                  1
                )
                if (moved) {
                  nextCols[colIdx].cards.push(moved)
                  setDragKanbanCard(null)
                  onChangeCode(buildKanbanCode(nextCols))
                }
              }}
              className="w-60 rounded-md bg-secondary/70 border border-subtle p-2.5 flex flex-col gap-2 shrink-0"
            >
              <div className="flex items-center justify-between gap-1">
                <input
                  type="text"
                  value={col.name}
                  onChange={(e) => {
                    const next = cols.map((c, i) =>
                      i === colIdx ? { ...c, name: e.target.value } : c
                    )
                    onChangeCode(buildKanbanCode(next))
                  }}
                  className="font-semibold text-xs px-2 py-1 rounded bg-panel border border-subtle text-primary flex-1"
                />
                {cols.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = cols.filter((_, i) => i !== colIdx)
                      onChangeCode(buildKanbanCode(next))
                    }}
                    className="px-1.5 py-0.5 text-xs text-danger hover:opacity-80"
                    title="Delete Column"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="space-y-2 min-h-[48px]">
                {col.cards.map((card, cardIdx) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragKanbanCard({ colIdx, cardIdx })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation()
                      if (!dragKanbanCard) return
                      const nextCols = cols.map((c) => ({ ...c, cards: [...c.cards] }))
                      const [moved] = nextCols[dragKanbanCard.colIdx].cards.splice(
                        dragKanbanCard.cardIdx,
                        1
                      )
                      if (moved) {
                        nextCols[colIdx].cards.splice(cardIdx, 0, moved)
                        setDragKanbanCard(null)
                        onChangeCode(buildKanbanCode(nextCols))
                      }
                    }}
                    className="p-2 rounded bg-panel border border-subtle shadow-2xs space-y-1.5 cursor-grab active:cursor-grabbing hover:border-accent"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-muted text-[10px]">⋮⋮</span>
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => {
                          const nextCols = cols.map((c, ci) =>
                            ci === colIdx
                              ? {
                                  ...c,
                                  cards: c.cards.map(( item, ki) =>
                                    ki === cardIdx ? { ...item, title: e.target.value } : item
                                  )
                                }
                              : c
                          )
                          onChangeCode(buildKanbanCode(nextCols))
                        }}
                        className="flex-1 text-xs font-medium px-1.5 py-0.5 rounded bg-app border border-subtle text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextCols = cols.map((c, ci) =>
                            ci === colIdx
                              ? { ...c, cards: c.cards.filter((_, ki) => ki !== cardIdx) }
                              : c
                          )
                          onChangeCode(buildKanbanCode(nextCols))
                        }}
                        className="text-danger text-xs px-1"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <input
                        type="text"
                        placeholder="@owner"
                        value={card.assigned}
                        onChange={(e) => {
                          const nextCols = cols.map((c, ci) =>
                            ci === colIdx
                              ? {
                                  ...c,
                                  cards: c.cards.map((item, ki) =>
                                    ki === cardIdx ? { ...item, assigned: e.target.value } : item
                                  )
                                }
                              : c
                          )
                          onChangeCode(buildKanbanCode(nextCols))
                        }}
                        className="w-24 px-1.5 py-0.5 rounded bg-app border border-subtle text-primary"
                      />
                      <select
                        value={card.priority}
                        onChange={(e) => {
                          const nextCols = cols.map((c, ci) =>
                            ci === colIdx
                              ? {
                                  ...c,
                                  cards: c.cards.map((item, ki) =>
                                    ki === cardIdx
                                      ? {
                                          ...item,
                                          priority: e.target.value as KanbanCardItem['priority']
                                        }
                                      : item
                                  )
                                }
                              : c
                          )
                          onChangeCode(buildKanbanCode(nextCols))
                        }}
                        className="flex-1 px-1 py-0.5 rounded bg-app border border-subtle text-primary"
                      >
                        <option value="Very High">🔥 Very High</option>
                        <option value="High">⬆️ High</option>
                        <option value="Normal">• Normal</option>
                        <option value="Low">⬇️ Low</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextCols = cols.map((c, ci) =>
                    ci === colIdx
                      ? {
                          ...c,
                          cards: [
                            ...c.cards,
                            {
                              id: `card-${Date.now()}`,
                              title: `Task ${c.cards.length + 1}`,
                              assigned: '',
                              priority: 'Normal' as const
                            }
                          ]
                        }
                      : c
                  )
                  onChangeCode(buildKanbanCode(nextCols))
                }}
                className="w-full py-1 rounded bg-panel border border-dashed border-subtle hover:border-accent text-xs text-accent font-medium"
              >
                + Add Card to {col.name}
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------------
   * RENDER 3: PACKET BIT-GRID DRAG-AND-DROP VISUAL BUILDER
   * ------------------------------------------------------------------------ */
  if (diagramType === 'packet') {
    const { title, fields } = parsePacketCode(code)
    let runningBit = 0
    return (
      <div
        data-testid="mermaid-visual-packet-builder"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropZoneFromPalette}
        className="flex-1 overflow-y-auto p-3 bg-panel border border-subtle rounded space-y-3 min-h-0"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase text-[11px] text-muted">
              Packet Header Title:
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => onChangeCode(buildPacketCode(e.target.value, fields))}
              className="px-2 py-1 rounded bg-app border border-subtle text-primary font-medium"
            />
          </div>
          <span className="text-[11px] text-muted">
            Drag bit-fields to reorder • Bit offsets auto-align to 32-bit rows
          </span>
        </div>

        <div className="grid grid-cols-12 gap-2">
          {fields.map((f, idx) => {
            const start = runningBit
            const end = runningBit + Math.max(1, f.bits) - 1
            runningBit = end + 1
            const colSpan =
              f.bits >= 32 ? 'col-span-12' : f.bits >= 16 ? 'col-span-6' : f.bits >= 8 ? 'col-span-4' : 'col-span-3'
            return (
              <div
                key={f.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation()
                  if (dragIndex === null || dragIndex === idx) return
                  const next = [...fields]
                  const [moved] = next.splice(dragIndex, 1)
                  next.splice(idx, 0, moved)
                  setDragIndex(null)
                  onChangeCode(buildPacketCode(title, next))
                }}
                className={`${colSpan} p-2 rounded bg-app border border-subtle hover:border-accent flex flex-col gap-1 cursor-grab active:cursor-grabbing`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-accent">
                  <span>
                    ⋮⋮ Bits {start === end ? start : `${start}–${end}`} ({f.bits}b)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = fields.filter((_, i) => i !== idx)
                      onChangeCode(buildPacketCode(title, next))
                    }}
                    className="text-danger hover:opacity-80"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => {
                      const next = fields.map((item, i) =>
                        i === idx ? { ...item, label: e.target.value } : item
                      )
                      onChangeCode(buildPacketCode(title, next))
                    }}
                    className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-panel border border-subtle text-xs text-primary"
                  />
                  <select
                    value={String(f.bits)}
                    onChange={(e) => {
                      const next = fields.map((item, i) =>
                        i === idx ? { ...item, bits: parseInt(e.target.value, 10) || 16 } : item
                      )
                      onChangeCode(buildPacketCode(title, next))
                    }}
                    className="px-1 py-0.5 rounded bg-panel border border-subtle text-[11px] text-primary font-mono"
                  >
                    <option value="1">1b</option>
                    <option value="4">4b</option>
                    <option value="6">6b</option>
                    <option value="8">8b</option>
                    <option value="16">16b</option>
                    <option value="32">32b</option>
                    <option value="64">64b</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------------
   * RENDER 4: QUADRANT 2x2 INTERACTIVE DRAG-AND-DROP MATRIX CANVAS
   * ------------------------------------------------------------------------ */
  if (diagramType === 'quadrant') {
    const model = parseQuadrantCode(code)
    return (
      <div
        data-testid="mermaid-visual-quadrant-builder"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropZoneFromPalette}
        className="flex-1 overflow-y-auto p-3 bg-panel border border-subtle rounded space-y-3 min-h-0"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-muted font-semibold">Matrix Title:</label>
          <input
            type="text"
            value={model.title}
            onChange={(e) => onChangeCode(buildQuadrantCode({ ...model, title: e.target.value }))}
            className="flex-1 px-2 py-1 rounded bg-app border border-subtle text-primary"
          />
        </div>

        {/* Interactive 2D 2x2 Drag Matrix */}
        <div
          onMouseMove={(e) => {
            if (!draggingQuadPointId) return
            const rect = e.currentTarget.getBoundingClientRect()
            const nx = Math.min(0.96, Math.max(0.04, (e.clientX - rect.left) / rect.width))
            const ny = Math.min(0.96, Math.max(0.04, 1 - (e.clientY - rect.top) / rect.height))
            const nextPts = model.points.map((pt) =>
              pt.id === draggingQuadPointId ? { ...pt, x: nx, y: ny } : pt
            )
            onChangeCode(buildQuadrantCode({ ...model, points: nextPts }))
          }}
          onMouseUp={() => setDraggingQuadPointId(null)}
          onMouseLeave={() => setDraggingQuadPointId(null)}
          className="relative w-full h-56 rounded border border-subtle bg-app overflow-hidden select-none"
        >
          {/* 4 Quadrant Quadrants */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
            <div className="border-r border-b border-subtle p-2 text-[10px] font-semibold text-muted">
              Q2: {model.q2}
            </div>
            <div className="border-b border-subtle p-2 text-[10px] font-semibold text-accent text-right">
              Q1: {model.q1}
            </div>
            <div className="border-r border-subtle p-2 text-[10px] font-semibold text-muted flex items-end">
              Q3: {model.q3}
            </div>
            <div className="p-2 text-[10px] font-semibold text-muted flex items-end justify-end">
              Q4: {model.q4}
            </div>
          </div>

          {/* Draggable Data Points */}
          {model.points.map((pt) => (
            <div
              key={pt.id}
              onMouseDown={(e) => {
                e.stopPropagation()
                setDraggingQuadPointId(pt.id)
              }}
              style={{
                left: `${pt.x * 100}%`,
                top: `${(1 - pt.y) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-medium shadow cursor-move whitespace-nowrap"
              title="Drag to position on 2x2 Quadrant Matrix"
            >
              🎯 {pt.label}
            </div>
          ))}
        </div>

        {/* Point List Editor */}
        <div className="space-y-1.5">
          {model.points.map((pt, idx) => (
            <div key={pt.id} className="flex items-center gap-2 text-xs bg-app p-1.5 rounded border border-subtle">
              <input
                type="text"
                value={pt.label}
                onChange={(e) => {
                  const nextPts = model.points.map((item, i) =>
                    i === idx ? { ...item, label: e.target.value } : item
                  )
                  onChangeCode(buildQuadrantCode({ ...model, points: nextPts }))
                }}
                className="flex-1 px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
              />
              <span className="font-mono text-[11px] text-muted">
                X: {Math.round(pt.x * 100)}% • Y: {Math.round(pt.y * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextPts = model.points.filter((_, i) => i !== idx)
                  onChangeCode(buildQuadrantCode({ ...model, points: nextPts }))
                }}
                className="px-1.5 text-danger"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------------
   * RENDER 5: PIE CHART DRAG-AND-DROP SLICE BUILDER
   * ------------------------------------------------------------------------ */
  if (diagramType === 'pie') {
    const { title, showData, slices } = parsePieCode(code)
    return (
      <div
        data-testid="mermaid-visual-pie-builder"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropZoneFromPalette}
        className="flex-1 overflow-y-auto p-3 bg-panel border border-subtle rounded space-y-3 min-h-0"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <input
            type="text"
            value={title}
            onChange={(e) => onChangeCode(buildPieCode(e.target.value, showData, slices))}
            className="flex-1 px-2 py-1 rounded bg-app border border-subtle text-primary font-medium"
          />
          <label className="flex items-center gap-1.5 text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={showData}
              onChange={(e) => onChangeCode(buildPieCode(title, e.target.checked, slices))}
            />
            <span>Show Values</span>
          </label>
        </div>

        <div className="space-y-1.5">
          {slices.map((s, idx) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation()
                if (dragIndex === null || dragIndex === idx) return
                const next = [...slices]
                const [moved] = next.splice(dragIndex, 1)
                next.splice(idx, 0, moved)
                setDragIndex(null)
                onChangeCode(buildPieCode(title, showData, next))
              }}
              className="flex items-center gap-2 p-2 rounded bg-app border border-subtle text-xs cursor-grab active:cursor-grabbing"
            >
              <span className="text-muted">⋮⋮</span>
              <input
                type="text"
                value={s.label}
                onChange={(e) => {
                  const next = slices.map((item, i) =>
                    i === idx ? { ...item, label: e.target.value } : item
                  )
                  onChangeCode(buildPieCode(title, showData, next))
                }}
                className="w-40 px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
              />
              <input
                type="range"
                min="1"
                max="200"
                value={s.value}
                onChange={(e) => {
                  const next = slices.map((item, i) =>
                    i === idx ? { ...item, value: parseFloat(e.target.value) || 1 } : item
                  )
                  onChangeCode(buildPieCode(title, showData, next))
                }}
                className="flex-1 accent-[#3B7A57]"
              />
              <input
                type="number"
                value={s.value}
                onChange={(e) => {
                  const next = slices.map((item, i) =>
                    i === idx ? { ...item, value: parseFloat(e.target.value) || 1 } : item
                  )
                  onChangeCode(buildPieCode(title, showData, next))
                }}
                className="w-16 px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const next = slices.filter((_, i) => i !== idx)
                  onChangeCode(buildPieCode(title, showData, next))
                }}
                className="text-danger px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------------
   * RENDER 6: UNIFIED DRAG-AND-DROP VISUAL CARD/ROW BUILDER FOR ALL OTHER TYPES
   * (ER, Class, State, Mindmap, GitGraph, Timeline, Gantt, Journey, Sankey, XYChart, C4, Architecture, Block)
   * ------------------------------------------------------------------------ */
  const { headerTitle, rows } = parseDiagramToVisualRows(diagramType, code)
  const showHeaderInput = ['mindmap', 'timeline', 'journey', 'gantt', 'xychart', 'c4', 'block'].includes(
    diagramType
  )

  return (
    <div
      data-testid={`mermaid-visual-${diagramType}-builder`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropZoneFromPalette}
      className="flex-1 overflow-y-auto p-3 bg-panel border border-subtle rounded space-y-2.5 min-h-0"
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold uppercase text-muted">
          Interactive Visual {diagramType.toUpperCase()} Builder (Drag Cards to Reorder or Drop from Palette)
        </span>
      </div>

      {showHeaderInput && (
        <div className="flex items-center gap-2 text-xs bg-secondary/50 p-2 rounded border border-subtle">
          <span className="text-muted font-medium">
            {diagramType === 'mindmap'
              ? 'Central Root Topic:'
              : diagramType === 'block'
                ? 'Grid Columns (1–6):'
                : 'Diagram Title:'}
          </span>
          <input
            type={diagramType === 'block' ? 'number' : 'text'}
            value={headerTitle}
            onChange={(e) =>
              onChangeCode(buildMermaidFromVisualRows(diagramType, e.target.value, rows))
            }
            className="flex-1 px-2 py-0.5 rounded bg-panel border border-subtle text-primary font-medium"
          />
        </div>
      )}

      <div className="space-y-1.5">
        {rows.map((r, idx) => (
          <div
            key={r.id}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation()
              if (dragIndex === null || dragIndex === idx) return
              const next = [...rows]
              const [moved] = next.splice(dragIndex, 1)
              next.splice(idx, 0, moved)
              setDragIndex(null)
              onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
            }}
            className="flex flex-wrap items-center gap-1.5 p-2 rounded bg-app border border-subtle hover:border-accent/60 text-xs cursor-grab active:cursor-grabbing"
          >
            <span className="text-muted font-mono text-[11px] select-none">⋮⋮</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary border border-subtle text-accent font-mono text-[10px] uppercase">
              {r.kind}
            </span>

            {diagramType === 'mindmap' ? (
              <>
                <select
                  value={r.col1}
                  onChange={(e) => {
                    const next = rows.map((item, i) =>
                      i === idx ? { ...item, col1: e.target.value } : item
                    )
                    onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
                  }}
                  className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary"
                >
                  <option value="1">Level 1 (Main Branch)</option>
                  <option value="2">↳ Level 2 (Sub-topic)</option>
                  <option value="3">↳↳ Level 3 (Leaf)</option>
                </select>
                <input
                  type="text"
                  value={r.col2}
                  onChange={(e) => {
                    const next = rows.map((item, i) =>
                      i === idx ? { ...item, col2: e.target.value } : item
                    )
                    onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
                  }}
                  className="flex-1 px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
                />
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={r.col1}
                  placeholder="Source / Group / Key"
                  onChange={(e) => {
                    const next = rows.map((item, i) =>
                      i === idx ? { ...item, col1: e.target.value } : item
                    )
                    onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
                  }}
                  className="w-32 px-2 py-0.5 rounded bg-panel border border-subtle text-primary font-medium"
                />
                {(r.col2 !== '' ||
                  ['state', 'er', 'class', 'gitGraph', 'timeline', 'gantt', 'journey', 'sankey', 'c4', 'architecture', 'block'].includes(
                    diagramType
                  )) && (
                  <input
                    type="text"
                    value={r.col2}
                    placeholder="Target / Type / Label"
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === idx ? { ...item, col2: e.target.value } : item
                      )
                      onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
                    }}
                    className="flex-1 min-w-[110px] px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
                  />
                )}
                {(r.col3 !== '' ||
                  ['state', 'er', 'class', 'timeline', 'gantt', 'journey', 'sankey', 'c4', 'architecture', 'block'].includes(
                    diagramType
                  )) && (
                  <input
                    type="text"
                    value={r.col3}
                    placeholder="Value / Label / Date"
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === idx ? { ...item, col3: e.target.value } : item
                      )
                      onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
                    }}
                    className="w-32 px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
                  />
                )}
                {(r.col4 !== '' || ['er', 'class', 'gantt', 'journey', 'architecture'].includes(diagramType)) && (
                  <input
                    type="text"
                    value={r.col4}
                    placeholder="Extra / Duration / Role"
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === idx ? { ...item, col4: e.target.value } : item
                      )
                      onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
                    }}
                    className="w-24 px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
                  />
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                const next = rows.filter((_, i) => i !== idx)
                onChangeCode(buildMermaidFromVisualRows(diagramType, headerTitle, next))
              }}
              className="px-1.5 text-danger hover:opacity-80"
              title="Delete Row"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
