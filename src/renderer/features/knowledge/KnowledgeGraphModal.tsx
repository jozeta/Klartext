import React, { useMemo, useState } from 'react'
import {
  Compass,
  RotateCcw,
  Search,
  Tag,
  X,
  ZoomIn,
  ZoomOut
} from '../../components/icons/untitled-icons'
import {
  buildKnowledgeGraph,
  type WorkspaceDocEntry
} from '../../../shared/markdown/knowledge-features'

export interface KnowledgeGraphModalProps {
  open: boolean
  documents: WorkspaceDocEntry[]
  activeDocKey: string | null
  onSelectDocument: (rootId: string, relativePath: string) => void
  onClose: () => void
}

export const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  open,
  documents,
  activeDocKey,
  onSelectDocument,
  onClose
}) => {
  const [mode, setMode] = useState<'global' | 'local'>('global')
  const [includeTags, setIncludeTags] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [draggingCanvas, setDraggingCanvas] = useState<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const graph = useMemo(
    () =>
      buildKnowledgeGraph({
        documents,
        includeTags,
        mode,
        activeDocKey,
        searchQuery
      }),
    [documents, includeTags, mode, activeDocKey, searchQuery]
  )

  if (!open) return null

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const connectedToHovered = new Set<string>()
  if (hoveredNodeId) {
    connectedToHovered.add(hoveredNodeId)
    for (const e of graph.edges) {
      if (e.source === hoveredNodeId) connectedToHovered.add(e.target)
      if (e.target === hoveredNodeId) connectedToHovered.add(e.source)
    }
  }

  return (
    <div
      data-testid="graph-view-modal"
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[82vh] bg-panel border border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div className="px-4 py-2.5 bg-secondary border-b border-subtle flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Compass className="w-4 h-4 text-accent" />
            <span>Interactive Knowledge Graph (2D)</span>
            <span className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] font-mono text-muted">
              {graph.nodes.filter((n) => n.type === 'document').length} docs ·{' '}
              {graph.edges.length} links
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Global vs Local Graph Toggle */}
            <div className="inline-flex rounded border border-subtle bg-panel p-0.5">
              <button
                type="button"
                data-testid="graph-mode-global"
                onClick={() => setMode('global')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  mode === 'global'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Global Graph
              </button>
              <button
                type="button"
                data-testid="graph-mode-local"
                onClick={() => setMode('local')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  mode === 'local'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Local Graph (Active Note)
              </button>
            </div>

            {/* Include Tags Toggle */}
            <button
              type="button"
              data-testid="graph-toggle-tags"
              onClick={() => setIncludeTags((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                includeTags
                  ? 'bg-accent/15 text-accent border-accent/40'
                  : 'bg-panel text-muted border-subtle hover:text-primary'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>#Tags</span>
            </button>

            {/* Filter Input */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-testid="graph-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter nodes or #tags..."
                className="w-full pl-7 pr-2 py-1 rounded bg-panel border border-subtle text-primary text-xs focus:outline-none focus:border-accent"
              />
            </div>

            {/* Zoom Controls */}
            <div className="inline-flex items-center gap-0.5 bg-panel border border-subtle rounded px-1 py-0.5">
              <button
                type="button"
                title="Zoom Out"
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-muted px-1">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                title="Zoom In"
                onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.15).toFixed(2))))}
                className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Reset View"
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              data-testid="close-graph-view-btn"
              onClick={onClose}
              className="p-1 rounded hover:bg-panel text-muted hover:text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive 2D Graph Canvas */}
        <div
          className="flex-1 relative bg-app overflow-hidden select-none cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-graph-node="true"]')) return
            setDraggingCanvas({
              startX: e.clientX,
              startY: e.clientY,
              originX: pan.x,
              originY: pan.y
            })
          }}
          onMouseMove={(e) => {
            if (!draggingCanvas) return
            setPan({
              x: draggingCanvas.originX + (e.clientX - draggingCanvas.startX),
              y: draggingCanvas.originY + (e.clientY - draggingCanvas.startY)
            })
          }}
          onMouseUp={() => setDraggingCanvas(null)}
          onMouseLeave={() => setDraggingCanvas(null)}
        >
          <svg
            data-testid="graph-svg-canvas"
            viewBox="0 0 900 560"
            className="w-full h-full"
          >
            <g
              transform={`translate(${pan.x}, ${pan.y}) translate(450, 280) scale(${zoom}) translate(-450, -280)`}
            >
              {/* Edges */}
              {graph.edges.map((edge) => {
                const source = nodeById.get(edge.source)
                const target = nodeById.get(edge.target)
                if (!source || !target) return null
                const isDimmed =
                  hoveredNodeId !== null &&
                  edge.source !== hoveredNodeId &&
                  edge.target !== hoveredNodeId
                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={edge.kind === 'tag' ? '#D97706' : 'var(--accent-primary)'}
                    strokeWidth={edge.kind === 'tag' ? 1.2 : 1.75}
                    strokeDasharray={edge.kind === 'tag' ? '4 3' : undefined}
                    strokeOpacity={isDimmed ? 0.15 : 0.65}
                  />
                )
              })}

              {/* Nodes */}
              {graph.nodes.map((node) => {
                const isActive = node.id === activeDocKey
                const isDimmed =
                  hoveredNodeId !== null && !connectedToHovered.has(node.id)
                const radius =
                  node.type === 'tag'
                    ? 7
                    : Math.min(16, 8 + Math.round(node.degree * 1.4))

                const testId =
                  node.type === 'document'
                    ? `graph-node-doc-${node.rootId}-${node.relativePath}`
                    : `graph-node-tag-${node.label.replace(/^#+/, '')}`

                return (
                  <g
                    key={node.id}
                    data-graph-node="true"
                    data-testid={testId}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ opacity: isDimmed ? 0.25 : 1, cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => {
                      if (node.type === 'document' && node.rootId && node.relativePath) {
                        onSelectDocument(node.rootId, node.relativePath)
                        onClose()
                      } else if (node.type === 'tag') {
                        setSearchQuery(node.label)
                      }
                    }}
                  >
                    {isActive && (
                      <circle
                        r={radius + 5}
                        fill="none"
                        stroke="var(--accent-primary)"
                        strokeWidth={2}
                        strokeDasharray="3 2"
                      />
                    )}
                    <circle
                      r={radius}
                      fill={
                        node.type === 'tag'
                          ? '#D97706'
                          : isActive
                            ? 'var(--accent-primary)'
                            : '#4B5865'
                      }
                      stroke="var(--bg-panel)"
                      strokeWidth={2}
                    />
                    <text
                      y={radius + 13}
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize={node.type === 'tag' ? 10 : 11}
                      fontWeight={isActive ? 700 : 500}
                    >
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Legend Footer */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none text-[11px] text-muted">
            <div className="flex items-center gap-4 bg-panel/90 border border-subtle rounded px-3 py-1.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
                <span>Active Document</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4B5865] inline-block" />
                <span>Workspace Note (click to open)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] inline-block" />
                <span>#Tag Node (click to filter)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
