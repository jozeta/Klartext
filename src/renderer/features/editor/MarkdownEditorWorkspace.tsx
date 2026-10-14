import React, { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  List,
  CheckSquare,
  Sparkles,
  GitMerge
} from 'lucide-react'
import type { EditMode } from '../../../shared/types'
import {
  renderMarkdownDocument,
  extractFrontmatter,
  updateFrontmatterInMarkdown,
  convertDelimitedTextToTable,
  type RenderedMarkdownResult
} from '../../../shared/markdown/pipeline'
import { hasConflictMarkers, parseConflictHunks } from '../../../main/git/conflict-resolver'
import {
  createLivePreviewExtension,
  applyMarkdownFormatCommand
} from './live-preview-extension'
import { MermaidDiagramWidget } from '../diagrams/DiagramWidgets'

export const MarkdownEditorWorkspace: React.FC<{
  rootId: string
  relativePath: string
  content: string
  editMode: EditMode
  theme: 'light' | 'dark'
  floatingToolbarEnabled: boolean
  aiEnabled: boolean
  onChangeContent: (nextContent: string) => void
  onPasteOrDropAsset: (fileName: string, mimeType: string, base64Data: string) => Promise<string>
  onOpenExcalidrawModal: (drawingRelPath: string) => void
  onTriggerAIQuickAction: (action: string, selectedText: string) => void
  onResolveConflictHunk: (
    hunkIndex: number,
    resolution: 'current' | 'incoming' | 'both' | 'custom'
  ) => void
  onNavigateWikiLink: (target: string) => void
}> = ({
  rootId,
  relativePath,
  content,
  editMode,
  theme,
  floatingToolbarEnabled,
  aiEnabled,
  onChangeContent,
  onPasteOrDropAsset,
  onOpenExcalidrawModal,
  onTriggerAIQuickAction,
  onResolveConflictHunk,
  onNavigateWikiLink
}) => {
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  const latestContentRef = useRef(content)

  const [rendered, setRendered] = useState<RenderedMarkdownResult | null>(null)
  const [selectionCoords, setSelectionCoords] = useState<{
    top: number
    left: number
    selectedText: string
  } | null>(null)
  const [showFrontmatterEditor, setShowFrontmatterEditor] = useState(false)
  const [threeWayModalHunk, setThreeWayModalHunk] = useState<number | null>(null)
  const [showInlineAIPrompt, setShowInlineAIPrompt] = useState(false)
  const [inlineAIPromptText, setInlineAIPromptText] = useState('')
  const [copiedRichHtml, setCopiedRichHtml] = useState(false)

  // Listen for Cmd/Ctrl + J to toggle inline AI prompt bar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j' && aiEnabled) {
        e.preventDefault()
        setShowInlineAIPrompt((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [aiEnabled])

  const conflictHunks = hasConflictMarkers(content) ? parseConflictHunks(content) : []

  // Debounced Markdown AST & preview rendering
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      renderMarkdownDocument(content, { rootId }).then((res) => {
        if (!cancelled) setRendered(res)
      })
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, rootId])

  // Initialize or reconfigure CodeMirror 6 without losing undo/redo history on mode switch
  useEffect(() => {
    if (!editorContainerRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const startState = EditorState.create({
      doc: content,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        ...(editMode === 'source' ? [lineNumbers()] : []),
        EditorView.lineWrapping,
        createLivePreviewExtension(editMode === 'inline', (hunkIdx, res) => {
          if (res === '3way') {
            setThreeWayModalHunk(hunkIdx)
          } else {
            onResolveConflictHunk(hunkIdx, res)
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextStr = update.state.doc.toString()
            latestContentRef.current = nextStr
            onChangeContent(nextStr)
          }

          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main
            if (!sel.empty && floatingToolbarEnabled) {
              const coords = update.view.coordsAtPos(sel.from)
              const containerRect = editorContainerRef.current?.getBoundingClientRect()
              if (coords && containerRect) {
                const top = Math.max(8, coords.top - containerRect.top - 44)
                const left = Math.max(12, Math.min(containerRect.width - 360, coords.left - containerRect.left))
                setSelectionCoords({
                  top,
                  left,
                  selectedText: update.state.sliceDoc(sel.from, sel.to)
                })
              }
            } else {
              setSelectionCoords(null)
            }
          }
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const items = event.clipboardData?.items
            if (items) {
              for (let i = 0; i < items.length; i++) {
                const item = items[i]
                if (item.type.startsWith('image/')) {
                  event.preventDefault()
                  const file = item.getAsFile()
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = async () => {
                      const base64 = String(reader.result).split(',')[1] || ''
                      const ext = item.type.split('/')[1] || 'png'
                      const mdLink = await onPasteOrDropAsset(
                        `pasted-${Date.now()}.${ext}`,
                        item.type,
                        base64
                      )
                      const pos = view.state.selection.main.from
                      view.dispatch({ changes: { from: pos, to: pos, insert: mdLink } })
                    }
                    reader.readAsDataURL(file)
                  }
                  return true
                }
              }
            }

            // Smart TSV/CSV spreadsheet paste into GFM table when multiple tabs are detected
            const textData = event.clipboardData?.getData('text/plain')
            if (textData && textData.includes('\t') && textData.includes('\n')) {
              event.preventDefault()
              const formattedTable = convertDelimitedTextToTable(textData)
              const range = view.state.selection.main
              view.dispatch({
                changes: { from: range.from, to: range.to, insert: formattedTable }
              })
              return true
            }
            return false
          },
          drop: (event, view) => {
            const files = event.dataTransfer?.files
            if (files && files.length > 0) {
              event.preventDefault()
              const file = files[0]
              const reader = new FileReader()
              reader.onload = async () => {
                const base64 = String(reader.result).split(',')[1] || ''
                const mdLink = await onPasteOrDropAsset(
                  file.name,
                  file.type || 'image/png',
                  base64
                )
                const pos = view.state.selection.main.from
                view.dispatch({ changes: { from: pos, to: pos, insert: mdLink } })
              }
              reader.readAsDataURL(file)
              return true
            }
            return false
          }
        })
      ]
    })

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [rootId, relativePath, editMode, floatingToolbarEnabled])

  // Synchronize external content updates (e.g. disk reload, AI diff accept, conflict resolution) into CodeMirror
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentInEditor = view.state.doc.toString()
    if (content !== currentInEditor) {
      const cursor = Math.min(view.state.selection.main.head, content.length)
      view.dispatch({
        changes: { from: 0, to: currentInEditor.length, insert: content },
        selection: { anchor: cursor }
      })
    }
  }, [content])

  const executeFormat = (
    cmd: Parameters<typeof applyMarkdownFormatCommand>[1]
  ) => {
    if (viewRef.current) {
      applyMarkdownFormatCommand(viewRef.current, cmd)
    }
  }

  const jumpToConflictLine = (lineNumber: number) => {
    const view = viewRef.current
    if (!view) return
    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines))
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    })
    view.focus()
  }

  const parsedFrontmatter = extractFrontmatter(content)

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-panel">
      {/* Conflict Navigator Bar when unresolved merge conflict markers exist */}
      {conflictHunks.length > 0 && (
        <div
          data-testid="conflict-navigator-bar"
          className="flex items-center justify-between px-4 py-1.5 bg-secondary border-b border-subtle text-xs"
        >
          <div className="flex items-center gap-2 text-danger font-medium">
            <GitMerge className="w-3.5 h-3.5" />
            <span>
              {conflictHunks.length} unresolved merge conflict{conflictHunks.length > 1 ? 's' : ''} in{' '}
              {relativePath}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {conflictHunks.map((h, idx) => (
              <button
                key={h.index}
                type="button"
                onClick={() => jumpToConflictLine(h.startLine)}
                className="px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent"
              >
                Jump to Conflict #{idx + 1} (L{h.startLine})
              </button>
            ))}
            <button
              type="button"
              data-testid="resolve-all-current-btn"
              onClick={() => onResolveConflictHunk(0, 'current')}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Accept Current
            </button>
            <button
              type="button"
              data-testid="resolve-all-incoming-btn"
              onClick={() => onResolveConflictHunk(0, 'incoming')}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Accept Incoming
            </button>
            <button
              type="button"
              data-testid="resolve-all-both-btn"
              onClick={() => onResolveConflictHunk(0, 'both')}
              className="px-2 py-0.5 rounded bg-accent text-white"
            >
              Accept Both
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Structured YAML Frontmatter Property Bar */}
      {parsedFrontmatter.frontmatter && (
        <div className="px-6 py-1.5 bg-app border-b border-subtle text-xs flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="font-semibold text-muted uppercase tracking-wider text-[10px]">
              Frontmatter
            </span>
            {Object.entries(parsedFrontmatter.frontmatter).map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
              >
                <strong className="text-muted">{k}:</strong> {String(v)}
              </span>
            ))}
          </div>
          <button
            type="button"
            data-testid="toggle-frontmatter-editor"
            onClick={() => setShowFrontmatterEditor((v) => !v)}
            className="text-accent hover:underline ml-2 shrink-0"
          >
            {showFrontmatterEditor ? 'Hide Properties' : 'Edit Properties'}
          </button>
        </div>
      )}

      {showFrontmatterEditor && parsedFrontmatter.frontmatter && (
        <div
          data-testid="frontmatter-property-panel"
          className="px-6 py-3 bg-secondary border-b border-subtle grid grid-cols-2 gap-2 text-xs"
        >
          {Object.entries(parsedFrontmatter.frontmatter).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="w-24 font-medium text-muted truncate">{key}</label>
              <input
                type="text"
                value={Array.isArray(val) ? val.join(', ') : String(val ?? '')}
                onChange={(e) => {
                  const nextFm = {
                    ...parsedFrontmatter.frontmatter!,
                    [key]: e.target.value
                  }
                  onChangeContent(updateFrontmatterInMarkdown(content, nextFm))
                }}
                className="flex-1 px-2 py-1 rounded bg-panel border border-subtle text-primary"
              />
            </div>
          ))}
        </div>
      )}

      {/* Compact Editor Action & Formatting Strip */}
      <div
        className="flex items-center justify-between px-4 py-1 bg-panel border-b border-subtle text-xs"
        data-testid="editor-formatting-bar"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Bold (Cmd/Ctrl+B)"
            aria-label="Bold"
            data-testid="fmt-bold"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('bold')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Italic (Cmd/Ctrl+I)"
            aria-label="Italic"
            data-testid="fmt-italic"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('italic')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Strikethrough"
            aria-label="Strikethrough"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('strikethrough')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Inline Code"
            aria-label="Inline Code"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('code')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <span className="h-4 w-px bg-subtle mx-1" />
          <button
            type="button"
            title="Heading 1"
            aria-label="Heading 1"
            data-testid="fmt-h1"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('h1')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Heading 2"
            aria-label="Heading 2"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('h2')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Insert Table"
            aria-label="Insert Table"
            data-testid="fmt-table"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('table')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Task List"
            aria-label="Task List"
            data-testid="fmt-task"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('task')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Bulleted List"
            aria-label="Bulleted List"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('bullet')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Insert Link"
            aria-label="Insert Link"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('link')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Insert Image"
            aria-label="Insert Image"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('image')
            }}
            className="p-1.5 rounded hover:bg-secondary text-primary"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          <span className="h-4 w-px bg-subtle mx-1" />
          <button
            type="button"
            data-testid="insert-mermaid-btn"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('mermaid')
            }}
            className="px-2 py-1 rounded hover:bg-secondary text-primary font-medium"
          >
            + Mermaid
          </button>
          <button
            type="button"
            data-testid="open-excalidraw-btn"
            onClick={() => onOpenExcalidrawModal('assets/drawings/architecture.excalidraw.svg')}
            className="px-2 py-1 rounded hover:bg-secondary text-primary font-medium"
          >
            + Excalidraw (.excalidraw.svg)
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="copy-rich-html-btn"
            onClick={async () => {
              if (!rendered) return
              try {
                await navigator.clipboard?.writeText(rendered.html)
                setCopiedRichHtml(true)
                setTimeout(() => setCopiedRichHtml(false), 1500)
              } catch {
                // Ignore clipboard error in headless test
              }
            }}
            className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-muted hover:text-primary"
          >
            {copiedRichHtml ? 'Copied HTML!' : 'Copy Rich HTML'}
          </button>

          {aiEnabled && (
            <>
              <button
                type="button"
                data-testid="toggle-inline-ai-prompt-btn"
                onClick={() => setShowInlineAIPrompt((v) => !v)}
                className="px-2 py-1 rounded bg-secondary hover:border-accent border border-subtle text-primary"
              >
                Inline Draft (⌘J)
              </button>
              <button
                type="button"
                data-testid="ai-quick-improve-btn"
                onClick={() => {
                  const sel = viewRef.current
                    ? viewRef.current.state.sliceDoc(
                        viewRef.current.state.selection.main.from,
                        viewRef.current.state.selection.main.to
                      )
                    : ''
                  onTriggerAIQuickAction('improve', sel || content)
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:border-accent border border-subtle text-primary"
              >
                <Sparkles className="w-3 h-3 text-accent" />
                <span>AI Improve (SV/EN)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline AI Creation & Drafting Bar (Cmd/Ctrl + J) */}
      {showInlineAIPrompt && aiEnabled && (
        <div
          data-testid="inline-ai-prompt-bar"
          className="px-4 py-2 bg-secondary border-b border-subtle flex items-center gap-2 text-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
          <input
            type="text"
            autoFocus
            data-testid="inline-ai-prompt-input"
            placeholder="Draft section, GFM table, checklist, or Mermaid diagram in English or Svenska..."
            value={inlineAIPromptText}
            onChange={(e) => setInlineAIPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowInlineAIPrompt(false)
              if (e.key === 'Enter' && inlineAIPromptText.trim()) {
                onTriggerAIQuickAction('draft', inlineAIPromptText.trim())
                setInlineAIPromptText('')
                setShowInlineAIPrompt(false)
              }
            }}
            className="flex-1 px-2.5 py-1 rounded bg-panel border border-subtle text-primary"
          />
          <button
            type="button"
            data-testid="inline-ai-prompt-submit"
            onClick={() => {
              if (inlineAIPromptText.trim()) {
                onTriggerAIQuickAction('draft', inlineAIPromptText.trim())
                setInlineAIPromptText('')
                setShowInlineAIPrompt(false)
              }
            }}
            className="px-3 py-1 rounded bg-accent text-white font-medium"
          >
            Generate
          </button>
        </div>
      )}

      {/* Floating Selection Toolbar */}
      {selectionCoords && floatingToolbarEnabled && (
        <div
          data-testid="floating-selection-toolbar"
          style={{ top: selectionCoords.top, left: selectionCoords.left }}
          className="absolute z-30 flex items-center gap-1 px-2 py-1 rounded-md bg-panel border border-subtle shadow-md text-xs"
        >
          <button
            type="button"
            data-testid="floating-bold-btn"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('bold')
            }}
            className="px-1.5 py-0.5 rounded hover:bg-secondary font-bold"
          >
            B
          </button>
          <button
            type="button"
            data-testid="floating-italic-btn"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('italic')
            }}
            className="px-1.5 py-0.5 rounded hover:bg-secondary italic"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('code')
            }}
            className="px-1.5 py-0.5 rounded hover:bg-secondary font-mono"
          >
            {'</>'}
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              executeFormat('h2')
            }}
            className="px-1.5 py-0.5 rounded hover:bg-secondary font-semibold"
          >
            H2
          </button>
          {aiEnabled && (
            <>
              <span className="h-3.5 w-px bg-subtle mx-1" />
              <button
                type="button"
                data-testid="floating-ai-improve"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onTriggerAIQuickAction('improve', selectionCoords.selectedText)
                }}
                className="px-2 py-0.5 rounded bg-accent text-white font-medium"
              >
                AI Rewrite
              </button>
              <button
                type="button"
                data-testid="floating-ai-translate-sv"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onTriggerAIQuickAction('translate-en-sv', selectionCoords.selectedText)
                }}
                className="px-2 py-0.5 rounded bg-secondary text-primary"
              >
                SV ↔ EN
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Editor + Optional Split/Inline Diagram Area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`${
            editMode === 'split' ? 'w-1/2 border-r border-subtle' : 'w-full'
          } h-full flex flex-col overflow-y-auto`}
          onScroll={(e) => {
            if (editMode === 'split' && previewContainerRef.current) {
              const target = e.currentTarget
              const ratio =
                target.scrollTop / Math.max(1, target.scrollHeight - target.clientHeight)
              const prev = previewContainerRef.current
              prev.scrollTop = ratio * (prev.scrollHeight - prev.clientHeight)
            }
          }}
        >
          <div
            ref={editorContainerRef}
            data-testid="codemirror-editor-container"
            className="flex-1 min-h-[280px]"
          />

          {/* Inline Rich Mode embedded Mermaid & Excalidraw interactive widgets */}
          {editMode === 'inline' && rendered && (
            <div className="px-8 pb-8 max-w-4xl mx-auto w-full space-y-3">
              {rendered.mermaidBlocks.map((block) => (
                <MermaidDiagramWidget
                  key={block.index}
                  code={block.code}
                  theme={theme}
                  onUpdateCode={(newMermaidCode) => {
                    const updatedDoc = content.replace(block.code, newMermaidCode)
                    onChangeContent(updatedDoc)
                  }}
                />
              ))}

              {rendered.assetReferences
                .filter((ref) => ref.isExcalidrawSvg)
                .map((ref) => (
                  <div
                    key={ref.normalizedPath}
                    data-testid="inline-excalidraw-card"
                    className="p-3 rounded-md border border-subtle bg-secondary flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-primary">
                        Embedded Excalidraw Drawing:
                      </span>{' '}
                      <code className="font-mono text-muted">{ref.normalizedPath}</code>
                    </div>
                    <button
                      type="button"
                      data-testid="edit-inline-excalidraw-btn"
                      onClick={() => onOpenExcalidrawModal(ref.normalizedPath)}
                      className="px-2.5 py-1 rounded bg-accent text-white font-medium"
                    >
                      Edit Drawing (.excalidraw.svg)
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Split Mode Rendered Preview Pane */}
        {editMode === 'split' && (
          <div
            ref={previewContainerRef}
            data-testid="markdown-split-preview"
            className="w-1/2 h-full overflow-y-auto p-8 bg-panel"
            onClick={(e) => {
              const target = e.target as HTMLElement
              const anchor = target.closest('a')
              if (anchor) {
                const wikiAttr = anchor.getAttribute('data-wikilink')
                if (wikiAttr) {
                  e.preventDefault()
                  onNavigateWikiLink(decodeURIComponent(wikiAttr))
                }
              }
            }}
          >
            {rendered && (
              <>
                <div
                  className="klartext-preview-body"
                  dangerouslySetInnerHTML={{ __html: rendered.html }}
                />
                {rendered.mermaidBlocks.map((block) => (
                  <MermaidDiagramWidget
                    key={block.index}
                    code={block.code}
                    theme={theme}
                    onUpdateCode={(newMermaidCode) => {
                      onChangeContent(content.replace(block.code, newMermaidCode))
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* 3-Way Merge Conflict Diff Modal */}
      {threeWayModalHunk !== null && conflictHunks[threeWayModalHunk] && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          data-testid="three-way-conflict-modal"
        >
          <div className="w-full max-w-4xl bg-panel border border-subtle rounded-lg shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-secondary border-b border-subtle flex items-center justify-between text-xs">
              <span className="font-semibold text-primary">
                3-Way Conflict Resolver — Hunk #{threeWayModalHunk + 1}
              </span>
              <button
                type="button"
                onClick={() => setThreeWayModalHunk(null)}
                className="px-2 py-0.5 rounded bg-panel border border-subtle"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 bg-app text-xs font-mono">
              <div className="p-3 bg-panel border border-subtle rounded">
                <div className="font-sans font-semibold text-success mb-2">
                  Current (Local — {conflictHunks[threeWayModalHunk].currentHeader})
                </div>
                <pre className="whitespace-pre-wrap">
                  {conflictHunks[threeWayModalHunk].currentContent}
                </pre>
              </div>
              <div className="p-3 bg-panel border border-subtle rounded">
                <div className="font-sans font-semibold text-accent mb-2">
                  Incoming (Remote — {conflictHunks[threeWayModalHunk].incomingHeader})
                </div>
                <pre className="whitespace-pre-wrap">
                  {conflictHunks[threeWayModalHunk].incomingContent}
                </pre>
              </div>
            </div>
            <div className="px-4 py-3 bg-secondary border-t border-subtle flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  onResolveConflictHunk(threeWayModalHunk, 'current')
                  setThreeWayModalHunk(null)
                }}
                className="px-3 py-1 rounded bg-panel border border-subtle"
              >
                Accept Current
              </button>
              <button
                type="button"
                onClick={() => {
                  onResolveConflictHunk(threeWayModalHunk, 'incoming')
                  setThreeWayModalHunk(null)
                }}
                className="px-3 py-1 rounded bg-panel border border-subtle"
              >
                Accept Incoming
              </button>
              <button
                type="button"
                onClick={() => {
                  onResolveConflictHunk(threeWayModalHunk, 'both')
                  setThreeWayModalHunk(null)
                }}
                className="px-3 py-1 rounded bg-accent text-white"
              >
                Accept Both
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
