import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import {
  MousePointer,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Type,
  Trash2,
  GitCommit,
  Check
} from 'lucide-react'
import {
  createDefaultExcalidrawScene,
  serializeExcalidrawSvg,
  sanitizeSvgContent,
  type ExcalidrawElementItem,
  type ExcalidrawSceneData
} from '../../../shared/serialization/excalidraw-svg'

let mermaidInitialized = false

function ensureMermaidInit(theme: 'light' | 'dark') {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'neutral',
    fontFamily: 'Inter, -apple-system, sans-serif'
  })
  mermaidInitialized = true
}

export const MermaidDiagramWidget: React.FC<{
  code: string
  theme: 'light' | 'dark'
  onUpdateCode?: (newCode: string) => void
  onOpenVisualBuilder?: (currentCode: string) => void
}> = ({ code, theme, onUpdateCode, onOpenVisualBuilder }) => {
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [editingSource, setEditingSource] = useState(false)
  const [draftCode, setDraftCode] = useState(code)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setDraftCode(code)
  }, [code])

  useEffect(() => {
    let cancelled = false
    const renderDiagram = async () => {
      try {
        if (!mermaidInitialized) {
          ensureMermaidInit(theme)
        } else {
          ensureMermaidInit(theme)
        }
        const id = `klartext-mermaid-${Math.random().toString(36).slice(2, 10)}`
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) {
          setSvgHtml(sanitizeSvgContent(svg))
          setErrorMsg(null)
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Invalid Mermaid syntax')
        }
      }
    }
    renderDiagram()
    return () => {
      cancelled = true
    }
  }, [code, theme])

  return (
    <div
      className={`my-3 rounded-md border border-subtle bg-panel overflow-hidden ${
        expanded ? 'fixed inset-6 z-50 flex flex-col shadow-xl' : ''
      }`}
      data-testid="mermaid-widget"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary border-b border-subtle text-xs">
        <span className="font-medium text-muted">Mermaid Diagram</span>
        <div className="flex items-center gap-2">
          {onOpenVisualBuilder && (
            <button
              type="button"
              data-testid="mermaid-open-visual-builder"
              onClick={() => onOpenVisualBuilder(code)}
              className="px-2 py-0.5 rounded bg-accent text-white font-medium hover:opacity-90"
            >
              Visual Builder
            </button>
          )}
          <button
            type="button"
            data-testid="mermaid-toggle-source"
            onClick={() => setEditingSource((v) => !v)}
            className="px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary"
          >
            {editingSource ? 'Hide Source' : 'Edit Source'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary"
          >
            {expanded ? 'Minimize' : 'Expand'}
          </button>
        </div>
      </div>

      {editingSource && (
        <div className="p-2.5 bg-app border-b border-subtle">
          <textarea
            data-testid="mermaid-source-textarea"
            value={draftCode}
            onChange={(e) => {
              setDraftCode(e.target.value)
              onUpdateCode?.(e.target.value)
            }}
            rows={4}
            className="w-full p-2 text-xs font-mono bg-panel text-primary border border-subtle rounded focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {errorMsg && (
        <div
          data-testid="mermaid-error-banner"
          className="px-3 py-2 text-xs bg-secondary border-b border-subtle text-danger font-mono"
        >
          Mermaid Syntax Diagnostic: {errorMsg}
        </div>
      )}

      <div
        className="p-4 flex justify-center items-center overflow-auto"
        data-testid="mermaid-svg-container"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  )
}

/* ============================================================================
 * VISUAL MERMAID DIAGRAM BUILDER (Draws Nodes & Arrows -> Writes Mermaid Code)
 * ============================================================================ */

export type VisualMermaidNodeShape = 'rect' | 'round' | 'diamond' | 'cylinder' | 'circle'
export type VisualMermaidEdgeStyle = '-->' | '-.->' | '==>'

export interface VisualMermaidNode {
  id: string
  label: string
  shape: VisualMermaidNodeShape
  x: number
  y: number
}

export interface VisualMermaidEdge {
  id: string
  from: string
  to: string
  style: VisualMermaidEdgeStyle
  label: string
}

export function generateMermaidFromVisualGraph(
  direction: 'LR' | 'TD',
  nodes: VisualMermaidNode[],
  edges: VisualMermaidEdge[]
): string {
  const lines: string[] = [`flowchart ${direction}`]
  for (const n of nodes) {
    const safeLabel = n.label.replace(/"/g, "'")
    let formatted = `${n.id}["${safeLabel}"]`
    if (n.shape === 'round') formatted = `${n.id}("${safeLabel}")`
    else if (n.shape === 'diamond') formatted = `${n.id}{"${safeLabel}"}`
    else if (n.shape === 'cylinder') formatted = `${n.id}[("${safeLabel}")]`
    else if (n.shape === 'circle') formatted = `${n.id}(("${safeLabel}"))`
    lines.push(`    ${formatted}`)
  }
  for (const e of edges) {
    const cleanLabel = e.label.trim().replace(/"/g, "'")
    if (cleanLabel) {
      lines.push(`    ${e.from} ${e.style}|"${cleanLabel}"| ${e.to}`)
    } else {
      lines.push(`    ${e.from} ${e.style} ${e.to}`)
    }
  }
  return lines.join('\n')
}

function parseNodeToken(rawToken: string): {
  id: string
  label?: string
  shape?: VisualMermaidNodeShape
} | null {
  const token = rawToken.trim()
  if (!token) return null

  // Match ID[("Label")] - cylinder
  const cylMatch = token.match(/^([A-Za-z0-9_-]+)\s*\[\(\s*"?([^"]*?)"?\s*\)\]$/)
  if (cylMatch) {
    return { id: cylMatch[1], label: cylMatch[2], shape: 'cylinder' }
  }

  // Match ID(("Label")) - circle
  const cirMatch = token.match(/^([A-Za-z0-9_-]+)\s*\(\(\s*"?([^"]*?)"?\s*\)\)$/)
  if (cirMatch) {
    return { id: cirMatch[1], label: cirMatch[2], shape: 'circle' }
  }

  // Match ID{"Label"} - diamond
  const diaMatch = token.match(/^([A-Za-z0-9_-]+)\s*\{\s*"?([^"]*?)"?\s*\}$/)
  if (diaMatch) {
    return { id: diaMatch[1], label: diaMatch[2], shape: 'diamond' }
  }

  // Match ID("Label") - round
  const rndMatch = token.match(/^([A-Za-z0-9_-]+)\s*\(\s*"?([^"]*?)"?\s*\)$/)
  if (rndMatch) {
    return { id: rndMatch[1], label: rndMatch[2], shape: 'round' }
  }

  // Match ID["Label"] - rect
  const rectMatch = token.match(/^([A-Za-z0-9_-]+)\s*\[\s*"?([^"]*?)"?\s*\]$/)
  if (rectMatch) {
    return { id: rectMatch[1], label: rectMatch[2], shape: 'rect' }
  }

  // Bare node ID
  const bareMatch = token.match(/^([A-Za-z0-9_-]+)$/)
  if (bareMatch) {
    return { id: bareMatch[1] }
  }

  return null
}

export function parseMermaidToVisualGraph(code?: string): {
  direction: 'LR' | 'TD'
  nodes: VisualMermaidNode[]
  edges: VisualMermaidEdge[]
} {
  const emptyGraph: {
    direction: 'LR' | 'TD'
    nodes: VisualMermaidNode[]
    edges: VisualMermaidEdge[]
  } = {
    direction: 'LR',
    nodes: [],
    edges: []
  }

  if (!code || !code.trim()) return emptyGraph

  let direction: 'LR' | 'TD' = 'LR'
  const nodeMap = new Map<
    string,
    { id: string; label: string; shape: VisualMermaidNodeShape }
  >()
  const edges: VisualMermaidEdge[] = []

  const upsertNode = (parsed: {
    id: string
    label?: string
    shape?: VisualMermaidNodeShape
  }) => {
    const existing = nodeMap.get(parsed.id)
    if (!existing) {
      nodeMap.set(parsed.id, {
        id: parsed.id,
        label: parsed.label || parsed.id,
        shape: parsed.shape || 'rect'
      })
    } else {
      if (parsed.label) existing.label = parsed.label
      if (parsed.shape) existing.shape = parsed.shape
    }
  }

  const lines = code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))

  for (const line of lines) {
    const dirMatch = line.match(/^(?:flowchart|graph)\s+(LR|TD|TB|RL|BT)/i)
    if (dirMatch) {
      const d = dirMatch[1].toUpperCase()
      direction = d === 'TD' || d === 'TB' || d === 'BT' ? 'TD' : 'LR'
      continue
    }

    // Check if line contains an edge arrow: -->, -.->, ==> with optional |"label"|
    const edgeMatch = line.match(
      /^(.+?)\s*(-->|-\.->|==>)\s*(?:\|\s*"?([^"|]*?)"?\s*\|\s*)?(.+)$/
    )
    if (edgeMatch) {
      const [, leftRaw, arrowRaw, edgeLabelRaw, rightRaw] = edgeMatch
      const leftNode = parseNodeToken(leftRaw)
      const rightNode = parseNodeToken(rightRaw)
      if (leftNode && rightNode) {
        upsertNode(leftNode)
        upsertNode(rightNode)
        edges.push({
          id: `E${edges.length + 1}`,
          from: leftNode.id,
          to: rightNode.id,
          style: arrowRaw as VisualMermaidEdgeStyle,
          label: (edgeLabelRaw || '').trim()
        })
        continue
      }
    }

    // Otherwise check standalone node definition
    const standalone = parseNodeToken(line)
    if (standalone) {
      upsertNode(standalone)
    }
  }

  if (nodeMap.size === 0) {
    return { ...emptyGraph, direction }
  }

  const nodeArray = Array.from(nodeMap.values())
  const positionedNodes: VisualMermaidNode[] = nodeArray.map((n, idx) => {
    if (direction === 'LR') {
      const col = idx % 3
      const row = Math.floor(idx / 3)
      return {
        ...n,
        x: 60 + col * 220,
        y: 55 + row * 105
      }
    } else {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      return {
        ...n,
        x: 140 + col * 260,
        y: 35 + row * 85
      }
    }
  })

  return {
    direction,
    nodes: positionedNodes,
    edges
  }
}

export const VisualMermaidBuilderModal: React.FC<{
  initialCode?: string
  theme: 'light' | 'dark'
  onInsertOrUpdateMermaid: (mermaidCode: string) => void
  onClose: () => void
}> = ({ initialCode, theme, onInsertOrUpdateMermaid, onClose }) => {
  const initialGraph = parseMermaidToVisualGraph(initialCode)
  const [direction, setDirection] = useState<'LR' | 'TD'>(initialGraph.direction)
  const [nodes, setNodes] = useState<VisualMermaidNode[]>(initialGraph.nodes)
  const [edges, setEdges] = useState<VisualMermaidEdge[]>(initialGraph.edges)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialGraph.nodes[0]?.id || null
  )
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const [edgeStyleToCreate, setEdgeStyleToCreate] = useState<VisualMermaidEdgeStyle>('-->')
  const [previewSvg, setPreviewSvg] = useState<string>('')

  // Resizable main wizard window dimensions
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>(() => ({
    width: Math.min(1120, Math.max(760, window.innerWidth - 64)),
    height: Math.min(760, Math.max(520, window.innerHeight - 64))
  }))
  const modalResizeRef = useRef<{
    dir: 'right' | 'bottom' | 'corner'
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (!modalResizeRef.current) return
      const { dir, startX, startY, startW, startH } = modalResizeRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      setModalSize((prev) => ({
        width:
          dir === 'right' || dir === 'corner'
            ? Math.max(660, Math.min(window.innerWidth - 24, startW + dx * 2))
            : prev.width,
        height:
          dir === 'bottom' || dir === 'corner'
            ? Math.max(460, Math.min(window.innerHeight - 24, startH + dy * 2))
            : prev.height
      }))
    }
    const onWindowMouseUp = () => {
      modalResizeRef.current = null
    }
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [])

  useEffect(() => {
    const parsed = parseMermaidToVisualGraph(initialCode)
    setDirection(parsed.direction)
    setNodes(parsed.nodes)
    setEdges(parsed.edges)
    setSelectedNodeId(parsed.nodes[0]?.id || null)
    setSelectedEdgeId(null)
  }, [initialCode])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  // Dynamically expand drawing canvas based on node positions AND modal size
  const maxNodeRight = nodes.reduce((acc, n) => Math.max(acc, n.x + 240), 720)
  const maxNodeBottom = nodes.reduce((acc, n) => Math.max(acc, n.y + 150), 420)
  const canvasWidth = Math.max(720, Math.round(modalSize.width * 0.56), maxNodeRight)
  const canvasHeight = Math.max(420, Math.round(modalSize.height - 210), maxNodeBottom)

  const generatedCode = generateMermaidFromVisualGraph(direction, nodes, edges)

  useEffect(() => {
    if (nodes.length === 0) {
      setPreviewSvg('')
      return
    }
    let cancelled = false
    ensureMermaidInit(theme)
    const id = `visual-builder-preview-${Math.random().toString(36).slice(2, 9)}`
    mermaid
      .render(id, generatedCode)
      .then(({ svg }) => {
        if (!cancelled) setPreviewSvg(sanitizeSvgContent(svg))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [generatedCode, nodes.length, theme])

  const addNode = (shape: VisualMermaidNodeShape) => {
    const nextIdx = nodes.length + 1
    const id = `N${Date.now().toString(36).slice(-3).toUpperCase()}${nextIdx}`
    const defaultLabels: Record<VisualMermaidNodeShape, string> = {
      rect: `Process ${nextIdx}`,
      round: `Step ${nextIdx}`,
      diamond: `Decision ${nextIdx}?`,
      cylinder: `Database ${nextIdx}`,
      circle: `Event ${nextIdx}`
    }
    const col = nodes.length % 3
    const row = Math.floor(nodes.length / 3)
    const newNode: VisualMermaidNode = {
      id,
      label: defaultLabels[shape],
      shape,
      x: 50 + col * 210,
      y: 50 + row * 105
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = canvasWidth / Math.max(1, rect.width)
    const scaleY = canvasHeight / Math.max(1, rect.height)
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY
    const { id, offsetX, offsetY } = draggingNodeRef.current
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              // No upper clamp: dragging toward the right or bottom dynamically expands the canvas!
              x: Math.max(16, Math.round(mouseX - offsetX)),
              y: Math.max(16, Math.round(mouseY - offsetY))
            }
          : n
      )
    )
  }

  const handleNodeClick = (nodeId: string) => {
    if (connectSourceId) {
      if (connectSourceId !== nodeId) {
        const newEdge: VisualMermaidEdge = {
          id: `E-${Date.now()}`,
          from: connectSourceId,
          to: nodeId,
          style: edgeStyleToCreate,
          label: ''
        }
        setEdges((prev) => [...prev, newEdge])
        setSelectedEdgeId(newEdge.id)
        setSelectedNodeId(null)
      }
      setConnectSourceId(null)
      return
    }
    setSelectedNodeId(nodeId)
    setSelectedEdgeId(null)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="visual-mermaid-builder-modal"
    >
      <div
        data-testid="visual-mermaid-builder-window"
        style={{
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          minWidth: '660px',
          minHeight: '460px',
          maxWidth: '96vw',
          maxHeight: '94vh',
          resize: 'both'
        }}
        className="relative bg-panel border border-subtle rounded-lg shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary border-b border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-primary">
              Visual Mermaid Diagram Builder
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-panel border border-subtle text-muted">
              Dynamic Canvas ({canvasWidth}×{canvasHeight}px) — Drag edges/corner to resize window
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="mermaid-builder-insert-btn"
              onClick={() => {
                onInsertOrUpdateMermaid(generatedCode)
                onClose()
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-accent text-white hover:opacity-90"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insert / Update Mermaid in Document</span>
            </button>
            <button
              type="button"
              data-testid="mermaid-builder-close-btn"
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Close
            </button>
          </div>
        </div>

        {/* Shape & Arrow Drawing Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-app border-b border-subtle text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-muted font-medium mr-1">Add Shape:</span>
            <button
              type="button"
              data-testid="mermaid-add-rect"
              onClick={() => addNode('rect')}
              className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              + Process [Rect]
            </button>
            <button
              type="button"
              data-testid="mermaid-add-round"
              onClick={() => addNode('round')}
              className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              + Rounded (Step)
            </button>
            <button
              type="button"
              data-testid="mermaid-add-diamond"
              onClick={() => addNode('diamond')}
              className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              + Decision {'{Diamond}'}
            </button>
            <button
              type="button"
              data-testid="mermaid-add-cylinder"
              onClick={() => addNode('cylinder')}
              className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              + Database [(Cylinder)]
            </button>
            <button
              type="button"
              data-testid="mermaid-add-circle"
              onClick={() => addNode('circle')}
              className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              + Circle ((Node))
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-muted">Arrow Type:</label>
            <select
              value={edgeStyleToCreate}
              onChange={(e) => setEdgeStyleToCreate(e.target.value as VisualMermaidEdgeStyle)}
              className="px-2 py-1 rounded bg-panel border border-subtle text-primary"
            >
              <option value="-->">Solid Arrow (--&gt;)</option>
              <option value="-.->">Dashed Arrow (-.-&gt;)</option>
              <option value="==>">Thick Arrow (==&gt;)</option>
            </select>

            <button
              type="button"
              data-testid="mermaid-connect-mode-btn"
              onClick={() => {
                if (connectSourceId) {
                  setConnectSourceId(null)
                } else if (selectedNodeId) {
                  setConnectSourceId(selectedNodeId)
                } else if (nodes[0]) {
                  setConnectSourceId(nodes[0].id)
                }
              }}
              className={`px-2.5 py-1 rounded border font-medium ${
                connectSourceId
                  ? 'bg-accent text-white border-accent'
                  : 'bg-panel border-subtle text-primary hover:border-accent'
              }`}
            >
              {connectSourceId
                ? `Click Target Node to Connect from ${connectSourceId}...`
                : 'Connect Selected Node →'}
            </button>

            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'LR' | 'TD')}
              className="px-2 py-1 rounded bg-panel border border-subtle text-primary"
            >
              <option value="LR">Left → Right (LR)</option>
              <option value="TD">Top → Down (TD)</option>
            </select>
          </div>
        </div>

        {/* Selected Node or Edge Inspector Bar */}
        <div className="px-4 py-2 bg-secondary/50 border-b border-subtle flex items-center justify-between text-xs min-h-[40px] shrink-0">
          {selectedNode ? (
            <div className="flex items-center gap-3">
              <span className="font-semibold text-accent">Node {selectedNode.id}:</span>
              <label className="text-muted">Label:</label>
              <input
                type="text"
                data-testid="mermaid-node-label-input"
                value={selectedNode.label}
                onChange={(e) =>
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                    )
                  )
                }
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
              />
              <label className="text-muted">Shape:</label>
              <select
                value={selectedNode.shape}
                onChange={(e) =>
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === selectedNode.id
                        ? { ...n, shape: e.target.value as VisualMermaidNodeShape }
                        : n
                    )
                  )
                }
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
              >
                <option value="rect">Rectangle</option>
                <option value="round">Rounded</option>
                <option value="diamond">Diamond</option>
                <option value="cylinder">Database</option>
                <option value="circle">Circle</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id))
                  setEdges((prev) =>
                    prev.filter(
                      (e) => e.from !== selectedNode.id && e.to !== selectedNode.id
                    )
                  )
                  setSelectedNodeId(null)
                }}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger"
              >
                Delete Node
              </button>
            </div>
          ) : selectedEdge ? (
            <div className="flex items-center gap-3">
              <span className="font-semibold text-accent">
                Arrow ({selectedEdge.from} → {selectedEdge.to}):
              </span>
              <label className="text-muted">Arrow Label:</label>
              <input
                type="text"
                value={selectedEdge.label}
                placeholder="Optional label..."
                onChange={(e) =>
                  setEdges((prev) =>
                    prev.map((ed) =>
                      ed.id === selectedEdge.id ? { ...ed, label: e.target.value } : ed
                    )
                  )
                }
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
              />
              <button
                type="button"
                onClick={() => {
                  setEdges((prev) => prev.filter((ed) => ed.id !== selectedEdge.id))
                  setSelectedEdgeId(null)
                }}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger"
              >
                Delete Arrow
              </button>
            </div>
          ) : (
            <span className="text-muted">
              Drag any shape on the canvas to position it (canvas expands automatically), click a shape to edit its label, or click &ldquo;Connect Selected Node →&rdquo; to draw arrows.
            </span>
          )}
        </div>

        {/* Interactive Dynamically Expanding 2D Visual Canvas + Auto-Generated Mermaid Code & Live Preview */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-app overflow-hidden flex-1 min-h-0">
          <div className="col-span-7 flex flex-col space-y-2 min-h-0 h-full">
            <div className="text-[11px] font-semibold uppercase text-muted flex items-center justify-between shrink-0">
              <span>Interactive Visual Canvas (Auto-Expands as You Draw & Drag)</span>
              <span className="font-mono text-[10px]">
                {canvasWidth} × {canvasHeight}px
              </span>
            </div>
            <div
              data-testid="mermaid-visual-canvas-scroll"
              className="flex-1 overflow-auto bg-panel border border-subtle rounded shadow-sm min-h-0"
            >
              <svg
                ref={svgRef}
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={() => {
                  draggingNodeRef.current = null
                }}
                className="block select-none"
                data-testid="mermaid-visual-canvas-svg"
              >
                <defs>
                  <marker
                    id="vb-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#426B79" />
                  </marker>
                </defs>

                {/* Edges */}
                {edges.map((ed) => {
                  const fromNode = nodes.find((n) => n.id === ed.from)
                  const toNode = nodes.find((n) => n.id === ed.to)
                  if (!fromNode || !toNode) return null
                  const x1 = fromNode.x + 65
                  const y1 = fromNode.y + 26
                  const x2 = toNode.x + 65
                  const y2 = toNode.y + 26
                  const mx = (x1 + x2) / 2
                  const my = (y1 + y2) / 2
                  const isSelected = ed.id === selectedEdgeId

                  return (
                    <g
                      key={ed.id}
                      onClick={() => {
                        setSelectedEdgeId(ed.id)
                        setSelectedNodeId(null)
                      }}
                      className="cursor-pointer"
                    >
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isSelected ? '#3B7A57' : '#426B79'}
                        strokeWidth={ed.style === '==>' ? 3.5 : 2}
                        strokeDasharray={ed.style === '-.->' ? '5,4' : undefined}
                        markerEnd="url(#vb-arrow)"
                      />
                      {ed.label && (
                        <text
                          x={mx}
                          y={my - 6}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#426B79"
                          fontWeight="600"
                        >
                          {ed.label}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId
                  const isConnectOrigin = node.id === connectSourceId
                  const w = 130
                  const h = 52
                  return (
                    <g
                      key={node.id}
                      data-testid={`visual-mermaid-node-${node.id}`}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        if (!svgRef.current) return
                        const rect = svgRef.current.getBoundingClientRect()
                        const scaleX = canvasWidth / Math.max(1, rect.width)
                        const scaleY = canvasHeight / Math.max(1, rect.height)
                        draggingNodeRef.current = {
                          id: node.id,
                          offsetX: (e.clientX - rect.left) * scaleX - node.x,
                          offsetY: (e.clientY - rect.top) * scaleY - node.y
                        }
                        handleNodeClick(node.id)
                      }}
                      className="cursor-move"
                    >
                      {node.shape === 'diamond' ? (
                        <polygon
                          points={`${node.x + w / 2},${node.y - 6} ${node.x + w + 8},${node.y + h / 2} ${node.x + w / 2},${node.y + h + 6} ${node.x - 8},${node.y + h / 2}`}
                          fill={theme === 'dark' ? '#202428' : '#EEF1F3'}
                          stroke={
                            isConnectOrigin
                              ? '#B8860B'
                              : isSelected
                                ? '#3B7A57'
                                : '#426B79'
                          }
                          strokeWidth={isSelected || isConnectOrigin ? 3 : 2}
                        />
                      ) : node.shape === 'circle' ? (
                        <ellipse
                          cx={node.x + w / 2}
                          cy={node.y + h / 2}
                          rx={w / 2}
                          ry={h / 2}
                          fill={theme === 'dark' ? '#202428' : '#EEF1F3'}
                          stroke={isSelected ? '#3B7A57' : '#426B79'}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                      ) : (
                        <rect
                          x={node.x}
                          y={node.y}
                          width={w}
                          height={h}
                          rx={node.shape === 'round' ? 20 : node.shape === 'cylinder' ? 10 : 4}
                          fill={theme === 'dark' ? '#202428' : '#EEF1F3'}
                          stroke={
                            isConnectOrigin
                              ? '#B8860B'
                              : isSelected
                                ? '#3B7A57'
                                : '#426B79'
                          }
                          strokeWidth={isSelected || isConnectOrigin ? 3 : 2}
                        />
                      )}
                      <text
                        x={node.x + w / 2}
                        y={node.y + h / 2 + 4}
                        textAnchor="middle"
                        fontSize="12"
                        fontFamily="Inter, sans-serif"
                        fill={theme === 'dark' ? '#E8ECEF' : '#20272D'}
                      >
                        {node.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Right Column: Auto-Generated Mermaid Code & Rendered Diagram */}
          <div className="col-span-5 flex flex-col space-y-2 min-h-0 h-full">
            <div className="text-[11px] font-semibold uppercase text-muted shrink-0">
              Auto-Generated Mermaid Code
            </div>
            <pre
              data-testid="mermaid-builder-generated-code"
              className="p-2.5 rounded bg-panel border border-subtle font-mono text-xs text-primary overflow-auto max-h-36 shrink-0"
            >
              {generatedCode}
            </pre>
            <div className="text-[11px] font-semibold uppercase text-muted pt-1 shrink-0">
              Live Mermaid Output Preview
            </div>
            <div
              className="flex-1 p-3 rounded bg-panel border border-subtle flex items-center justify-center overflow-auto min-h-[120px]"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>
        </div>

        {/* Interactive Window Resize Handles (Right Edge, Bottom Edge, and Corner Grip) */}
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'right',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-accent/30"
          title="Drag to resize Diagram Wizard width"
        />
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'bottom',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-accent/30"
          title="Drag to resize Diagram Wizard height"
        />
        <div
          data-testid="mermaid-wizard-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'corner',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-accent/60 hover:bg-accent rounded-tl"
          title="Drag corner to resize Diagram Wizard window"
        />
      </div>
    </div>
  )
}

/* ============================================================================
 * NATIVE-FEELING INTERACTIVE EXCALIDRAW STUDIO (.excalidraw.svg)
 * ============================================================================ */

type DrawingTool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'text'

export const ExcalidrawCanvasModal: React.FC<{
  rootId: string
  relativePath: string
  theme: 'light' | 'dark'
  onClose: () => void
  onSaved?: (relativePath: string, svgContent: string) => void
}> = ({ rootId, relativePath, theme, onClose, onSaved }) => {
  const [scene, setScene] = useState<ExcalidrawSceneData>(() => ({
    ...createDefaultExcalidrawScene(theme),
    elements: []
  }))
  const [activeTool, setActiveTool] = useState<DrawingTool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [corruptedWarning, setCorruptedWarning] = useState(false)
  const [strokeColor, setStrokeColor] = useState<string>(theme === 'dark' ? '#8AB6C3' : '#426B79')
  const [fillColor, setFillColor] = useState<string>(theme === 'dark' ? '#202428' : '#EEF1F3')

  const svgCanvasRef = useRef<SVGSVGElement | null>(null)
  const dragInteractionRef = useRef<
    | {
        mode: 'move'
        id: string
        startX: number
        startY: number
        origX: number
        origY: number
      }
    | {
        mode: 'resize'
        id: string
        startX: number
        startY: number
        origW: number
        origH: number
      }
    | {
        mode: 'create'
        id: string
        startX: number
        startY: number
      }
    | null
  >(null)

  useEffect(() => {
    let active = true
    window.klartext
      .loadExcalidrawSvg(rootId, relativePath)
      .then((res) => {
        if (!active) return
        if (res.scene) {
          setScene(res.scene)
        } else if (res.corrupted) {
          setCorruptedWarning(true)
        }
      })
      .catch(() => {
        // New file; start with default scene
      })
    return () => {
      active = false
    }
  }, [rootId, relativePath])

  const toSvgCoords = (e: { clientX: number; clientY: number }) => {
    const svg = svgCanvasRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const scaleX = 800 / Math.max(1, rect.width)
    const scaleY = 420 / Math.max(1, rect.height)
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    }
  }

  const addShape = (type: ExcalidrawElementItem['type']) => {
    const newEl: ExcalidrawElementItem = {
      id: `el-${Date.now().toString(36)}`,
      type,
      x: 80 + ((scene.elements.length * 45) % 450),
      y: 70 + ((scene.elements.length * 40) % 220),
      width: type === 'text' ? 140 : 165,
      height: type === 'text' ? 32 : 76,
      strokeColor,
      backgroundColor: fillColor,
      text: type === 'arrow' ? undefined : `Node ${scene.elements.length + 1}`
    }
    setScene((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl]
    }))
    setSelectedId(newEl.id)
    setActiveTool('select')
  }

  const updateSelectedElement = (patch: Partial<ExcalidrawElementItem>) => {
    if (!selectedId) return
    setScene((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === selectedId ? { ...el, ...patch } : el))
    }))
  }

  const deleteSelectedElement = () => {
    if (!selectedId) return
    setScene((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== selectedId)
    }))
    setSelectedId(null)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      if (e.target === svgCanvasRef.current) {
        setSelectedId(null)
      }
      return
    }
    const pt = toSvgCoords(e)
    const newId = `el-${Date.now().toString(36)}`
    const newEl: ExcalidrawElementItem = {
      id: newId,
      type: activeTool,
      x: pt.x,
      y: pt.y,
      width: activeTool === 'text' ? 150 : 120,
      height: activeTool === 'text' ? 32 : 64,
      strokeColor,
      backgroundColor: fillColor,
      text: activeTool === 'arrow' ? undefined : activeTool === 'text' ? 'Label' : `Shape ${scene.elements.length + 1}`
    }
    setScene((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl]
    }))
    setSelectedId(newId)
    dragInteractionRef.current = {
      mode: 'create',
      id: newId,
      startX: pt.x,
      startY: pt.y
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragInteractionRef.current
    if (!drag) return
    const pt = toSvgCoords(e)

    if (drag.mode === 'move') {
      const dx = pt.x - drag.startX
      const dy = pt.y - drag.startY
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === drag.id
            ? { ...el, x: Math.max(8, drag.origX + dx), y: Math.max(8, drag.origY + dy) }
            : el
        )
      }))
    } else if (drag.mode === 'resize') {
      const dx = pt.x - drag.startX
      const dy = pt.y - drag.startY
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === drag.id
            ? {
                ...el,
                width: Math.max(40, drag.origW + dx),
                height: Math.max(28, drag.origH + dy)
              }
            : el
        )
      }))
    } else if (drag.mode === 'create') {
      const w = Math.max(50, pt.x - drag.startX)
      const h = Math.max(36, pt.y - drag.startY)
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === drag.id ? { ...el, width: w, height: h } : el
        )
      }))
    }
  }

  const handleCanvasMouseUp = () => {
    if (dragInteractionRef.current?.mode === 'create') {
      setActiveTool('select')
    }
    dragInteractionRef.current = null
  }

  const handleSave = async () => {
    const updatedScene: ExcalidrawSceneData = {
      ...scene,
      appState: {
        ...scene.appState,
        theme,
        viewBackgroundColor: theme === 'dark' ? '#171A1D' : '#FFFFFF'
      }
    }
    const svgString = serializeExcalidrawSvg(updatedScene)
    const res = await window.klartext.saveExcalidrawSvg({
      rootId,
      relativePath,
      sceneJson: JSON.stringify(updatedScene),
      svgString
    })
    setStatusMessage('Saved .excalidraw.svg')
    onSaved?.(res.relativePath, res.svgContent)
  }

  const selectedEl = scene.elements.find((e) => e.id === selectedId) || scene.elements[0]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="excalidraw-modal"
    >
      <div className="w-full max-w-5xl bg-panel border border-subtle rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Top Native Studio Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary border-b border-subtle">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-primary">
              Excalidraw Vector Studio ({relativePath})
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-panel border border-subtle text-muted">
              Click & drag on canvas to draw, move, or resize shapes
            </span>
          </div>
          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="text-xs text-success font-medium" data-testid="excalidraw-save-status">
                {statusMessage}
              </span>
            )}
            <button
              type="button"
              data-testid="excalidraw-save-btn"
              onClick={handleSave}
              className="px-3 py-1 text-xs font-medium rounded bg-accent text-white hover:opacity-90"
            >
              Save .excalidraw.svg
            </button>
            <button
              type="button"
              data-testid="excalidraw-close-btn"
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Close
            </button>
          </div>
        </div>

        {corruptedWarning && (
          <div className="px-4 py-2 bg-secondary border-b border-subtle text-xs text-warning flex items-center justify-between">
            <span>
              Drawing metadata was missing or corrupted. Initialized a fresh editable recovery scene.
            </span>
            <button
              type="button"
              onClick={() => setCorruptedWarning(false)}
              className="underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Native Tool Dock & Property Inspector */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-app border-b border-subtle text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Select & Move Tool"
              onClick={() => setActiveTool('select')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border ${
                activeTool === 'select'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-panel border-subtle text-primary hover:border-accent'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-rect"
              onClick={() => addShape('rectangle')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Rectangle</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-ellipse"
              onClick={() => addShape('ellipse')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Circle className="w-3.5 h-3.5" />
              <span>Ellipse</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-diamond"
              onClick={() => addShape('diamond')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Diamond className="w-3.5 h-3.5" />
              <span>Diamond</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-arrow"
              onClick={() => addShape('arrow')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Arrow</span>
            </button>
            <button
              type="button"
              onClick={() => addShape('text')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>
          </div>

          {selectedEl && (
            <div className="flex items-center gap-2 pl-3 border-l border-subtle">
              <label className="text-muted">Label:</label>
              <input
                type="text"
                data-testid="excalidraw-element-label-input"
                value={selectedEl.text || ''}
                onChange={(e) => {
                  setSelectedId(selectedEl.id)
                  setScene((prev) => ({
                    ...prev,
                    elements: prev.elements.map((el) =>
                      el.id === selectedEl.id ? { ...el, text: e.target.value } : el
                    )
                  }))
                }}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary text-xs w-40"
              />
              <label className="text-muted">Stroke:</label>
              <input
                type="color"
                value={selectedEl.strokeColor || strokeColor}
                onChange={(e) => {
                  setStrokeColor(e.target.value)
                  setSelectedId(selectedEl.id)
                  updateSelectedElement({ strokeColor: e.target.value })
                }}
                className="w-6 h-5 rounded cursor-pointer border border-subtle"
              />
              <label className="text-muted">Fill:</label>
              <input
                type="color"
                value={selectedEl.backgroundColor || fillColor}
                onChange={(e) => {
                  setFillColor(e.target.value)
                  setSelectedId(selectedEl.id)
                  updateSelectedElement({ backgroundColor: e.target.value })
                }}
                className="w-6 h-5 rounded cursor-pointer border border-subtle"
              />
              <button
                type="button"
                title="Delete Selected Shape"
                onClick={deleteSelectedElement}
                className="p-1 rounded bg-panel border border-subtle text-danger hover:border-danger"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Interactive Direct-Manipulation Vector Canvas */}
        <div className="p-4 bg-app flex flex-col items-center">
          <svg
            ref={svgCanvasRef}
            viewBox="0 0 800 420"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="w-full h-[380px] bg-panel border border-subtle rounded-md shadow-sm select-none"
            style={{
              backgroundImage:
                theme === 'dark'
                  ? 'radial-gradient(#353D44 1px, transparent 1px)'
                  : 'radial-gradient(#DDE2E6 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
            data-testid="excalidraw-interactive-svg"
          >
            <defs>
              <marker
                id="ex-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#426B79" />
              </marker>
            </defs>

            {scene.elements.map((el) => {
              const isSelected = (selectedId || scene.elements[0]?.id) === el.id
              const cx = el.x + el.width / 2
              const cy = el.y + el.height / 2

              return (
                <g
                  key={el.id}
                  data-testid={`excalidraw-node-${el.id}`}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setSelectedId(el.id)
                    const pt = toSvgCoords(e)
                    dragInteractionRef.current = {
                      mode: 'move',
                      id: el.id,
                      startX: pt.x,
                      startY: pt.y,
                      origX: el.x,
                      origY: el.y
                    }
                  }}
                  className="cursor-move"
                >
                  {el.type === 'ellipse' ? (
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={Math.abs(el.width / 2)}
                      ry={Math.abs(el.height / 2)}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  ) : el.type === 'diamond' ? (
                    <polygon
                      points={`${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  ) : el.type === 'arrow' ? (
                    <line
                      x1={el.x}
                      y1={el.y}
                      x2={el.x + el.width}
                      y2={el.y + el.height}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={3}
                      markerEnd="url(#ex-arrow)"
                    />
                  ) : el.type === 'text' ? (
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      fill="transparent"
                      stroke={isSelected ? '#3B7A57' : 'transparent'}
                      strokeDasharray="4,2"
                    />
                  ) : (
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rx={6}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  )}

                  {el.text && (
                    <text
                      x={cx}
                      y={cy + 5}
                      textAnchor="middle"
                      fill={el.strokeColor}
                      fontSize="13"
                      fontFamily="Inter, sans-serif"
                      fontWeight="500"
                    >
                      {el.text}
                    </text>
                  )}

                  {/* Corner resize handle when shape is selected */}
                  {isSelected && (
                    <rect
                      x={el.x + el.width - 6}
                      y={el.y + el.height - 6}
                      width={12}
                      height={12}
                      rx={3}
                      fill="#3B7A57"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      className="cursor-nwse-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        const pt = toSvgCoords(e)
                        dragInteractionRef.current = {
                          mode: 'resize',
                          id: el.id,
                          startX: pt.x,
                          startY: pt.y,
                          origW: el.width,
                          origH: el.height
                        }
                      }}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
