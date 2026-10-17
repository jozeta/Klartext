import React, { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Underline,
  Code,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  ListOrdered,
  Quote,
  AlertCircle,
  Sigma,
  Minus,
  Wand2,
  Eraser,
  Keyboard,
  EyeOff,
  ChevronRightSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  List,
  CheckSquare,
  Sparkles,
  GitMerge,
  Eye,
  FileCode,
  Workflow,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Languages,
  Smile
} from '../../components/icons/untitled-icons'
import type { EditMode, EditorMarginMode } from '../../../shared/types'
import {
  renderMarkdownDocument,
  convertDelimitedTextToTable,
  convertHtmlToMarkdown,
  type RenderedMarkdownResult
} from '../../../shared/markdown/pipeline'
import { sanitizeSvgContent } from '../../../shared/serialization/excalidraw-svg'
import { hasConflictMarkers, parseConflictHunks } from '../../../main/git/conflict-resolver'
import {
  createLivePreviewExtension,
  applyMarkdownFormatCommand,
  type MarkdownFormatCommand
} from './live-preview-extension'
import {
  createSpellcheckExtension,
  SPELL_LANGUAGE_LABELS,
  type SpellSuggestionItem,
  type SupportedSpellLanguage
} from './spellcheck-extension'
import { MermaidDiagramWidget, VisualMermaidBuilderModal } from '../diagrams/DiagramWidgets'

export type EditorDispatchedCommand =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'copy-rich-html'
  | 'toggle-inline-ai'
  | 'ai-improve'
  | 'open-mermaid-builder'
  | 'open-icon-picker'
  | MarkdownFormatCommand

/**
 * Computes horizontal page margins (`marginPx`) and content max-width (`maxWidthCss`)
 * for Small, Medium, Wide, and dynamic Word Flow margin modes.
 * In `word-flow` mode, horizontal margins scale dynamically with the live page/pane width
 * so resizing the window or split pane automatically reflows the margins and text.
 */
export function computeEditorMarginConfig(
  marginMode: EditorMarginMode,
  containerWidthPx: number
): { marginPx: number; maxWidthCss: string } {
  if (marginMode === 'small') {
    return { marginPx: 16, maxWidthCss: '100%' }
  }
  if (marginMode === 'wide') {
    return { marginPx: 96, maxWidthCss: '68ch' }
  }
  if (marginMode === 'word-flow') {
    const safeWidth = Math.max(320, Number.isFinite(containerWidthPx) ? containerWidthPx : 900)
    if (safeWidth <= 480) {
      return { marginPx: 16, maxWidthCss: '100%' }
    }
    const baseMargin = Math.round(safeWidth * 0.14)
    const wideBonus = safeWidth > 960 ? Math.round((safeWidth - 960) * 0.22) : 0
    const dynamicMargin = Math.max(16, Math.min(320, baseMargin + wideBonus))
    return { marginPx: dynamicMargin, maxWidthCss: '100%' }
  }
  // Default: 'medium'
  return { marginPx: 48, maxWidthCss: '82ch' }
}

// Per-tab selection and scroll offset cache so switching tabs restores exact cursor & scroll position
const tabViewStateCache = new Map<
  string,
  { anchor: number; head: number; scrollTop: number }
>()

function clearPreviewHighlights(container: HTMLElement) {
  const marks = container.querySelectorAll('mark.klartext-split-highlight')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
      parent.normalize()
    }
  })
}

function highlightSelectionInPreview(container: HTMLElement, rawSelected: string) {
  clearPreviewHighlights(container)
  const clean = rawSelected
    .replace(/^#+\s+/gm, '')
    .replace(/(\*\*|\*|~~|`)/g, '')
    .trim()
  if (clean.length < 2) return

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node: Node | null = walker.nextNode()
  while (node) {
    const text = node.nodeValue || ''
    const idx = text.toLowerCase().indexOf(clean.toLowerCase())
    if (idx !== -1 && node.parentElement && node.parentElement.tagName !== 'MARK') {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + clean.length)
      const mark = document.createElement('mark')
      mark.className = 'klartext-split-highlight'
      range.surroundContents(mark)
      mark.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      break
    }
    node = walker.nextNode()
  }
}

const IMAGE_ASSET_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.avif'
]

export const MarkdownEditorWorkspace: React.FC<{
  rootId: string
  relativePath: string
  content: string
  editMode: EditMode
  theme: 'light' | 'dark'
  floatingToolbarEnabled: boolean
  formattingToolbarVisible?: boolean
  aiEnabled: boolean
  showLineNumbers: boolean
  wordWrap: boolean
  marginMode?: EditorMarginMode
  spellcheckEnabled?: boolean
  spellcheckLanguages?: string[]
  customDictionaryWords?: string[]
  initialSplitPercent?: number
  onChangeSplitPercent?: (percent: number) => void
  scrollToLine?: { line: number; nonce: number } | null
  editorCommandTrigger?: {
    command: EditorDispatchedCommand
    nonce: number
  } | null
  textInsertTrigger?: {
    text: string
    cursorOffset: number | null
    nonce: number
  } | null
  onChangeContent: (nextContent: string) => void
  onPasteOrDropAsset: (fileName: string, mimeType: string, base64Data: string) => Promise<string>
  onOpenExcalidrawModal?: (drawingRelPath: string) => void
  onOpenIconPicker?: () => void
  onTriggerAIQuickAction: (action: string, selectedText: string) => void
  onResolveConflictHunk: (
    hunkIndex: number,
    resolution: 'current' | 'incoming' | 'both' | 'custom'
  ) => void
  onNavigateLink: (target: string, isWiki: boolean) => void
  onToggleSpellcheck?: (enabled: boolean) => void
  onChangeSpellcheckLanguage?: (lang: string) => void
  onAddWordToDictionary?: (word: string) => void
}> = ({
  rootId,
  relativePath,
  content,
  editMode,
  theme,
  floatingToolbarEnabled,
  formattingToolbarVisible = false,
  aiEnabled,
  showLineNumbers,
  wordWrap,
  marginMode = 'medium',
  spellcheckEnabled = true,
  spellcheckLanguages = ['en-US', 'sv-SE'],
  customDictionaryWords = [],
  initialSplitPercent = 50,
  onChangeSplitPercent,
  scrollToLine,
  editorCommandTrigger,
  textInsertTrigger,
  onChangeContent,
  onPasteOrDropAsset,
  onOpenExcalidrawModal,
  onOpenIconPicker,
  onTriggerAIQuickAction,
  onResolveConflictHunk,
  onNavigateLink,
  onChangeSpellcheckLanguage,
  onAddWordToDictionary
}) => {
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const editorScrollWrapperRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const latestContentRef = useRef(content)
  const lastHandledCommandNonceRef = useRef<number | null>(null)
  const lastHandledTextInsertNonceRef = useRef<number | null>(null)

  const [rendered, setRendered] = useState<RenderedMarkdownResult | null>(null)
  const renderedRef = useRef<RenderedMarkdownResult | null>(null)
  renderedRef.current = rendered
  const onTriggerAIQuickActionRef = useRef(onTriggerAIQuickAction)
  onTriggerAIQuickActionRef.current = onTriggerAIQuickAction
  const onOpenIconPickerRef = useRef(onOpenIconPicker)
  onOpenIconPickerRef.current = onOpenIconPicker

  const isMouseDownInEditorRef = useRef(false)
  const [isMouseSelecting, setIsMouseSelecting] = useState(false)
  const [selectionCoords, setSelectionCoords] = useState<{
    top: number
    left: number
    selectedText: string
  } | null>(null)
  const [fadingOutCoords, setFadingOutCoords] = useState<{
    top: number
    left: number
    selectedText: string
  } | null>(null)
  const lastActiveCoordsRef = useRef<{
    top: number
    left: number
    selectedText: string
  } | null>(null)
  const [threeWayModalHunk, setThreeWayModalHunk] = useState<number | null>(null)
  const [showInlineAIPrompt, setShowInlineAIPrompt] = useState(false)
  const [inlineAIPromptText, setInlineAIPromptText] = useState('')

  // Visual Mermaid Builder Modal state
  const [mermaidBuilderTarget, setMermaidBuilderTarget] = useState<{
    initialCode?: string
    blockFrom?: number
    blockTo?: number
  } | null>(null)

  // Right-click Spellcheck Context Menu state & Ignored Occurrences / Session Dictionary
  const [ignoredSpellOccurrences, setIgnoredSpellOccurrences] = useState<string[]>([])
  const [sessionIgnoredWords, setSessionIgnoredWords] = useState<string[]>([])
  const [spellContextMenu, setSpellContextMenu] = useState<{
    word: string
    from: number
    to: number
    clientX: number
    clientY: number
    suggestions: string[]
    detailedSuggestions: SpellSuggestionItem[]
    synonyms: SpellSuggestionItem[]
  } | null>(null)

  // Asset file detection (.svg, .png, .jpg, .jpeg, .gif, .webp, .pdf, .mermaid, .mmd)
  const lowerPath = relativePath.toLowerCase()
  const isSvgFile = lowerPath.endsWith('.svg')
  const isRasterImageAsset = IMAGE_ASSET_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))
  const isPdfAsset = lowerPath.endsWith('.pdf')
  const isMermaidAsset = lowerPath.endsWith('.mermaid') || lowerPath.endsWith('.mmd')
  const isVisualAssetFile = isSvgFile || isRasterImageAsset || isPdfAsset || isMermaidAsset

  const [showRawSvgSource, setShowRawSvgSource] = useState(false)
  const [assetZoom, setAssetZoom] = useState<number>(100)

  // Resizable Split View percentage (20% to 80%)
  const [splitPercent, setSplitPercent] = useState<number>(initialSplitPercent)
  const splitPercentRef = useRef<number>(initialSplitPercent)
  splitPercentRef.current = splitPercent
  const onChangeSplitPercentRef = useRef(onChangeSplitPercent)
  onChangeSplitPercentRef.current = onChangeSplitPercent
  const isDraggingSplitRef = useRef(false)

  // Auto-scroll when drag-selecting text near top or bottom of editor scroll container
  const dragSelectScrollVelocityRef = useRef<number>(0)
  const lastDragMousePosRef = useRef<{ x: number; y: number } | null>(null)

  // Live container width tracking so Word Flow dynamically recalculates margins & reflows on resize
  const [editorPaneWidth, setEditorPaneWidth] = useState<number>(960)

  useEffect(() => {
    const updateMeasuredWidth = () => {
      const targetEl = editorScrollWrapperRef.current || splitContainerRef.current
      if (targetEl) {
        const measured = Math.round(targetEl.getBoundingClientRect().width)
        if (measured > 0) {
          setEditorPaneWidth((prev) => (prev === measured ? prev : measured))
        }
      }
    }
    updateMeasuredWidth()

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateMeasuredWidth()
          })
        : null

    if (observer) {
      if (editorScrollWrapperRef.current) observer.observe(editorScrollWrapperRef.current)
      if (splitContainerRef.current) observer.observe(splitContainerRef.current)
    }

    window.addEventListener('resize', updateMeasuredWidth)
    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateMeasuredWidth)
    }
  }, [editMode, splitPercent, isVisualAssetFile])

  const marginConfig = computeEditorMarginConfig(marginMode, editorPaneWidth)

  useEffect(() => {
    viewRef.current?.requestMeasure()
  }, [marginMode, marginConfig.marginPx, marginConfig.maxWidthCss, wordWrap])

  useEffect(() => {
    setShowRawSvgSource(false)
    setAssetZoom(100)
  }, [relativePath])

  // Handle commands dispatched from top Edit, Format, Insert & AI dropdown menus (strictly once per nonce)
  useEffect(() => {
    if (!editorCommandTrigger) return
    if (lastHandledCommandNonceRef.current === editorCommandTrigger.nonce) return
    lastHandledCommandNonceRef.current = editorCommandTrigger.nonce

    const { command } = editorCommandTrigger
    const view = viewRef.current
    if (command === 'undo' && view) {
      undo(view)
      view.focus()
    } else if (command === 'redo' && view) {
      redo(view)
      view.focus()
    } else if (command === 'select-all' && view) {
      view.dispatch({
        selection: { anchor: 0, head: view.state.doc.length }
      })
      view.focus()
    } else if (command === 'cut' && view) {
      const { from, to } = view.state.selection.main
      if (from < to) {
        const selected = view.state.sliceDoc(from, to)
        navigator.clipboard?.writeText(selected).catch(() => {})
        view.dispatch({ changes: { from, to, insert: '' } })
      }
      view.focus()
    } else if (command === 'copy' && view) {
      const { from, to } = view.state.selection.main
      if (from < to) {
        const selected = view.state.sliceDoc(from, to)
        navigator.clipboard?.writeText(selected).catch(() => {})
      }
      view.focus()
    } else if (command === 'paste' && view) {
      navigator.clipboard
        ?.readText()
        .then((clipText) => {
          if (!clipText || !viewRef.current) return
          const { from, to } = viewRef.current.state.selection.main
          viewRef.current.dispatch({
            changes: { from, to, insert: clipText },
            selection: { anchor: from + clipText.length }
          })
          viewRef.current.focus()
        })
        .catch(() => {})
    } else if (command === 'copy-rich-html') {
      if (renderedRef.current) {
        navigator.clipboard?.writeText(renderedRef.current.html).catch(() => {})
      }
    } else if (command === 'toggle-inline-ai') {
      setShowInlineAIPrompt((v) => !v)
    } else if (command === 'ai-improve') {
      const sel = view
        ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
        : ''
      onTriggerAIQuickActionRef.current('improve', sel || latestContentRef.current)
    } else if (command === 'open-mermaid-builder') {
      setMermaidBuilderTarget({})
    } else if (command === 'open-icon-picker') {
      onOpenIconPickerRef.current?.()
    } else if (view) {
      applyMarkdownFormatCommand(view, command as MarkdownFormatCommand)
    }
  }, [editorCommandTrigger])

  // Handle inserting evaluated templates or <% %> variable tags at the active cursor position
  useEffect(() => {
    if (!textInsertTrigger) return
    if (lastHandledTextInsertNonceRef.current === textInsertTrigger.nonce) return
    lastHandledTextInsertNonceRef.current = textInsertTrigger.nonce

    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const { text, cursorOffset } = textInsertTrigger
    const targetAnchor =
      cursorOffset !== null && cursorOffset >= 0
        ? from + Math.min(cursorOffset, text.length)
        : from + text.length
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: targetAnchor },
      effects: EditorView.scrollIntoView(targetAnchor, { y: 'center' })
    })
    view.focus()
  }, [textInsertTrigger])

  // Close spellcheck context menu on outside click
  useEffect(() => {
    if (!spellContextMenu) return
    const onGlobalClick = () => setSpellContextMenu(null)
    window.addEventListener('click', onGlobalClick)
    return () => window.removeEventListener('click', onGlobalClick)
  }, [spellContextMenu])

  // Auto-scroll editor viewport when clicking and dragging text selection near top or bottom edge
  useEffect(() => {
    let rafId: number | null = null
    let isSelectingInEditor = false

    const stepAutoScroll = () => {
      const vel = dragSelectScrollVelocityRef.current
      const scroller = editorScrollWrapperRef.current
      if (vel !== 0 && scroller && isSelectingInEditor) {
        scroller.scrollTop += vel
        // Also extend CodeMirror selection to current mouse coordinates while scrolling
        if (viewRef.current && lastDragMousePosRef.current) {
          const pos = viewRef.current.posAtCoords(lastDragMousePosRef.current)
          if (pos !== null) {
            const anchor = viewRef.current.state.selection.main.anchor
            viewRef.current.dispatch({
              selection: { anchor, head: pos }
            })
          }
        }
        rafId = requestAnimationFrame(stepAutoScroll)
      } else {
        rafId = null
      }
    }

    const onWindowMouseDown = (e: MouseEvent) => {
      const scroller = editorScrollWrapperRef.current
      if (e.button === 0 && scroller && e.target instanceof Node && scroller.contains(e.target)) {
        isSelectingInEditor = true
        isMouseDownInEditorRef.current = true
        setIsMouseSelecting(true)
      } else {
        isSelectingInEditor = false
        dragSelectScrollVelocityRef.current = 0
      }
    }

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!isSelectingInEditor || (e.buttons & 1) !== 1 || isDraggingSplitRef.current) {
        dragSelectScrollVelocityRef.current = 0
        return
      }
      const scroller = editorScrollWrapperRef.current
      if (!scroller) return
      const rect = scroller.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX > rect.right) {
        dragSelectScrollVelocityRef.current = 0
        return
      }

      lastDragMousePosRef.current = { x: e.clientX, y: e.clientY }
      const edgeThreshold = 60
      if (e.clientY >= rect.top - 40 && e.clientY < rect.top + edgeThreshold) {
        const intensity = Math.max(
          1,
          Math.min(18, Math.round((rect.top + edgeThreshold - e.clientY) / 4))
        )
        dragSelectScrollVelocityRef.current = -intensity
        if (rafId === null) rafId = requestAnimationFrame(stepAutoScroll)
      } else if (e.clientY > rect.bottom - edgeThreshold && e.clientY <= rect.bottom + 40) {
        const intensity = Math.max(
          1,
          Math.min(18, Math.round((e.clientY - (rect.bottom - edgeThreshold)) / 4))
        )
        dragSelectScrollVelocityRef.current = intensity
        if (rafId === null) rafId = requestAnimationFrame(stepAutoScroll)
      } else {
        dragSelectScrollVelocityRef.current = 0
      }
    }

    const onWindowMouseUp = () => {
      isSelectingInEditor = false
      dragSelectScrollVelocityRef.current = 0
      lastDragMousePosRef.current = null
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (isMouseDownInEditorRef.current) {
        isMouseDownInEditorRef.current = false
        setIsMouseSelecting(false)
        const view = viewRef.current
        if (view) {
          const sel = view.state.selection.main
          if (!sel.empty) {
            const selectedStr = view.state.sliceDoc(sel.from, sel.to)
            const fromCoords = view.coordsAtPos(sel.from)
            const toCoords = view.coordsAtPos(sel.to) || fromCoords
            if (fromCoords && toCoords) {
              const selectionTop = Math.min(fromCoords.top, toCoords.top)
              const selectionBottom = Math.max(fromCoords.bottom, toCoords.bottom)
              const selectionLeft = Math.min(fromCoords.left, toCoords.left)
              const placeAbove = selectionTop > 110
              const top = placeAbove ? selectionTop - 68 : selectionBottom + 8
              const left = Math.max(12, Math.min(window.innerWidth - 420, selectionLeft))
              setSelectionCoords({ top, left, selectedText: selectedStr })
            }
          } else {
            setSelectionCoords(null)
          }
        }
      }
    }

    window.addEventListener('mousedown', onWindowMouseDown)
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown)
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  // Quick fade-out transition when floating selection toolbar closes
  const activeFloatingCoords =
    floatingToolbarEnabled && !isMouseSelecting ? selectionCoords : null
  useEffect(() => {
    if (activeFloatingCoords) {
      lastActiveCoordsRef.current = activeFloatingCoords
      setFadingOutCoords(null)
      return
    }
    if (lastActiveCoordsRef.current) {
      const prev = lastActiveCoordsRef.current
      lastActiveCoordsRef.current = null
      setFadingOutCoords(prev)
      const timer = setTimeout(() => {
        setFadingOutCoords(null)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [activeFloatingCoords])

  useEffect(() => {
    setSplitPercent(initialSplitPercent)
  }, [initialSplitPercent])

  // Mouse handlers for resizable Split View divider
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitRef.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      if (rect.width <= 0) return
      const rawPct = ((e.clientX - rect.left) / rect.width) * 100
      const clamped = Math.round(Math.max(20, Math.min(80, rawPct)) * 10) / 10
      setSplitPercent(clamped)
    }
    const onMouseUp = () => {
      if (isDraggingSplitRef.current) {
        isDraggingSplitRef.current = false
        onChangeSplitPercentRef.current?.(splitPercentRef.current)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

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

  const conflictHunks =
    !isVisualAssetFile && hasConflictMarkers(content) ? parseConflictHunks(content) : []

  // Debounced Markdown AST & preview rendering
  useEffect(() => {
    if (isVisualAssetFile) return
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
  }, [content, rootId, isVisualAssetFile])

  // Jump/scroll to a target line number in CodeMirror
  const jumpToLine = (lineNumber: number) => {
    const view = viewRef.current
    if (!view) return
    const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines))
    const line = view.state.doc.line(safeLine)
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    })
    view.focus()
  }

  // Respond to external scrollToLine requests (from Search results or Outline panel)
  useEffect(() => {
    if (!scrollToLine) return
    const timer = setTimeout(() => {
      jumpToLine(scrollToLine.line)
    }, 30)
    return () => clearTimeout(timer)
  }, [scrollToLine])

  const combinedCustomWords = [...customDictionaryWords, ...sessionIgnoredWords]
  const tabCacheKey = `${rootId}::${relativePath}`

  // Initialize or reconfigure CodeMirror 6
  useEffect(() => {
    if (!editorContainerRef.current) return
    if (isVisualAssetFile && !(isSvgFile && showRawSvgSource)) return

    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const cachedTabState = tabViewStateCache.get(tabCacheKey)
    const initialAnchor = cachedTabState
      ? Math.min(cachedTabState.anchor, content.length)
      : 0
    const initialHead = cachedTabState
      ? Math.min(cachedTabState.head, content.length)
      : 0

    const smartMarkdownKeymap = keymap.of([
      {
        key: 'Mod-b',
        run: (view) => {
          applyMarkdownFormatCommand(view, 'bold')
          return true
        }
      },
      {
        key: 'Mod-i',
        run: (view) => {
          applyMarkdownFormatCommand(view, 'italic')
          return true
        }
      },
      {
        key: 'Mod-k',
        run: (view) => {
          applyMarkdownFormatCommand(view, 'link')
          return true
        }
      },
      {
        key: 'Mod-Shift-x',
        run: (view) => {
          applyMarkdownFormatCommand(view, 'strikethrough')
          return true
        }
      },
      {
        key: 'Mod-Shift-h',
        run: (view) => {
          applyMarkdownFormatCommand(view, 'highlight')
          return true
        }
      },
      {
        key: 'Mod-Shift-i',
        run: () => {
          onOpenIconPickerRef.current?.()
          return true
        }
      },
      {
        key: 'Alt-Shift-f',
        run: (view) => {
          applyMarkdownFormatCommand(view, 'format-doc')
          return true
        }
      },
      {
        key: 'Enter',
        run: (view) => {
          const { state } = view
          const sel = state.selection.main
          if (!sel.empty) return false
          const line = state.doc.lineAt(sel.head)
          if (sel.head !== line.to) return false

          // 1. Empty list / task / ordered / blockquote prefix -> exit list cleanly
          const emptyPrefixMatch = line.text.match(
            /^(\s*)(?:[-*+]\s+\[[ xX]\]|[-*+]|\d+\.|>)\s*$/
          )
          if (emptyPrefixMatch) {
            view.dispatch({
              changes: { from: line.from, to: line.to, insert: '' },
              selection: { anchor: line.from }
            })
            return true
          }

          // 2. Task list continuation: - [ ] item -> \n- [ ] 
          const taskMatch = line.text.match(/^(\s*[-*+]\s+)\[[ xX]\]\s+(.+)$/)
          if (taskMatch) {
            const nextPrefix = `\n${taskMatch[1]}[ ] `
            view.dispatch({
              changes: { from: sel.head, to: sel.head, insert: nextPrefix },
              selection: { anchor: sel.head + nextPrefix.length }
            })
            return true
          }

          // 3. Ordered list continuation: 1. item -> \n2. 
          const orderedMatch = line.text.match(/^(\s*)(\d+)\.\s+(.+)$/)
          if (orderedMatch) {
            const nextNum = Number(orderedMatch[2]) + 1
            const nextPrefix = `\n${orderedMatch[1]}${nextNum}. `
            view.dispatch({
              changes: { from: sel.head, to: sel.head, insert: nextPrefix },
              selection: { anchor: sel.head + nextPrefix.length }
            })
            return true
          }

          // 4. Bullet list continuation: - item -> \n- 
          const bulletMatch = line.text.match(/^(\s*[-*+]\s+)(.+)$/)
          if (bulletMatch) {
            const nextPrefix = `\n${bulletMatch[1]}`
            view.dispatch({
              changes: { from: sel.head, to: sel.head, insert: nextPrefix },
              selection: { anchor: sel.head + nextPrefix.length }
            })
            return true
          }

          // 5. Blockquote continuation: > quote -> \n> 
          const quoteMatch = line.text.match(/^(\s*>\s+)(.+)$/)
          if (quoteMatch) {
            const nextPrefix = `\n${quoteMatch[1]}`
            view.dispatch({
              changes: { from: sel.head, to: sel.head, insert: nextPrefix },
              selection: { anchor: sel.head + nextPrefix.length }
            })
            return true
          }

          return false
        }
      },
      {
        key: 'Tab',
        run: (view) => {
          const { state } = view
          const sel = state.selection.main
          const line = state.doc.lineAt(sel.head)

          // Table cell navigation: jump to next cell in current or next table row
          if (/^\s*\|.*\|\s*$/.test(line.text)) {
            const offsetInLine = sel.to - line.from
            const nextPipeIdx = line.text.indexOf('|', offsetInLine)
            if (nextPipeIdx !== -1) {
              const followingPipeIdx = line.text.indexOf('|', nextPipeIdx + 1)
              if (followingPipeIdx !== -1) {
                const rawCell = line.text.slice(nextPipeIdx + 1, followingPipeIdx)
                const trimStart = rawCell.search(/\S/)
                const cellStart =
                  line.from + nextPipeIdx + 1 + (trimStart >= 0 ? trimStart : 1)
                const cellEnd =
                  line.from + nextPipeIdx + 1 + rawCell.trimEnd().length
                view.dispatch({
                  selection: { anchor: cellStart, head: Math.max(cellStart, cellEnd) }
                })
                return true
              }
            }
            // Check next line if it's also a table row
            if (line.number < state.doc.lines) {
              const nextLine = state.doc.line(line.number + 1)
              if (/^\s*\|.*\|\s*$/.test(nextLine.text)) {
                const firstPipe = nextLine.text.indexOf('|')
                const secondPipe = nextLine.text.indexOf('|', firstPipe + 1)
                if (firstPipe !== -1 && secondPipe !== -1) {
                  const rawCell = nextLine.text.slice(firstPipe + 1, secondPipe)
                  const trimStart = rawCell.search(/\S/)
                  const cellStart =
                    nextLine.from + firstPipe + 1 + (trimStart >= 0 ? trimStart : 1)
                  const cellEnd =
                    nextLine.from + firstPipe + 1 + rawCell.trimEnd().length
                  view.dispatch({
                    selection: { anchor: cellStart, head: Math.max(cellStart, cellEnd) }
                  })
                  return true
                }
              }
            }
          }

          // List item indent by 2 spaces
          if (/^(\s*)(?:[-*+]|\d+\.)\s+/.test(line.text)) {
            view.dispatch({
              changes: { from: line.from, to: line.from, insert: '  ' },
              selection: { anchor: sel.anchor + 2, head: sel.head + 2 }
            })
            return true
          }

          return false
        }
      },
      {
        key: 'Shift-Tab',
        run: (view) => {
          const { state } = view
          const sel = state.selection.main
          const line = state.doc.lineAt(sel.head)

          // Table cell reverse navigation: jump to previous cell
          if (/^\s*\|.*\|\s*$/.test(line.text)) {
            const offsetInLine = sel.from - line.from
            const beforeText = line.text.slice(0, Math.max(0, offsetInLine - 1))
            const prevPipeIdx = beforeText.lastIndexOf('|')
            const openPipeIdx =
              prevPipeIdx > 0 ? beforeText.lastIndexOf('|', prevPipeIdx - 1) : -1
            if (openPipeIdx !== -1 && prevPipeIdx !== -1) {
              const rawCell = line.text.slice(openPipeIdx + 1, prevPipeIdx)
              const trimStart = rawCell.search(/\S/)
              const cellStart =
                line.from + openPipeIdx + 1 + (trimStart >= 0 ? trimStart : 1)
              const cellEnd =
                line.from + openPipeIdx + 1 + rawCell.trimEnd().length
              view.dispatch({
                selection: { anchor: cellStart, head: Math.max(cellStart, cellEnd) }
              })
              return true
            }
          }

          // List item outdent by up to 2 spaces
          const indentMatch = line.text.match(/^( {1,2})(?:[-*+]|\d+\.)\s+/)
          if (indentMatch) {
            const removeLen = indentMatch[1].length
            view.dispatch({
              changes: { from: line.from, to: line.from + removeLen, insert: '' },
              selection: {
                anchor: Math.max(line.from, sel.anchor - removeLen),
                head: Math.max(line.from, sel.head - removeLen)
              }
            })
            return true
          }

          return false
        }
      }
    ])

    // Smart character wrapping when text is selected (*, _, `, ~, =, [, (, ", $)
    const smartSelectionWrapHandler = EditorView.inputHandler.of(
      (view, from, to, text) => {
        if (from >= to || text.length !== 1) return false
        const wrapPairs: Record<string, [string, string]> = {
          '*': ['*', '*'],
          _: ['_', '_'],
          '`': ['`', '`'],
          '~': ['~~', '~~'],
          '=': ['==', '=='],
          '(': ['(', ')'],
          '"': ['"', '"'],
          $: ['$', '$']
        }
        const selected = view.state.sliceDoc(from, to)
        if (text === '[') {
          const replacement = `[${selected}]()`
          view.dispatch({
            changes: { from, to, insert: replacement },
            selection: { anchor: from + selected.length + 3 }
          })
          return true
        }
        const pair = wrapPairs[text]
        if (pair) {
          const [open, close] = pair
          const replacement = `${open}${selected}${close}`
          view.dispatch({
            changes: { from, to, insert: replacement },
            selection: {
              anchor: from + open.length,
              head: from + open.length + selected.length
            }
          })
          return true
        }
        return false
      }
    )

    const startState = EditorState.create({
      doc: content,
      selection: { anchor: initialAnchor, head: initialHead },
      extensions: [
        history(),
        smartMarkdownKeymap,
        smartSelectionWrapHandler,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        ...(showLineNumbers || editMode === 'source' ? [lineNumbers()] : []),
        ...(wordWrap ? [EditorView.lineWrapping] : []),
        createSpellcheckExtension({
          enabled: spellcheckEnabled && !isVisualAssetFile,
          languages: spellcheckLanguages,
          customWords: combinedCustomWords,
          ignoredOccurrences: ignoredSpellOccurrences,
          onContextMenuMisspelledWord: (info) => {
            setSpellContextMenu(info)
          }
        }),
        createLivePreviewExtension({
          inlineRichMode: editMode === 'inline' && !isVisualAssetFile,
          rootId,
          onResolveConflict: (hunkIdx, res) => {
            if (res === '3way') {
              setThreeWayModalHunk(hunkIdx)
            } else {
              onResolveConflictHunk(hunkIdx, res)
            }
          },
          onNavigateLink: (target, isWiki) => {
            if (target.startsWith('#')) {
              const slug = target.slice(1).toLowerCase()
              const matchHeading = rendered?.headings.find(
                (h) => h.id.toLowerCase() === slug || h.text.toLowerCase() === slug
              )
              if (matchHeading) {
                jumpToLine(matchHeading.line)
              }
              return
            }
            onNavigateLink(target, isWiki)
          },
          onOpenExcalidraw: (relPath) => {
            onOpenExcalidrawModal?.(relPath)
          },
          onOpenMermaidBuilder: (currentCode, blockFrom, blockTo) => {
            setMermaidBuilderTarget({
              initialCode: currentCode,
              blockFrom,
              blockTo
            })
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextStr = update.state.doc.toString()
            latestContentRef.current = nextStr
            onChangeContent(nextStr)
          }

          if (update.selectionSet || update.docChanged || update.viewportChanged) {
            const sel = update.state.selection.main
            tabViewStateCache.set(tabCacheKey, {
              anchor: sel.anchor,
              head: sel.head,
              scrollTop:
                editorScrollWrapperRef.current?.scrollTop ??
                tabViewStateCache.get(tabCacheKey)?.scrollTop ??
                0
            })
            if (!sel.empty) {
              const selectedStr = update.state.sliceDoc(sel.from, sel.to)
              ;(window as any).__klartextSelectedText = selectedStr
              if (floatingToolbarEnabled) {
                const fromCoords = update.view.coordsAtPos(sel.from)
                const toCoords = update.view.coordsAtPos(sel.to) || fromCoords
                if (fromCoords && toCoords) {
                  const selectionTop = Math.min(fromCoords.top, toCoords.top)
                  const selectionBottom = Math.max(fromCoords.bottom, toCoords.bottom)
                  const selectionLeft = Math.min(fromCoords.left, toCoords.left)
                  // Always position directly above the selected text (or directly below if near the top edge)
                  const placeAbove = selectionTop > 110
                  const top = placeAbove ? selectionTop - 68 : selectionBottom + 8
                  const left = Math.max(
                    12,
                    Math.min(window.innerWidth - 420, selectionLeft)
                  )
                  setSelectionCoords({
                    top,
                    left,
                    selectedText: selectedStr
                  })
                }
              }
              if (editMode === 'split' && previewContainerRef.current) {
                highlightSelectionInPreview(previewContainerRef.current, selectedStr)
              }
            } else {
              if (update.view.hasFocus) {
                ;(window as any).__klartextSelectedText = ''
              }
              setSelectionCoords(null)
              if (editMode === 'split' && previewContainerRef.current) {
                clearPreviewHighlights(previewContainerRef.current)
              }
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

            const range = view.state.selection.main
            const textData = event.clipboardData?.getData('text/plain')

            // Smart URL paste over selected text -> [selected text](https://...)
            if (
              range.from < range.to &&
              textData &&
              /^https?:\/\/[^\s)]+$/i.test(textData.trim())
            ) {
              event.preventDefault()
              const selectedText = view.state.sliceDoc(range.from, range.to)
              const mdLink = `[${selectedText}](${textData.trim()})`
              view.dispatch({
                changes: { from: range.from, to: range.to, insert: mdLink },
                selection: { anchor: range.from + mdLink.length }
              })
              return true
            }

            // Smart TSV/CSV spreadsheet paste into GFM table when multiple tabs are detected
            if (textData && textData.includes('\t') && textData.includes('\n')) {
              event.preventDefault()
              const formattedTable = convertDelimitedTextToTable(textData)
              view.dispatch({
                changes: { from: range.from, to: range.to, insert: formattedTable }
              })
              return true
            }

            // Smart HTML paste conversion when rich HTML tags exist and plain text isn't already Markdown
            const htmlData = event.clipboardData?.getData('text/html')
            if (
              htmlData &&
              /<(?:h[1-6]|strong|b|em|i|a|ul|ol|li|table|blockquote|pre|code|del|mark)\b/i.test(
                htmlData
              ) &&
              (!textData || !/(?:^#{1,6}\s|\*\*|```|\[.+\]\(.+\))/m.test(textData))
            ) {
              const converted = convertHtmlToMarkdown(htmlData)
              if (converted && converted !== (textData || '').trim()) {
                event.preventDefault()
                view.dispatch({
                  changes: { from: range.from, to: range.to, insert: converted },
                  selection: { anchor: range.from + converted.length }
                })
                return true
              }
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

    // Restore cached scroll offset for this tab if available
    if (cachedTabState && cachedTabState.scrollTop > 0 && editorScrollWrapperRef.current) {
      requestAnimationFrame(() => {
        if (editorScrollWrapperRef.current) {
          editorScrollWrapperRef.current.scrollTop = cachedTabState.scrollTop
        }
      })
    }

    return () => {
      if (editorScrollWrapperRef.current) {
        const curSel = view.state.selection.main
        tabViewStateCache.set(tabCacheKey, {
          anchor: curSel.anchor,
          head: curSel.head,
          scrollTop: editorScrollWrapperRef.current.scrollTop
        })
      }
      view.destroy()
      viewRef.current = null
    }
  }, [
    rootId,
    relativePath,
    editMode,
    floatingToolbarEnabled,
    showLineNumbers,
    wordWrap,
    spellcheckEnabled,
    spellcheckLanguages.join(','),
    combinedCustomWords.join(','),
    ignoredSpellOccurrences.join(','),
    isVisualAssetFile,
    isSvgFile,
    showRawSvgSource
  ])

  // Synchronize external content updates into CodeMirror
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

  const assetProtocolUrl = `klartext-asset://${encodeURIComponent(rootId)}/${relativePath.replace(/^\.\//, '')}`

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
                onClick={() => jumpToLine(h.startLine)}
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

      {/* Asset / Image / Diagram Dedicated Header Bar when viewing an asset file */}
      {isVisualAssetFile ? (
        <div
          data-testid="svg-file-toolbar"
          className="flex items-center justify-between px-4 py-1.5 bg-panel border-b border-subtle text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">
              {isSvgFile
                ? 'SVG Vector Preview:'
                : isRasterImageAsset
                  ? 'Image Asset Viewer:'
                  : isPdfAsset
                    ? 'PDF Document Viewer:'
                    : 'Mermaid Diagram Asset:'}
            </span>
            <code className="font-mono text-muted">{relativePath}</code>
          </div>
          <div className="flex items-center gap-1.5">
            {(isSvgFile || isRasterImageAsset) && (
              <>
                <button
                  type="button"
                  data-tooltip="Zoom Out"
                  onClick={() => setAssetZoom((z) => Math.max(25, z - 25))}
                  className="p-1 rounded bg-secondary border border-subtle text-primary hover:border-accent"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 py-0.5 font-mono text-[11px] text-muted">
                  {assetZoom}%
                </span>
                <button
                  type="button"
                  data-tooltip="Zoom In"
                  onClick={() => setAssetZoom((z) => Math.min(300, z + 25))}
                  className="p-1 rounded bg-secondary border border-subtle text-primary hover:border-accent"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-tooltip="Reset Zoom (100%)"
                  onClick={() => setAssetZoom(100)}
                  className="p-1 rounded bg-secondary border border-subtle text-primary hover:border-accent"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {isSvgFile && (
              <button
                type="button"
                data-testid="toggle-svg-raw-source-btn"
                onClick={() => setShowRawSvgSource((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-secondary border border-subtle text-primary hover:border-accent"
              >
                {showRawSvgSource ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show SVG Image</span>
                  </>
                ) : (
                  <>
                    <FileCode className="w-3.5 h-3.5" />
                    <span>View Raw SVG Code</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Compact Editor Action & Formatting Strip for Markdown files (can be hidden via View menu) */
        formattingToolbarVisible && (
          <div
            className="flex items-center justify-between px-4 py-1 bg-panel border-b border-subtle text-xs overflow-x-auto no-scrollbar"
            data-testid="editor-formatting-bar"
          >
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                data-tooltip="Bold (⌘B)"
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
                data-tooltip="Italic (⌘I)"
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
                data-tooltip="Strikethrough (⇧⌘X)"
                aria-label="Strikethrough"
                data-testid="fmt-strike"
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
                data-tooltip="Highlight (==text==, ⇧⌘H)"
                aria-label="Highlight"
                data-testid="fmt-highlight"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('highlight')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Underline (<u>)"
                aria-label="Underline"
                data-testid="fmt-underline"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('underline')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Inline Code (`)"
                aria-label="Inline Code"
                data-testid="fmt-code"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('code')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Keyboard Key (<kbd>)"
                aria-label="Keyboard Key"
                data-testid="fmt-kbd"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('kbd')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Spoiler (>!text!<)"
                aria-label="Spoiler"
                data-testid="fmt-spoiler"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('spoiler')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-subtle mx-1" />
              <button
                type="button"
                data-tooltip="Heading 1 (#)"
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
                data-tooltip="Heading 2 (##)"
                aria-label="Heading 2"
                data-testid="fmt-h2"
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
                data-tooltip="Heading 3 (###)"
                aria-label="Heading 3"
                data-testid="fmt-h3"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('h3')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Heading3 className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-subtle mx-1" />
              <button
                type="button"
                data-tooltip="Task List (- [ ])"
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
                data-tooltip="Bulleted List (-)"
                aria-label="Bulleted List"
                data-testid="fmt-bullet"
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
                data-tooltip="Numbered List (1.)"
                aria-label="Numbered List"
                data-testid="fmt-numbered"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('numbered')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Blockquote (>)"
                aria-label="Blockquote"
                data-testid="fmt-quote"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('quote')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Callout / Alert (> [!NOTE])"
                aria-label="Callout"
                data-testid="fmt-callout"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('callout-note')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <AlertCircle className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-subtle mx-1" />
              <button
                type="button"
                data-tooltip="Insert Table"
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
                data-tooltip="Code Block (```)"
                aria-label="Code Block"
                data-testid="fmt-codeblock"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('codeblock')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <FileCode2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Math Formula ($...$)"
                aria-label="Math Formula"
                data-testid="fmt-math"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('math-inline')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Sigma className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Collapsible Details (<details>)"
                aria-label="Collapsible Details"
                data-testid="fmt-details"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('details')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <ChevronRightSquare className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Horizontal Rule (---)"
                aria-label="Horizontal Rule"
                data-testid="fmt-hr"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('hr')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Insert Link (⌘K)"
                aria-label="Insert Link"
                data-testid="fmt-link"
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
                data-tooltip="Insert Image"
                aria-label="Insert Image"
                data-testid="fmt-image"
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
                data-tooltip="Visual Diagram Builder"
                aria-label="Visual Mermaid Diagram Builder"
                data-testid="open-visual-mermaid-builder-btn"
                onClick={() => setMermaidBuilderTarget({})}
                className="p-1.5 rounded hover:bg-secondary text-accent"
              >
                <Workflow className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-subtle mx-1" />
              <button
                type="button"
                data-tooltip="Format & Align Document (⇧⌘I)"
                aria-label="Format Document"
                data-testid="fmt-format-doc"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('format-doc')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Wand2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Clear Formatting"
                aria-label="Clear Formatting"
                data-testid="fmt-clear"
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeFormat('clear-format')
                }}
                className="p-1.5 rounded hover:bg-secondary text-primary"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

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

      {/* Right-Click Spellcheck Suggestion Context Menu (with Word Explanations, Synonyms, Ignore Word & Ignore All, no red text) */}
      {spellContextMenu && (
        <div
          data-testid="spellcheck-context-menu"
          style={{
            top: Math.max(8, Math.min(window.innerHeight - 360, spellContextMenu.clientY)),
            left: Math.max(8, Math.min(window.innerWidth - 300, spellContextMenu.clientX))
          }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-72 rounded-md bg-panel border border-subtle shadow-xl py-1.5 text-xs max-h-[82vh] overflow-y-auto"
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase text-primary border-b border-subtle flex items-center justify-between">
            <span>Spelling: &ldquo;{spellContextMenu.word}&rdquo;</span>
            <span className="text-muted">{spellcheckLanguages.join(', ')}</span>
          </div>

          <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase text-muted">
            Suggested Corrections
          </div>
          {spellContextMenu.detailedSuggestions.length > 0 ? (
            spellContextMenu.detailedSuggestions.map((item) => (
              <button
                key={item.word}
                type="button"
                data-testid={`spellcheck-suggestion-${item.word}`}
                onClick={() => {
                  const view = viewRef.current
                  if (view) {
                    view.dispatch({
                      changes: {
                        from: spellContextMenu.from,
                        to: spellContextMenu.to,
                        insert: item.word
                      }
                    })
                  }
                  setSpellContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-primary">{item.word}</span>
                  <span className="text-[10px] text-accent">Replace</span>
                </div>
                <span className="text-[10px] text-muted leading-snug">
                  {item.explanation}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-1.5 text-muted italic">No close suggestions found</div>
          )}

          {spellContextMenu.synonyms.length > 0 && (
            <>
              <div className="my-1 border-t border-subtle" />
              <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase text-muted">
                Alternatives &amp; Synonyms
              </div>
              {spellContextMenu.synonyms.map((syn) => (
                <button
                  key={syn.word}
                  type="button"
                  data-testid={`spellcheck-synonym-${syn.word}`}
                  onClick={() => {
                    const view = viewRef.current
                    if (view) {
                      view.dispatch({
                        changes: {
                          from: spellContextMenu.from,
                          to: spellContextMenu.to,
                          insert: syn.word
                        }
                      })
                    }
                    setSpellContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-primary">{syn.word}</span>
                    <span className="text-[10px] text-muted">Use Synonym</span>
                  </div>
                  <span className="text-[10px] text-muted leading-snug">
                    {syn.explanation}
                  </span>
                </button>
              ))}
            </>
          )}

          <div className="my-1 border-t border-subtle" />

          <button
            type="button"
            data-testid="spellcheck-ignore-word-btn"
            onClick={() => {
              const occKey = `${spellContextMenu.from}:${spellContextMenu.to}:${spellContextMenu.word.toLowerCase()}`
              setIgnoredSpellOccurrences((prev) =>
                prev.includes(occKey) ? prev : [...prev, occKey]
              )
              setSpellContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary font-medium"
          >
            Ignore Misspelled Word
          </button>

          <button
            type="button"
            data-testid="spellcheck-ignore-all-btn"
            onClick={() => {
              const lower = spellContextMenu.word.toLowerCase()
              setSessionIgnoredWords((prev) =>
                prev.includes(lower) ? prev : [...prev, lower]
              )
              onAddWordToDictionary?.(spellContextMenu.word)
              setSpellContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary font-medium"
          >
            Ignore All (&ldquo;{spellContextMenu.word}&rdquo;)
          </button>

          {onChangeSpellcheckLanguage && (
            <div className="px-3 py-1.5 border-t border-subtle mt-1">
              <div className="text-[10px] text-muted mb-1">Language:</div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(SPELL_LANGUAGE_LABELS) as SupportedSpellLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      onChangeSpellcheckLanguage(lang)
                      setSpellContextMenu(null)
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] border ${
                      spellcheckLanguages.includes(lang)
                        ? 'bg-accent text-white border-accent'
                        : 'bg-app border-subtle text-muted'
                    }`}
                  >
                    {lang.split('-')[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Selection Toolbar (2 equal-width rows positioned directly above/below selected text, shown on mouseup with quick fade in/out) */}
      {(activeFloatingCoords || fadingOutCoords) && (
        <div
          data-testid={activeFloatingCoords ? 'floating-selection-toolbar' : 'floating-selection-toolbar-fading'}
          aria-hidden={!activeFloatingCoords}
          style={{
            position: 'fixed',
            top: `${(activeFloatingCoords || fadingOutCoords)!.top}px`,
            left: `${(activeFloatingCoords || fadingOutCoords)!.left}px`
          }}
          className={`z-40 flex flex-col gap-1 px-2 py-1.5 rounded-md bg-panel border border-subtle shadow-lg text-xs transition-opacity duration-150 ease-out ${
            activeFloatingCoords
              ? 'opacity-100 klartext-floating-menu-fade'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Row 1: Inline Text Styles, Headings, Collapsible & Blockquote (+ AI Improve Text, AI Fix Grammar & AI Custom Instruction when enabled) */}
          <div
            data-testid="floating-toolbar-row-1"
            style={{
              gridTemplateColumns: `repeat(${aiEnabled ? 16 : 13}, minmax(26px, 1fr))`
            }}
            className="w-full grid gap-0.5 items-center"
          >
            <button
              type="button"
              data-tooltip="Bold (⌘B)"
              data-testid="floating-bold-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('bold')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Italic (⌘I)"
              data-testid="floating-italic-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('italic')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Strikethrough (⇧⌘X)"
              data-testid="floating-strike-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('strikethrough')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Highlight (==)"
              data-testid="floating-highlight-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('highlight')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Underline (<u>)"
              data-testid="floating-underline-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('underline')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Inline Code (`)"
              data-testid="floating-code-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('code')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Keyboard Key (<kbd>)"
              data-testid="floating-kbd-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('kbd')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Spoiler (>! !<)"
              data-testid="floating-spoiler-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('spoiler')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Heading 1"
              data-testid="floating-h1-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('h1')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Heading 2"
              data-testid="floating-h2-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('h2')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Heading 3"
              data-testid="floating-h3-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('h3')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Blockquote (>)"
              data-testid="floating-quote-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('quote')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Collapsible Section (<details>)"
              data-testid="floating-collapsible-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('collapsible')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <ChevronRightSquare className="w-3.5 h-3.5" />
            </button>
            {aiEnabled && (
              <>
                <button
                  type="button"
                  data-tooltip="AI Improve Text"
                  aria-label="AI Improve Text"
                  data-testid="floating-ai-improve"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTriggerAIQuickAction(
                      'improve',
                      (activeFloatingCoords || fadingOutCoords)!.selectedText
                    )
                  }}
                  className="p-1 rounded bg-accent text-white font-medium flex items-center justify-center"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-tooltip="AI Fix Grammar"
                  aria-label="AI Fix Grammar"
                  data-testid="floating-ai-grammar"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTriggerAIQuickAction(
                      'grammar',
                      (activeFloatingCoords || fadingOutCoords)!.selectedText
                    )
                  }}
                  className="p-1 rounded bg-secondary text-accent hover:bg-accent hover:text-white font-medium flex items-center justify-center"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-tooltip="Ask AI / Custom Instruction..."
                  aria-label="Ask AI / Custom Instruction"
                  data-testid="floating-ai-custom-btn"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTriggerAIQuickAction(
                      'open-custom-dialog',
                      (activeFloatingCoords || fadingOutCoords)!.selectedText
                    )
                  }}
                  className="p-1 rounded bg-accent/15 text-accent border border-accent/40 hover:bg-accent hover:text-white font-bold text-[9px] tracking-tighter flex items-center justify-center"
                >
                  AI…
                </button>
              </>
            )}
          </div>

          {/* Row 2: Callouts, Lists, Tables, Blocks, Links, Media, Icons, Diagrams & Clear (+ AI Translate EN->SV & SV->EN when enabled) */}
          <div
            data-testid="floating-toolbar-row-2"
            style={{
              gridTemplateColumns: `repeat(${aiEnabled ? 15 : 13}, minmax(26px, 1fr))`,
              borderColor: 'color-mix(in srgb, var(--border-subtle) 15%, transparent)'
            }}
            className="w-full grid gap-0.5 items-center border-t border-subtle/15 pt-1"
          >
            <button
              type="button"
              data-tooltip="Callout Alert (> [!NOTE])"
              data-testid="floating-callout-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('callout-note')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <AlertCircle className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Task List"
              data-testid="floating-task-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('task')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Bulleted List"
              data-testid="floating-bullet-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('bullet')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Numbered List"
              data-testid="floating-numbered-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('numbered')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Insert Table"
              data-testid="floating-table-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('table')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Code Block"
              data-testid="floating-codeblock-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('codeblock')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <FileCode2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Math ($...$)"
              data-testid="floating-math-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('math-inline')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Sigma className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Insert Link (⌘K)"
              data-testid="floating-link-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('link')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Insert Image"
              data-testid="floating-image-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('image')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Insert Icon (⌘⇧I)"
              aria-label="Insert Icon"
              data-testid="floating-insert-icon-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                onOpenIconPicker?.()
              }}
              className="p-1 rounded hover:bg-secondary text-accent flex items-center justify-center"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Horizontal Rule (---)"
              data-testid="floating-hr-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('hr')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Clear Formatting"
              data-testid="floating-clear-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                executeFormat('clear-format')
              }}
              className="p-1 rounded hover:bg-secondary text-primary flex items-center justify-center"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-tooltip="Visual Diagram Builder"
              aria-label="Visual Diagram Builder"
              data-testid="floating-mermaid-builder-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                setMermaidBuilderTarget({})
              }}
              className="p-1 rounded hover:bg-secondary text-accent flex items-center justify-center"
            >
              <Workflow className="w-3.5 h-3.5" />
            </button>
            {aiEnabled && (
              <>
                <button
                  type="button"
                  data-tooltip="AI Translate EN -> SV"
                  aria-label="AI Translate EN -> SV"
                  data-testid="floating-ai-translate-en-sv"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTriggerAIQuickAction(
                      'translate-en-sv',
                      (activeFloatingCoords || fadingOutCoords)!.selectedText
                    )
                  }}
                  className="p-1 rounded bg-secondary text-primary hover:border-accent flex items-center justify-center text-[9px] font-bold tracking-tighter"
                >
                  EN→SV
                </button>
                <button
                  type="button"
                  data-tooltip="AI Translate SV -> EN"
                  aria-label="AI Translate SV -> EN"
                  data-testid="floating-ai-translate-sv-en"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTriggerAIQuickAction(
                      'translate-sv-en',
                      (activeFloatingCoords || fadingOutCoords)!.selectedText
                    )
                  }}
                  className="p-1 rounded bg-secondary text-primary hover:border-accent flex items-center justify-center text-[9px] font-bold tracking-tighter"
                >
                  SV→EN
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Editor / Visual Asset Viewer / Split Preview Area */}
      {isVisualAssetFile && !(isSvgFile && showRawSvgSource) ? (
        <div
          data-testid="svg-visual-preview-pane"
          className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto bg-app/50"
        >
          {isSvgFile ? (
            <div
              style={{ transform: `scale(${assetZoom / 100})`, transformOrigin: 'center center' }}
              className="max-w-4xl w-full p-6 rounded-lg border border-subtle bg-white shadow-sm flex items-center justify-center overflow-auto transition-transform"
              dangerouslySetInnerHTML={{
                __html: content.trim().startsWith('<')
                  ? sanitizeSvgContent(content)
                  : `<img src="${content.startsWith('data:') ? content : assetProtocolUrl}" alt="${relativePath}" class="max-w-full h-auto" />`
              }}
            />
          ) : isRasterImageAsset ? (
            <div
              data-testid="raster-asset-preview-pane"
              className="p-6 rounded-lg border border-subtle bg-panel shadow-sm flex flex-col items-center gap-3 overflow-auto max-w-full"
            >
              <img
                src={content.startsWith('data:') ? content : assetProtocolUrl}
                alt={relativePath}
                style={{ width: `${assetZoom}%`, maxWidth: `${assetZoom * 7}px` }}
                className="rounded border border-subtle object-contain"
              />
              <span className="text-xs font-mono text-muted">{relativePath}</span>
            </div>
          ) : isPdfAsset ? (
            <iframe
              title={relativePath}
              src={content.startsWith('data:') ? content : assetProtocolUrl}
              className="w-full h-full rounded-lg border border-subtle bg-white"
            />
          ) : (
            <div className="max-w-4xl w-full">
              <MermaidDiagramWidget
                code={content}
                theme={theme}
                onOpenVisualBuilder={(currentCode) =>
                  setMermaidBuilderTarget({ initialCode: currentCode })
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden relative editor-paper-surface">
          <div
            ref={editorScrollWrapperRef}
            data-margin-mode={marginMode}
            data-dynamic-margin-px={marginConfig.marginPx}
            style={
              {
                width: editMode === 'split' ? `${splitPercent}%` : '100%',
                '--editor-margin-x': `${marginConfig.marginPx}px`,
                '--editor-max-width': marginConfig.maxWidthCss
              } as React.CSSProperties
            }
            className={`h-full flex flex-col overflow-y-auto overflow-x-auto editor-paper-surface ${
              !wordWrap ? 'cm-editor-infinite-wrap' : ''
            }`}
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
              data-margin-mode={marginMode}
              data-dynamic-margin-px={marginConfig.marginPx}
              style={
                {
                  '--editor-margin-x': `${marginConfig.marginPx}px`,
                  '--editor-max-width': marginConfig.maxWidthCss
                } as React.CSSProperties
              }
              className="flex-grow flex-shrink-0 flex flex-col min-h-full min-w-full editor-paper-surface"
            />
          </div>

          {/* Draggable Vertical Resizer Handle in Split Mode */}
          {editMode === 'split' && (
            <div
              data-testid="split-resizer-handle"
              title="Drag to resize Split View"
              onMouseDown={(e) => {
                e.preventDefault()
                isDraggingSplitRef.current = true
              }}
              className="w-1.5 h-full cursor-col-resize bg-subtle hover:bg-accent transition-colors shrink-0 z-20"
            />
          )}

          {/* Split Mode Rendered Preview Pane */}
          {editMode === 'split' && (
            <div
              ref={previewContainerRef}
              data-testid="markdown-split-preview"
              data-margin-mode={marginMode}
              data-dynamic-margin-px={marginConfig.marginPx}
              style={{
                width: `${100 - splitPercent}%`,
                paddingLeft: `${marginConfig.marginPx}px`,
                paddingRight: `${marginConfig.marginPx}px`
              }}
              className="h-full overflow-y-auto py-8 editor-paper-surface"
              onMouseUp={() => {
                // Bidirectional selection: selecting text in the right preview selects matching text in left CodeMirror
                const sel = window.getSelection()?.toString().trim()
                if (sel && sel.length >= 2 && viewRef.current) {
                  const docText = viewRef.current.state.doc.toString()
                  const idx = docText.toLowerCase().indexOf(sel.toLowerCase())
                  if (idx !== -1) {
                    viewRef.current.dispatch({
                      selection: { anchor: idx, head: idx + sel.length },
                      effects: EditorView.scrollIntoView(idx, { y: 'center' })
                    })
                  }
                }
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                const anchor = target.closest('a')
                if (anchor) {
                  e.preventDefault()
                  const wikiAttr = anchor.getAttribute('data-wikilink')
                  if (wikiAttr) {
                    onNavigateLink(decodeURIComponent(wikiAttr), true)
                    return
                  }
                  const href = anchor.getAttribute('href') || ''
                  if (href.startsWith('#')) {
                    const slug = href.slice(1).toLowerCase()
                    const matchHeading = rendered?.headings.find(
                      (h) => h.id.toLowerCase() === slug || h.text.toLowerCase() === slug
                    )
                    if (matchHeading) {
                      jumpToLine(matchHeading.line)
                    }
                    return
                  }
                  if (href) {
                    onNavigateLink(href, false)
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
      )}

      {/* Visual Mermaid Diagram Builder Modal */}
      {mermaidBuilderTarget && (
        <VisualMermaidBuilderModal
          initialCode={mermaidBuilderTarget.initialCode}
          theme={theme}
          onClose={() => setMermaidBuilderTarget(null)}
          onInsertOrUpdateMermaid={(generatedMermaid) => {
            const view = viewRef.current
            const fenced = `\`\`\`mermaid\n${generatedMermaid}\n\`\`\``
            if (
              view &&
              typeof mermaidBuilderTarget.blockFrom === 'number' &&
              typeof mermaidBuilderTarget.blockTo === 'number'
            ) {
              view.dispatch({
                changes: {
                  from: mermaidBuilderTarget.blockFrom,
                  to: mermaidBuilderTarget.blockTo,
                  insert: fenced
                }
              })
            } else if (view) {
              const pos = view.state.selection.main.to
              view.dispatch({
                changes: { from: pos, to: pos, insert: `\n${fenced}\n` }
              })
            } else {
              onChangeContent(`${content}\n\n${fenced}\n`)
            }
          }}
        />
      )}

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
