import { describe, expect, it } from 'vitest'
import {
  buildKnowledgeGraph,
  detectMarkdownTableAtPosition,
  extractGlobalTasks,
  extractHeadingSectionFromMarkdown,
  findUnlinkedMentions,
  linkUnlinkedMentionInContent,
  manipulateMarkdownTable,
  refactorWikiLinksOnRename,
  resolveTransclusionsInMarkdown,
  toggleTaskAtLineInMarkdown,
  type WorkspaceDocEntry
} from '../../shared/markdown/knowledge-features'

const sampleDocs: WorkspaceDocEntry[] = [
  {
    rootId: 'root-1',
    rootName: 'Docs',
    relativePath: 'Architecture.md',
    name: 'Architecture.md',
    title: 'Architecture',
    content: [
      '---',
      'tags:',
      '  - "#architecture"',
      '  - "#backend"',
      '---',
      '# Architecture Overview',
      '',
      'See [[Roadmap]] and [[Security Policy|Security]] for details.',
      '',
      '## Database Layer',
      'PostgreSQL is used for relational storage.',
      '',
      '## API Gateway',
      'GraphQL + REST endpoints.',
      '',
      '- [ ] Review database schema #architecture',
      '- [x] Setup CI pipeline #devops'
    ].join('\n'),
    tags: ['#architecture', '#backend']
  },
  {
    rootId: 'root-1',
    rootName: 'Docs',
    relativePath: 'Roadmap.md',
    name: 'Roadmap.md',
    title: 'Roadmap',
    content: [
      '---',
      'tags:',
      '  - "#roadmap"',
      '  - "#architecture"',
      '---',
      '# Q4 Roadmap',
      '',
      'Our Architecture team is planning the next milestone.',
      '',
      '![[Architecture#Database Layer]]',
      '',
      '- [ ] Ship v2.0 release #roadmap'
    ].join('\n'),
    tags: ['#roadmap', '#architecture']
  },
  {
    rootId: 'root-1',
    rootName: 'Docs',
    relativePath: 'Security Policy.md',
    name: 'Security Policy.md',
    title: 'Security Policy',
    content: '# Security Policy\n\nAll services follow zero-trust Architecture guidelines.\n'
  }
]

describe('1.1 Interactive 2D Knowledge Graph Builder', () => {
  it('builds global graph with document nodes, tag nodes, and wikilink/tag edges', () => {
    const graph = buildKnowledgeGraph({
      documents: sampleDocs,
      includeTags: true,
      mode: 'global'
    })

    const docNodes = graph.nodes.filter((n) => n.type === 'document')
    const tagNodes = graph.nodes.filter((n) => n.type === 'tag')
    expect(docNodes.length).toBe(3)
    expect(tagNodes.length).toBeGreaterThanOrEqual(3)

    const wikiEdges = graph.edges.filter((e) => e.kind === 'wikilink')
    expect(wikiEdges.length).toBe(3)
  })

  it('filters local graph around active document and supports search query', () => {
    const localGraph = buildKnowledgeGraph({
      documents: sampleDocs,
      includeTags: false,
      mode: 'local',
      activeDocKey: 'root-1::Architecture.md',
      searchQuery: 'Roadmap'
    })

    expect(localGraph.nodes.some((n) => n.label === 'Roadmap')).toBe(true)
  })
})

describe('1.2 Note Transclusion (![[Note]] and ![[Note#Heading]])', () => {
  it('extracts a specific heading section from Markdown', () => {
    const section = extractHeadingSectionFromMarkdown(sampleDocs[0].content, 'Database Layer')
    expect(section).toContain('## Database Layer')
    expect(section).toContain('PostgreSQL is used for relational storage.')
    expect(section).not.toContain('## API Gateway')
  })

  it('resolves ![[Architecture#Database Layer]] inline in Markdown', () => {
    const resolved = resolveTransclusionsInMarkdown(sampleDocs[1].content, sampleDocs)
    expect(resolved).toContain('Embedded: [[Architecture|Architecture › Database Layer]]')
    expect(resolved).toContain('> PostgreSQL is used for relational storage.')
  })
})

describe('1.3 Unlinked Mentions & Automatic WikiLink Refactoring on Rename', () => {
  it('finds unlinked plain-text mentions of the active note title outside existing links', () => {
    const mentions = findUnlinkedMentions({
      activeDocTitle: 'Architecture',
      activeRootId: 'root-1',
      activeRelativePath: 'Architecture.md',
      documents: sampleDocs
    })

    // Both Roadmap.md and Security Policy.md mention "Architecture" in plain text
    expect(mentions.length).toBe(2)
    expect(mentions[0].sourceRelativePath).toBe('Roadmap.md')
  })

  it('converts an unlinked mention into a [[WikiLink]] on the target line', () => {
    const updated = linkUnlinkedMentionInContent(
      'Our Architecture team is planning the next milestone.',
      1,
      'Architecture'
    )
    expect(updated).toBe('Our [[Architecture]] team is planning the next milestone.')
  })

  it('refactors [[WikiLinks]] and ![[Transclusions]] when a file is renamed', () => {
    const source =
      'See [[Architecture]] and ![[Architecture#Database Layer]] and [[Architecture|System Design]].'
    const res = refactorWikiLinksOnRename(source, 'Architecture.md', 'System-Architecture.md')
    expect(res.changed).toBe(true)
    expect(res.nextContent).toBe(
      'See [[System-Architecture]] and ![[System-Architecture#Database Layer]] and [[System-Architecture|System Design]].'
    )
  })
})

describe('2.2 Interactive Table Editor Operations', () => {
  const sampleTable = [
    '| Name | Score |',
    '| --- | --- |',
    '| Bob | 20 |',
    '| Alice | 10 |'
  ].join('\n')

  it('detects table dimensions and active row/col at cursor offset', () => {
    const cursorInBob = sampleTable.indexOf('Bob')
    const detected = detectMarkdownTableAtPosition(sampleTable, cursorInBob)
    expect(detected).not.toBeNull()
    expect(detected?.colCount).toBe(2)
    expect(detected?.rowCount).toBe(4)
    expect(detected?.activeRowIndex).toBe(2)
    expect(detected?.activeColIndex).toBe(0)
  })

  it('adds rows, adds columns, aligns columns, and sorts rows ascending/descending', () => {
    const cursorInBob = sampleTable.indexOf('Bob')
    const sortedAsc = manipulateMarkdownTable(sampleTable, cursorInBob, 'sort-asc')
    const aliceIdx = sortedAsc.indexOf('Alice')
    const bobIdx = sortedAsc.indexOf('Bob')
    expect(aliceIdx).toBeLessThan(bobIdx)

    const withNewCol = manipulateMarkdownTable(sampleTable, cursorInBob, 'add-col-right')
    expect(withNewCol).toContain('Column 2')
  })
})

describe('3.2 Global Task Aggregation & Toggling', () => {
  it('extracts all open and completed tasks across workspace documents', () => {
    const tasks = extractGlobalTasks(sampleDocs)
    expect(tasks.length).toBe(3)
    expect(tasks.filter((t) => !t.checked).length).toBe(2)
    expect(tasks.filter((t) => t.checked).length).toBe(1)
    expect(tasks[0].tags).toContain('#architecture')
  })

  it('toggles a task checkbox state at a specific 1-based line number', () => {
    const md = '# Tasks\n- [ ] First task\n- [x] Second task'
    const toggled1 = toggleTaskAtLineInMarkdown(md, 2)
    expect(toggled1).toContain('- [x] First task')
    const toggled2 = toggleTaskAtLineInMarkdown(toggled1, 3)
    expect(toggled2).toContain('- [ ] Second task')
  })
})
