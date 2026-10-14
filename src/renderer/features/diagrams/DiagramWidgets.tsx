import React, { useEffect, useState } from 'react'
import mermaid from 'mermaid'
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
}> = ({ code, theme, onUpdateCode }) => {
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

export const ExcalidrawCanvasModal: React.FC<{
  rootId: string
  relativePath: string
  theme: 'light' | 'dark'
  onClose: () => void
  onSaved?: (relativePath: string, svgContent: string) => void
}> = ({ rootId, relativePath, theme, onClose, onSaved }) => {
  const [scene, setScene] = useState<ExcalidrawSceneData>(() => createDefaultExcalidrawScene(theme))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [corruptedWarning, setCorruptedWarning] = useState(false)

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

  const addShape = (type: ExcalidrawElementItem['type']) => {
    const newEl: ExcalidrawElementItem = {
      id: `el-${Date.now().toString(36)}`,
      type,
      x: 80 + scene.elements.length * 40,
      y: 70 + (scene.elements.length % 3) * 45,
      width: type === 'text' ? 140 : 160,
      height: type === 'text' ? 32 : 72,
      strokeColor: theme === 'dark' ? '#8AB6C3' : '#426B79',
      backgroundColor: theme === 'dark' ? '#202428' : '#EEF1F3',
      text: type === 'arrow' ? undefined : `Node ${scene.elements.length + 1}`
    }
    setScene((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl]
    }))
    setSelectedId(newEl.id)
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
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
      data-testid="excalidraw-modal"
    >
      <div className="w-full max-w-4xl bg-panel border border-subtle rounded-lg shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary border-b border-subtle">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-primary">
              Excalidraw Canvas ({relativePath})
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-panel border border-subtle text-muted">
              Portable Double-Extension .excalidraw.svg
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

        <div className="flex items-center gap-2 px-4 py-2 bg-app border-b border-subtle text-xs">
          <button
            type="button"
            data-testid="excalidraw-add-rect"
            onClick={() => addShape('rectangle')}
            className="px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent"
          >
            + Rectangle
          </button>
          <button
            type="button"
            data-testid="excalidraw-add-ellipse"
            onClick={() => addShape('ellipse')}
            className="px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent"
          >
            + Ellipse
          </button>
          <button
            type="button"
            data-testid="excalidraw-add-arrow"
            onClick={() => addShape('arrow')}
            className="px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent"
          >
            + Arrow
          </button>
          {selectedEl && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-subtle">
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
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedId(selectedEl.id)
                  updateSelectedElement({ x: selectedEl.x + 20 })
                }}
                className="px-2 py-0.5 rounded bg-panel border border-subtle"
              >
                Move Right
              </button>
              <button
                type="button"
                onClick={deleteSelectedElement}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger"
              >
                Delete Element
              </button>
            </div>
          )}
        </div>

        <div className="p-6 bg-app flex flex-col items-center">
          <svg
            viewBox="0 0 640 260"
            className="w-full h-64 bg-panel border border-subtle rounded shadow-sm"
            data-testid="excalidraw-interactive-svg"
          >
            {scene.elements.map((el) => {
              const isSelected = (selectedId || scene.elements[0]?.id) === el.id
              return (
                <g
                  key={el.id}
                  data-testid={`excalidraw-node-${el.id}`}
                  onClick={() => setSelectedId(el.id)}
                  className="cursor-pointer"
                >
                  {el.type === 'ellipse' ? (
                    <ellipse
                      cx={el.x + el.width / 2}
                      cy={el.y + el.height / 2}
                      rx={Math.abs(el.width / 2)}
                      ry={Math.abs(el.height / 2)}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
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
                      x={el.x + el.width / 2}
                      y={el.y + el.height / 2 + 5}
                      textAnchor="middle"
                      fill={el.strokeColor}
                      fontSize="13"
                      fontFamily="Inter, sans-serif"
                    >
                      {el.text}
                    </text>
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
