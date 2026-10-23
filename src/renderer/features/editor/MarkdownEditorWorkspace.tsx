import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
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
  Smile,
  Search,
  X,
  ArrowUp,
  ChevronDown,
  Plus,
  Trash2
} from '../../components/icons/untitled-icons'
import type { EditMode, EditorMarginMode } from '../../../shared/types'
import {
  renderMarkdownDocument,
  convertDelimitedTextToTable,
  convertHtmlToMarkdown,
  type RenderedMarkdownResult
} from '../../../shared/markdown/pipeline'
import {
  detectMarkdownTableAtPosition,
  extractHeadingSectionFromMarkdown,
  manipulateMarkdownTable,
  resolveTransclusionsInMarkdown,
  type DetectedMarkdownTable,
  type TableManipulationAction,
  type WorkspaceDocEntry
} from '../../../shared/markdown/knowledge-features'
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
import {
  convertMarkdownToSlack,
  convertMarkdownToJira,
  convertMarkdownToGfm
} from '../../../shared/markdown/export-formats'

export type EditorDispatchedCommand =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'copy-rich-html'
  | 'copy-slack-md'
  | 'copy-jira-md'
  | 'copy-gfm-md'
  | 'toggle-inline-ai'
  | 'ai-improve'
  | 'open-mermaid-builder'
  | 'open-icon-picker'
  | 'open-in-doc-find'
  | MarkdownFormatCommand

export interface SlashCommandItem {
  id: string
  label: string
  description: string
  keywords: string[]
  badge: string
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'table',
    label: 'Table (3×2)',
    description: 'Insert a GitHub Flavored Markdown table',
    keywords: ['table', 'grid', 'spreadsheet', 'cols', 'rows'],
    badge: '⊞'
  },
  {
    id: 'task',
    label: 'Task Checklist',
    description: 'Insert interactive - [ ] task items',
    keywords: ['task', 'todo', 'checklist', 'checkbox'],
    badge: '☑'
  },
  {
    id: 'callout-note',
    label: 'Note Callout',
    description: 'Insert a > [!NOTE] highlighted callout block',
    keywords: ['callout', 'note', 'info', 'alert'],
    badge: 'ℹ'
  },
  {
    id: 'callout-warning',
    label: 'Warning Callout',
    description: 'Insert a > [!WARNING] alert callout block',
    keywords: ['warning', 'caution', 'important', 'callout'],
    badge: '⚠'
  },
  {
    id: 'codeblock',
    label: 'Code Block',
    description: 'Insert a syntax-highlighted fenced code block',
    keywords: ['code', 'codeblock', 'snippet', 'pre'],
    badge: '</>'
  },
  {
    id: 'mermaid',
    label: 'Mermaid Flowchart',
    description: 'Insert a live Mermaid diagram block',
    keywords: ['mermaid', 'diagram', 'flowchart', 'chart', 'graph'],
    badge: '◇'
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Top-level section heading (#)',
    keywords: ['h1', 'heading1', 'title'],
    badge: 'H1'
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading (##)',
    keywords: ['h2', 'heading2', 'subtitle'],
    badge: 'H2'
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Sub-section heading (###)',
    keywords: ['h3', 'heading3'],
    badge: 'H3'
  },
  {
    id: 'embed',
    label: 'Embed Note (![[Note]])',
    description: 'Transclude another note or heading section inline',
    keywords: ['embed', 'transclude', 'wikilink', 'note', 'include'],
    badge: '![[]]'
  },
  {
    id: 'date',
    label: "Today's Date",
    description: 'Insert current ISO date (YYYY-MM-DD)',
    keywords: ['date', 'today', 'now', 'time'],
    badge: '📅'
  },
  {
    id: 'hr',
    label: 'Horizontal Divider',
    description: 'Insert a thematic break line (---)',
    keywords: ['hr', 'divider', 'line', 'separator'],
    badge: '—'
  },
  {
    id: 'bookmark-card',
    label: 'Web Bookmark Card',
    description: 'Insert a rich Notion-style Web Bookmark Card',
    keywords: ['bookmark', 'card', 'url', 'link', 'web'],
    badge: '🔖'
  },
  {
    id: 'ai-custom',
    label: 'Ask AI / Custom Instruction...',
    description: 'Open custom AI instruction dialog at cursor',
    keywords: ['ai', 'ask', 'custom', 'generate', 'prompt'],
    badge: '✨'
  }
]

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
  aiModelConfigured?: boolean
  showLineNumbers: boolean
  wordWrap: boolean
  marginMode?: EditorMarginMode
  focusMode?: boolean
  workspaceDocuments?: WorkspaceDocEntry[]
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
  aiModelConfigured = false,
  showLineNumbers,
  wordWrap,
  marginMode = 'medium',
  focusMode = false,
  workspaceDocuments = [],
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
  const isAiReady = Boolean(aiEnabled && aiModelConfigured)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const editorScrollWrapperRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const latestContentRef = useRef(content)
  const lastHandledCommandNonceRef = useRef<number | null>(null)
  const lastHandledTextInsertNonceRef = useRef<number | null>(null)
  const workspaceDocumentsRef = useRef<WorkspaceDocEntry[]>(workspaceDocuments)
  workspaceDocumentsRef.current = workspaceDocuments

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

  // 2.1 `/` Slash Command Menu state
  const [slashMenuState, setSlashMenuState] = useState<{
    query: string
    replaceFrom: number
    replaceTo: number
    top: number
    left: number
    selectedIndex: number
  } | null>(null)
  const slashMenuStateRef = useRef(slashMenuState)
  slashMenuStateRef.current = slashMenuState

  // 2.2 Interactive Table Toolbar state
  const [activeTableInfo, setActiveTableInfo] = useState<DetectedMarkdownTable | null>(null)

  // 1.2 Hover Page Preview state (`[[WikiLink]]` popover card)
  const [wikiHoverPreview, setWikiHoverPreview] = useState<{
    rawTarget: string
    title: string
    rootName: string
    relativePath: string
    tags: string[]
    excerpt: string
    exists: boolean
    top: number
    left: number
  } | null>(null)
  const hoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1.2 Block Drag-and-Drop Handles (⋮⋮) & Turn Into menu state
  const [hoveredBlockLine, setHoveredBlockLine] = useState<{
    lineNumber: number
    top: number
    left: number
  } | null>(null)
  const [blockTurnIntoMenu, setBlockTurnIntoMenu] = useState<{
    lineNumber: number
    top: number
    left: number
  } | null>(null)
  const draggingBlockLineRef = useRef<number | null>(null)
  const [dropTargetBlockLine, setDropTargetBlockLine] = useState<number | null>(null)

  // 3.3 Footnote Hover Previews & Inline Footnote Editor state
  const [footnotePopover, setFootnotePopover] = useState<{
    footnoteId: string
    definitionText: string
    definitionLineNumber: number | null
    top: number
    left: number
  } | null>(null)
  const footnoteHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 3.4 Image Full-Screen Lightbox Zoom Modal state
  const [lightboxImage, setLightboxImage] = useState<{
    src: string
    caption: string
  } | null>(null)

  // 4.1 Smart URL Paste & Bookmark Card conversion banner state
  const [smartPastedUrlBanner, setSmartPastedUrlBanner] = useState<{
    url: string
    title: string
    description: string
    domain: string
    linkFrom: number
    linkTo: number
  } | null>(null)

  // 4.3 In-Document Find & Replace Bar (`Cmd+F`) state
  const [showInDocFindBar, setShowInDocFindBar] = useState(false)
  const [inDocFindQuery, setInDocFindQuery] = useState('')
  const [inDocReplaceText, setInDocReplaceText] = useState('')
  const [inDocMatchCase, setInDocMatchCase] = useState(false)
  const [inDocActiveMatchIdx, setInDocActiveMatchIdx] = useState(0)
  const inDocFindInputRef = useRef<HTMLInputElement | null>(null)

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

  // Filtered `/` Slash Command items
  const filteredSlashItems = useMemo(() => {
    const q = (slashMenuState?.query || '').trim().toLowerCase()
    if (!q) return SLASH_COMMAND_ITEMS
    return SLASH_COMMAND_ITEMS.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(q))
    )
  }, [slashMenuState?.query])
  const filteredSlashItemsRef = useRef(filteredSlashItems)
  filteredSlashItemsRef.current = filteredSlashItems

  const executeSlashCommand = (
    item: SlashCommandItem,
    overrideRange?: { replaceFrom: number; replaceTo: number }
  ) => {
    const view = viewRef.current
    const activeSlash = overrideRange || slashMenuStateRef.current
    if (!view || !activeSlash) return
    const { replaceFrom, replaceTo } = activeSlash
    setSlashMenuState(null)

    if (item.id === 'ai-custom') {
      view.dispatch({
        changes: { from: replaceFrom, to: replaceTo, insert: '' },
        selection: { anchor: replaceFrom }
      })
      onTriggerAIQuickActionRef.current('open-custom-dialog', '')
      return
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const firstDocTitle =
      workspaceDocumentsRef.current.find((d) => d.relativePath !== relativePath)?.title ||
      'Overview'

    let snippet = ''
    let cursorOffsetInSnippet = 0

    switch (item.id) {
      case 'table':
        snippet = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Value 1 | Value 2 | Value 3 |'
        cursorOffsetInSnippet = 2
        break
      case 'task':
        snippet = '- [ ] Task item'
        cursorOffsetInSnippet = snippet.length
        break
      case 'callout-note':
        snippet = '> [!NOTE] Key Note\n> Add important context here.'
        cursorOffsetInSnippet = snippet.length
        break
      case 'callout-warning':
        snippet = '> [!WARNING] Important Warning\n> Review carefully before proceeding.'
        cursorOffsetInSnippet = snippet.length
        break
      case 'codeblock':
        snippet = '```typescript\n\n```'
        cursorOffsetInSnippet = 14
        break
      case 'mermaid':
        snippet = '```mermaid\nflowchart LR\n  Start([Start]) --> Process[Action] --> End([Done])\n```'
        cursorOffsetInSnippet = snippet.length
        break
      case 'h1':
        snippet = '# '
        cursorOffsetInSnippet = 2
        break
      case 'h2':
        snippet = '## '
        cursorOffsetInSnippet = 3
        break
      case 'h3':
        snippet = '### '
        cursorOffsetInSnippet = 4
        break
      case 'embed':
        snippet = `![[${firstDocTitle}]]`
        cursorOffsetInSnippet = snippet.length - 2
        break
      case 'date':
        snippet = todayStr
        cursorOffsetInSnippet = snippet.length
        break
      case 'hr':
        snippet = '---\n'
        cursorOffsetInSnippet = snippet.length
        break
      case 'bookmark-card':
        snippet =
          ':::bookmark\nurl: https://example.com\ntitle: Example Website\ndescription: A clean web bookmark card preview.\ndomain: example.com\n:::'
        cursorOffsetInSnippet = snippet.length
        break
      default:
        snippet = ''
    }

    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert: snippet },
      selection: { anchor: replaceFrom + cursorOffsetInSnippet }
    })
    view.focus()
  }
  const executeSlashCommandRef = useRef(executeSlashCommand)
  executeSlashCommandRef.current = executeSlashCommand

  // 1.2 Block Drag-and-Drop Handle (`⋮⋮`) & "Turn Into" block converter
  const stripBlockPrefix = (rawLine: string): string => {
    return rawLine
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+\.\s+/, '')
      .replace(/^\s*>\s*\[![A-Z]+\]\s*/, '')
      .replace(/^\s*>\s?/, '')
      .trim()
  }

  const handleBlockTurnInto = (
    lineNumber: number,
    targetType:
      | 'paragraph'
      | 'h1'
      | 'h2'
      | 'h3'
      | 'bullet'
      | 'checklist'
      | 'callout'
      | 'toggle'
      | 'code'
  ) => {
    const view = viewRef.current
    if (!view) return
    const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines))
    const line = view.state.doc.line(safeLine)
    const coreText = stripBlockPrefix(line.text) || 'Section text'

    let replacement = coreText
    switch (targetType) {
      case 'paragraph':
        replacement = coreText
        break
      case 'h1':
        replacement = `# ${coreText}`
        break
      case 'h2':
        replacement = `## ${coreText}`
        break
      case 'h3':
        replacement = `### ${coreText}`
        break
      case 'bullet':
        replacement = `- ${coreText}`
        break
      case 'checklist':
        replacement = `- [ ] ${coreText}`
        break
      case 'callout':
        replacement = `> [!NOTE] ${coreText}\n> Additional callout details`
        break
      case 'toggle':
        replacement = `<details>\n<summary>${coreText}</summary>\n\nHidden toggle content\n</details>`
        break
      case 'code':
        replacement = `\`\`\`typescript\n${coreText}\n\`\`\``
        break
    }

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: replacement },
      selection: { anchor: line.from + replacement.length }
    })
    setBlockTurnIntoMenu(null)
    view.focus()
  }

  const handleReorderBlockLines = (sourceLineNumber: number, targetLineNumber: number) => {
    const view = viewRef.current
    if (!view) return
    const totalLines = view.state.doc.lines
    const src = Math.max(1, Math.min(sourceLineNumber, totalLines))
    const tgt = Math.max(1, Math.min(targetLineNumber, totalLines))
    if (src === tgt) return

    const lines = view.state.doc.toString().split('\n')
    const [movedLine] = lines.splice(src - 1, 1)
    lines.splice(tgt - 1, 0, movedLine)
    const nextDoc = lines.join('\n')
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextDoc }
    })
    const newLineObj = view.state.doc.line(Math.max(1, Math.min(tgt, view.state.doc.lines)))
    view.dispatch({
      selection: { anchor: newLineObj.from }
    })
    setBlockTurnIntoMenu(null)
    view.focus()
  }

  const handleBlockAction = (
    lineNumber: number,
    action: 'move-up' | 'move-down' | 'duplicate' | 'delete'
  ) => {
    const view = viewRef.current
    if (!view) return
    const totalLines = view.state.doc.lines
    const safeLine = Math.max(1, Math.min(lineNumber, totalLines))
    const line = view.state.doc.line(safeLine)

    if (action === 'move-up' && safeLine > 1) {
      handleReorderBlockLines(safeLine, safeLine - 1)
      return
    }
    if (action === 'move-down' && safeLine < totalLines) {
      handleReorderBlockLines(safeLine, safeLine + 1)
      return
    }
    if (action === 'duplicate') {
      const insertText = `\n${line.text}`
      view.dispatch({
        changes: { from: line.to, to: line.to, insert: insertText },
        selection: { anchor: line.to + insertText.length }
      })
      setBlockTurnIntoMenu(null)
      view.focus()
      return
    }
    if (action === 'delete') {
      const from = line.from > 0 ? line.from - 1 : line.from
      const to = line.from === 0 && line.to < view.state.doc.length ? line.to + 1 : line.to
      view.dispatch({
        changes: { from, to, insert: '' }
      })
      setBlockTurnIntoMenu(null)
      view.focus()
    }
  }

  // 3.3 Footnote Hover Previews & Inline Footnote Editor helpers
  const openFootnotePopover = (footnoteId: string, anchorRect: DOMRect) => {
    if (footnoteHideTimerRef.current) {
      clearTimeout(footnoteHideTimerRef.current)
      footnoteHideTimerRef.current = null
    }
    const docText = viewRef.current?.state.doc.toString() ?? latestContentRef.current
    const lines = docText.split('\n')
    const escapedId = footnoteId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const defRegex = new RegExp(`^\\[\\^${escapedId}\\]:\\s*(.*)$`)
    let foundLineNumber: number | null = null
    let foundText = ''
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(defRegex)
      if (m) {
        foundLineNumber = i + 1
        foundText = m[1].trim()
        break
      }
    }

    const top =
      anchorRect.bottom + 180 < window.innerHeight
        ? anchorRect.bottom + 6
        : Math.max(12, anchorRect.top - 170)
    const left = Math.max(12, Math.min(window.innerWidth - 360, anchorRect.left))

    setFootnotePopover({
      footnoteId,
      definitionText: foundText,
      definitionLineNumber: foundLineNumber,
      top,
      left
    })
  }

  const handleSaveFootnoteInlineEdit = () => {
    if (!footnotePopover) return
    const view = viewRef.current
    if (!view) return
    const { footnoteId, definitionText } = footnotePopover
    const docText = view.state.doc.toString()
    const escapedId = footnoteId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const defRegex = new RegExp(`^\\[\\^${escapedId}\\]:\\s*(.*)$`, 'm')
    const match = defRegex.exec(docText)
    const newDefLine = `[^${footnoteId}]: ${definitionText.trim()}`

    if (match && typeof match.index === 'number') {
      view.dispatch({
        changes: {
          from: match.index,
          to: match.index + match[0].length,
          insert: newDefLine
        }
      })
    } else {
      const suffix = `${docText.endsWith('\n') ? '\n' : '\n\n'}${newDefLine}\n`
      view.dispatch({
        changes: {
          from: docText.length,
          to: docText.length,
          insert: suffix
        }
      })
    }
    setFootnotePopover(null)
  }

  // 2.2 Interactive Table manipulation handler
  const handleManipulateTable = (action: TableManipulationAction) => {
    const view = viewRef.current
    if (!view) return
    const docText = view.state.doc.toString()
    const cursorPos = view.state.selection.main.head
    const nextContent = manipulateMarkdownTable(docText, cursorPos, action)
    if (nextContent !== docText) {
      view.dispatch({
        changes: { from: 0, to: docText.length, insert: nextContent },
        selection: { anchor: Math.min(cursorPos, nextContent.length) }
      })
      view.focus()
    }
  }

  // 4.3 In-Document Find & Replace matches computation
  const inDocMatches = useMemo(() => {
    const q = inDocFindQuery
    if (!showInDocFindBar || !q) return [] as Array<{ from: number; to: number }>
    const matches: Array<{ from: number; to: number }> = []
    const haystack = inDocMatchCase ? content : content.toLowerCase()
    const needle = inDocMatchCase ? q : q.toLowerCase()
    if (!needle) return matches
    let idx = 0
    while (idx <= haystack.length - needle.length) {
      const found = haystack.indexOf(needle, idx)
      if (found === -1) break
      matches.push({ from: found, to: found + needle.length })
      idx = found + Math.max(1, needle.length)
      if (matches.length >= 1000) break
    }
    return matches
  }, [showInDocFindBar, inDocFindQuery, inDocMatchCase, content])

  const selectInDocMatchAt = (matchIndex: number, focusEditor = false) => {
    if (inDocMatches.length === 0) return
    const safeIdx = ((matchIndex % inDocMatches.length) + inDocMatches.length) % inDocMatches.length
    setInDocActiveMatchIdx(safeIdx)
    const m = inDocMatches[safeIdx]
    const view = viewRef.current
    if (view && m) {
      view.dispatch({
        selection: { anchor: m.from, head: m.to },
        effects: EditorView.scrollIntoView(m.from, { y: 'center' })
      })
      if (focusEditor) view.focus()
    }
  }

  const handleInDocReplaceOne = () => {
    const view = viewRef.current
    if (!view || inDocMatches.length === 0) return
    const safeIdx = Math.min(inDocActiveMatchIdx, inDocMatches.length - 1)
    const m = inDocMatches[safeIdx]
    if (!m) return
    view.dispatch({
      changes: { from: m.from, to: m.to, insert: inDocReplaceText },
      selection: { anchor: m.from + inDocReplaceText.length }
    })
  }

  const handleInDocReplaceAll = () => {
    const view = viewRef.current
    if (!view || inDocMatches.length === 0 || !inDocFindQuery) return
    const changes = inDocMatches.map((m) => ({
      from: m.from,
      to: m.to,
      insert: inDocReplaceText
    }))
    view.dispatch({ changes })
  }

  // 1.2 Helper to populate and display the [[WikiLink]] Hover Page Preview card
  const openWikiHoverPreview = (rawTarget: string, anchorRect: DOMRect) => {
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current)
      hoverHideTimerRef.current = null
    }
    const hashIdx = rawTarget.indexOf('#')
    const targetNote = (hashIdx !== -1 ? rawTarget.slice(0, hashIdx) : rawTarget).trim()
    const targetHeading = hashIdx !== -1 ? rawTarget.slice(hashIdx + 1).trim() : ''
    const normTarget = targetNote.toLowerCase().replace(/\.(md|markdown)$/i, '')

    const matchedDoc = workspaceDocumentsRef.current.find((d) => {
      const base =
        d.relativePath
          .split('/')
          .pop()
          ?.toLowerCase()
          .replace(/\.(md|markdown)$/i, '') || ''
      const relNoExt = d.relativePath.toLowerCase().replace(/\.(md|markdown)$/i, '')
      return (
        base === normTarget ||
        relNoExt === normTarget ||
        d.title.toLowerCase() === normTarget
      )
    })

    const top =
      anchorRect.bottom + 220 < window.innerHeight
        ? anchorRect.bottom + 6
        : Math.max(12, anchorRect.top - 210)
    const left = Math.max(12, Math.min(window.innerWidth - 360, anchorRect.left))

    if (matchedDoc) {
      let bodyText = matchedDoc.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
      if (targetHeading) {
        const sec = extractHeadingSectionFromMarkdown(matchedDoc.content, targetHeading)
        if (sec) bodyText = sec
      }
      setWikiHoverPreview({
        rawTarget,
        title: targetHeading ? `${matchedDoc.title} › ${targetHeading}` : matchedDoc.title,
        rootName: matchedDoc.rootName,
        relativePath: matchedDoc.relativePath,
        tags: matchedDoc.tags || [],
        excerpt: bodyText.slice(0, 420) || '(Empty note)',
        exists: true,
        top,
        left
      })
    } else {
      setWikiHoverPreview({
        rawTarget,
        title: targetNote,
        rootName: 'Unresolved Note',
        relativePath: `${targetNote}.md`,
        tags: [],
        excerpt: `No note named "${targetNote}" exists yet. Click to navigate or create.`,
        exists: false,
        top,
        left
      })
    }
  }

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
    } else if (command === 'copy-slack-md') {
      const sel =
        view && view.state.selection.main.from < view.state.selection.main.to
          ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
          : latestContentRef.current
      const slackMd = convertMarkdownToSlack(sel)
      ;(window as any).__klartextCopiedExportText = slackMd
      navigator.clipboard?.writeText(slackMd).catch(() => {})
    } else if (command === 'copy-jira-md') {
      const sel =
        view && view.state.selection.main.from < view.state.selection.main.to
          ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
          : latestContentRef.current
      const jiraMd = convertMarkdownToJira(sel)
      ;(window as any).__klartextCopiedExportText = jiraMd
      navigator.clipboard?.writeText(jiraMd).catch(() => {})
    } else if (command === 'copy-gfm-md') {
      const sel =
        view && view.state.selection.main.from < view.state.selection.main.to
          ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
          : latestContentRef.current
      const gfmMd = convertMarkdownToGfm(sel)
      ;(window as any).__klartextCopiedExportText = gfmMd
      navigator.clipboard?.writeText(gfmMd).catch(() => {})
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
    } else if (command === 'open-in-doc-find') {
      const sel = view
        ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
        : ''
      if (sel && !sel.includes('\n')) {
        setInDocFindQuery(sel)
      }
      setShowInDocFindBar(true)
      setTimeout(() => inDocFindInputRef.current?.focus(), 20)
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

  // Listen for Cmd/Ctrl + J (inline AI) and Cmd/Ctrl + F (in-document Find & Replace)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j' && aiEnabled) {
        e.preventDefault()
        setShowInlineAIPrompt((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const view = viewRef.current
        const sel = view
          ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
          : ''
        if (sel && !sel.includes('\n')) {
          setInDocFindQuery(sel)
        }
        setShowInDocFindBar(true)
        setTimeout(() => inDocFindInputRef.current?.focus(), 20)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [aiEnabled])

  const conflictHunks =
    !isVisualAssetFile && hasConflictMarkers(content) ? parseConflictHunks(content) : []

  // Debounced Markdown AST & preview rendering (with ![[Note]] & ![[Note#Heading]] transclusion resolved)
  useEffect(() => {
    if (isVisualAssetFile) return
    let cancelled = false
    const timer = setTimeout(() => {
      const expandedContent = resolveTransclusionsInMarkdown(content, workspaceDocuments)
      renderMarkdownDocument(expandedContent, { rootId }).then((res) => {
        if (!cancelled) setRendered(res)
      })
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, rootId, isVisualAssetFile, workspaceDocuments])

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
        key: 'ArrowDown',
        run: () => {
          const menu = slashMenuStateRef.current
          const items = filteredSlashItemsRef.current
          if (!menu || items.length === 0) return false
          setSlashMenuState((prev) =>
            prev
              ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % items.length }
              : null
          )
          return true
        }
      },
      {
        key: 'ArrowUp',
        run: () => {
          const menu = slashMenuStateRef.current
          const items = filteredSlashItemsRef.current
          if (!menu || items.length === 0) return false
          setSlashMenuState((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: (prev.selectedIndex - 1 + items.length) % items.length
                }
              : null
          )
          return true
        }
      },
      {
        key: 'Escape',
        run: () => {
          if (slashMenuStateRef.current) {
            setSlashMenuState(null)
            return true
          }
          return false
        }
      },
      {
        key: 'Mod-f',
        run: (view) => {
          const sel = view.state.sliceDoc(
            view.state.selection.main.from,
            view.state.selection.main.to
          )
          if (sel && !sel.includes('\n')) {
            setInDocFindQuery(sel)
          }
          setShowInDocFindBar(true)
          setTimeout(() => inDocFindInputRef.current?.focus(), 20)
          return true
        }
      },
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
          // 0. If `/` Slash Command Menu is open, execute the selected command
          const activeSlash = slashMenuStateRef.current
          const slashItems = filteredSlashItemsRef.current
          if (activeSlash && slashItems.length > 0) {
            const chosen =
              slashItems[Math.min(activeSlash.selectedIndex, slashItems.length - 1)]
            if (chosen) {
              executeSlashCommandRef.current(chosen, {
                replaceFrom: activeSlash.replaceFrom,
                replaceTo: activeSlash.replaceTo
              })
              return true
            }
          }

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
        highlightActiveLine(),
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
          getWorkspaceDocuments: () => workspaceDocumentsRef.current,
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
          },
          onOpenImageLightbox: ({ src, caption }) => {
            setLightboxImage({ src, caption })
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
            const docStr = update.state.doc.toString()

            // 1.2 Keep block drag handle (`⋮⋮`) aligned with the active cursor block
            try {
              const activeLine = update.state.doc.lineAt(sel.head)
              const coords = update.view.coordsAtPos(activeLine.from)
              const containerRect = splitContainerRef.current?.getBoundingClientRect()
              if (coords && containerRect) {
                setHoveredBlockLine({
                  lineNumber: activeLine.number,
                  top: Math.max(4, coords.top - containerRect.top),
                  left: Math.max(6, coords.left - containerRect.left - 28)
                })
              } else {
                setHoveredBlockLine((prev) =>
                  prev ?? { lineNumber: activeLine.number, top: 18, left: 12 }
                )
              }
            } catch {
              // Ignore layout measure errors during rapid updates
            }

            // 2.2 Detect if cursor is inside a Markdown GFM table
            const detectedTable = detectMarkdownTableAtPosition(docStr, sel.head)
            setActiveTableInfo(detectedTable)

            // 2.1 Detect `/` Slash Command trigger at start of line or after whitespace
            if (sel.empty && !detectedTable) {
              const line = update.state.doc.lineAt(sel.head)
              const beforeCursor = line.text.slice(0, sel.head - line.from)
              const slashMatch = beforeCursor.match(/^(?:\s*|.+\s)\/([a-zA-Z0-9_-]*)$/)
              if (slashMatch) {
                const query = slashMatch[1] || ''
                const replaceFrom = sel.head - (query.length + 1)
                const replaceTo = sel.head
                const coords = update.view.coordsAtPos(sel.head)
                const top = coords
                  ? Math.min(window.innerHeight - 280, coords.bottom + 6)
                  : 140
                const left = coords
                  ? Math.max(16, Math.min(window.innerWidth - 320, coords.left))
                  : 120
                setSlashMenuState((prev) => ({
                  query,
                  replaceFrom,
                  replaceTo,
                  top,
                  left,
                  selectedIndex: prev && prev.query === query ? prev.selectedIndex : 0
                }))
              } else {
                setSlashMenuState(null)
              }
            } else {
              setSlashMenuState(null)
            }
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

            // 4.1 Smart standalone URL paste -> auto-format [Page Title](url) & offer Notion-style Bookmark Card
            if (
              range.from === range.to &&
              textData &&
              /^https?:\/\/[^\s)]+$/i.test(textData.trim())
            ) {
              event.preventDefault()
              const rawUrl = textData.trim()
              let fallbackDomain = 'website'
              try {
                fallbackDomain = new URL(rawUrl).hostname.replace(/^www\./, '')
              } catch {
                fallbackDomain = 'website'
              }
              const initialTitle = fallbackDomain
              const initialMdLink = `[${initialTitle}](${rawUrl})`
              const insertPos = range.from
              view.dispatch({
                changes: { from: insertPos, to: insertPos, insert: initialMdLink },
                selection: { anchor: insertPos + initialMdLink.length }
              })
              setSmartPastedUrlBanner({
                url: rawUrl,
                title: initialTitle,
                description: `Web page from ${fallbackDomain}`,
                domain: fallbackDomain,
                linkFrom: insertPos,
                linkTo: insertPos + initialMdLink.length
              })

              window.klartext
                ?.fetchUrlMetadata?.({ url: rawUrl })
                .then((meta) => {
                  if (!meta || !viewRef.current) return
                  const resolvedTitle = (meta.title || initialTitle).trim()
                  const resolvedDesc = (
                    meta.description || `Web page from ${meta.domain || fallbackDomain}`
                  ).trim()
                  const resolvedDomain = (meta.domain || fallbackDomain).trim()
                  const currentSlice = viewRef.current.state.sliceDoc(
                    insertPos,
                    Math.min(
                      viewRef.current.state.doc.length,
                      insertPos + initialMdLink.length
                    )
                  )
                  if (currentSlice === initialMdLink) {
                    const updatedLink = `[${resolvedTitle}](${rawUrl})`
                    viewRef.current.dispatch({
                      changes: {
                        from: insertPos,
                        to: insertPos + initialMdLink.length,
                        insert: updatedLink
                      },
                      selection: { anchor: insertPos + updatedLink.length }
                    })
                    setSmartPastedUrlBanner({
                      url: rawUrl,
                      title: resolvedTitle,
                      description: resolvedDesc,
                      domain: resolvedDomain,
                      linkFrom: insertPos,
                      linkTo: insertPos + updatedLink.length
                    })
                  } else {
                    setSmartPastedUrlBanner((prev) =>
                      prev && prev.url === rawUrl
                        ? {
                            ...prev,
                            title: resolvedTitle,
                            description: resolvedDesc,
                            domain: resolvedDomain
                          }
                        : prev
                    )
                  }
                })
                .catch(() => {})
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
    setHoveredBlockLine({ lineNumber: 1, top: 18, left: 12 })

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

      {/* 4.3 In-Document Find & Replace Bar (Cmd/Ctrl + F) */}
      {showInDocFindBar && !isVisualAssetFile && (
        <div
          data-testid="in-doc-find-bar"
          className="px-4 py-1.5 bg-secondary border-b border-subtle flex flex-wrap items-center justify-between gap-2 text-xs z-30"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-accent shrink-0" />
            <input
              ref={inDocFindInputRef}
              type="text"
              data-testid="in-doc-find-input"
              placeholder="Find in document..."
              value={inDocFindQuery}
              onChange={(e) => {
                setInDocFindQuery(e.target.value)
                setInDocActiveMatchIdx(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowInDocFindBar(false)
                  viewRef.current?.focus()
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  selectInDocMatchAt(
                    e.shiftKey ? inDocActiveMatchIdx - 1 : inDocActiveMatchIdx + 1,
                    false
                  )
                }
              }}
              className="w-44 px-2 py-1 rounded bg-panel border border-subtle text-primary text-xs"
            />
            <button
              type="button"
              data-testid="in-doc-match-case-btn"
              title="Match Case (Aa)"
              onClick={() => setInDocMatchCase((v) => !v)}
              className={`px-1.5 py-1 rounded border text-[10px] font-mono font-bold ${
                inDocMatchCase
                  ? 'bg-accent text-white border-accent'
                  : 'bg-panel border-subtle text-muted hover:text-primary'
              }`}
            >
              Aa
            </button>
            <span
              data-testid="in-doc-find-count"
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-[11px] font-mono text-muted min-w-[68px] text-center"
            >
              {inDocFindQuery
                ? inDocMatches.length > 0
                  ? `${Math.min(inDocActiveMatchIdx + 1, inDocMatches.length)} / ${inDocMatches.length}`
                  : '0 results'
                : 'Type to find'}
            </span>
            <button
              type="button"
              data-testid="in-doc-find-prev"
              title="Previous Match (Shift+Enter)"
              disabled={inDocMatches.length === 0}
              onClick={() => selectInDocMatchAt(inDocActiveMatchIdx - 1, true)}
              className="p-1 rounded bg-panel border border-subtle text-primary hover:border-accent disabled:opacity-40"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="in-doc-find-next"
              title="Next Match (Enter)"
              disabled={inDocMatches.length === 0}
              onClick={() => selectInDocMatchAt(inDocActiveMatchIdx + 1, true)}
              className="p-1 rounded bg-panel border border-subtle text-primary hover:border-accent disabled:opacity-40"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              data-testid="in-doc-replace-input"
              placeholder="Replace with..."
              value={inDocReplaceText}
              onChange={(e) => setInDocReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowInDocFindBar(false)
                  viewRef.current?.focus()
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  handleInDocReplaceOne()
                }
              }}
              className="w-40 px-2 py-1 rounded bg-panel border border-subtle text-primary text-xs"
            />
            <button
              type="button"
              data-testid="in-doc-replace-one"
              disabled={inDocMatches.length === 0}
              onClick={handleInDocReplaceOne}
              className="px-2 py-1 rounded bg-panel border border-subtle text-primary hover:border-accent disabled:opacity-40"
            >
              Replace
            </button>
            <button
              type="button"
              data-testid="in-doc-replace-all"
              disabled={inDocMatches.length === 0}
              onClick={handleInDocReplaceAll}
              className="px-2 py-1 rounded bg-accent text-white font-medium disabled:opacity-40"
            >
              Replace All
            </button>
            <button
              type="button"
              data-testid="in-doc-find-close"
              title="Close Find Bar (Esc)"
              onClick={() => {
                setShowInDocFindBar(false)
                viewRef.current?.focus()
              }}
              className="p-1 rounded hover:bg-panel text-muted hover:text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2.2 Interactive Table Editor Toolbar (shown automatically when cursor is inside a GFM table) */}
      {activeTableInfo && !isVisualAssetFile && (
        <div
          data-testid="interactive-table-toolbar"
          className="px-4 py-1 bg-secondary/90 border-b border-subtle flex items-center justify-between gap-2 text-[11px] overflow-x-auto no-scrollbar"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <TableIcon className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold text-primary">
              Table Controls (Row {activeTableInfo.activeRowIndex + 1}, Col{' '}
              {activeTableInfo.activeColIndex + 1})
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="table-add-row-above"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('add-row-above')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Row Above</span>
            </button>
            <button
              type="button"
              data-testid="table-add-row-below"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('add-row-below')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Row Below</span>
            </button>
            <button
              type="button"
              data-testid="table-delete-row"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('delete-row')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger hover:border-danger flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Del Row</span>
            </button>
            <span className="h-3.5 w-px bg-subtle mx-0.5" />
            <button
              type="button"
              data-testid="table-add-col-left"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('add-col-left')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Col Left</span>
            </button>
            <button
              type="button"
              data-testid="table-add-col-right"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('add-col-right')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Col Right</span>
            </button>
            <button
              type="button"
              data-testid="table-delete-col"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('delete-col')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger hover:border-danger flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Del Col</span>
            </button>
            <span className="h-3.5 w-px bg-subtle mx-0.5" />
            <button
              type="button"
              data-testid="table-align-left"
              title="Align Column Left"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('align-left')
              }}
              className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent font-mono"
            >
              ⇤
            </button>
            <button
              type="button"
              data-testid="table-align-center"
              title="Align Column Center"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('align-center')
              }}
              className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent font-mono"
            >
              ↔
            </button>
            <button
              type="button"
              data-testid="table-align-right"
              title="Align Column Right"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('align-right')
              }}
              className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent font-mono"
            >
              ⇥
            </button>
            <span className="h-3.5 w-px bg-subtle mx-0.5" />
            <button
              type="button"
              data-testid="table-sort-asc"
              title="Sort Column A → Z"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('sort-asc')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Sort A→Z
            </button>
            <button
              type="button"
              data-testid="table-sort-desc"
              title="Sort Column Z → A"
              onMouseDown={(e) => {
                e.preventDefault()
                handleManipulateTable('sort-desc')
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Sort Z→A
            </button>
          </div>
        </div>
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

      {/* 2.1 `/` Slash Command Floating Menu */}
      {slashMenuState && filteredSlashItems.length > 0 && (
        <div
          data-testid="slash-command-menu"
          style={{
            position: 'fixed',
            top: `${slashMenuState.top}px`,
            left: `${slashMenuState.left}px`
          }}
          className="z-50 w-72 max-h-72 overflow-y-auto rounded-lg bg-panel border border-subtle shadow-xl py-1.5 text-xs"
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-subtle flex items-center justify-between">
            <span>Slash Commands</span>
            <span className="font-mono text-accent">/{slashMenuState.query}</span>
          </div>
          {filteredSlashItems.map((item, idx) => {
            const isSelected =
              idx === Math.min(slashMenuState.selectedIndex, filteredSlashItems.length - 1)
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`slash-cmd-item-${item.id}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  executeSlashCommand(item)
                }}
                onMouseEnter={() =>
                  setSlashMenuState((prev) => (prev ? { ...prev, selectedIndex: idx } : null))
                }
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition-colors ${
                  isSelected
                    ? 'bg-accent/15 text-primary border-l-2 border-accent'
                    : 'hover:bg-secondary text-primary'
                }`}
              >
                <span className="w-7 h-6 rounded bg-secondary border border-subtle flex items-center justify-center font-mono text-[10px] font-bold text-accent shrink-0">
                  {item.badge}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-primary truncate">{item.label}</span>
                  <span className="text-[10px] text-muted truncate">{item.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 1.2 [[WikiLink]] Hover Page Preview Card */}
      {wikiHoverPreview && (
        <div
          data-testid="wikilink-hover-preview"
          style={{
            position: 'fixed',
            top: `${wikiHoverPreview.top}px`,
            left: `${wikiHoverPreview.left}px`
          }}
          onMouseEnter={() => {
            if (hoverHideTimerRef.current) {
              clearTimeout(hoverHideTimerRef.current)
              hoverHideTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            setWikiHoverPreview(null)
          }}
          className="z-50 w-80 rounded-lg bg-panel border border-subtle shadow-2xl p-3 text-xs flex flex-col gap-2"
        >
          <div className="flex items-start justify-between gap-2 border-b border-subtle pb-1.5">
            <div className="min-w-0">
              <div className="font-semibold text-primary truncate flex items-center gap-1.5">
                <span>📄</span>
                <span className="truncate">{wikiHoverPreview.title}</span>
              </div>
              <div className="text-[10px] font-mono text-muted truncate">
                {wikiHoverPreview.rootName} · {wikiHoverPreview.relativePath}
              </div>
            </div>
            <button
              type="button"
              data-testid="wikilink-hover-open-btn"
              onClick={() => {
                const target = wikiHoverPreview.rawTarget.split('#')[0].trim()
                setWikiHoverPreview(null)
                onNavigateLink(target, true)
              }}
              className="px-2 py-0.5 rounded bg-accent text-white text-[10px] font-medium shrink-0"
            >
              Open Note
            </button>
          </div>
          {wikiHoverPreview.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {wikiHoverPreview.tags.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-mono"
                >
                  {t.startsWith('#') ? t : `#${t}`}
                </span>
              ))}
            </div>
          )}
          <div className="text-[11px] text-primary whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto bg-secondary/40 rounded p-2 border border-subtle/60">
            {wikiHoverPreview.excerpt}
          </div>
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
          {/* Row 1: Inline Text Styles, Headings, Collapsible & Blockquote (+ AI Improve Text, AI Fix Grammar & AI Custom Instruction) */}
          <div
            data-testid="floating-toolbar-row-1"
            style={{
              gridTemplateColumns: 'repeat(16, minmax(26px, 1fr))'
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
            <button
              type="button"
              disabled={!isAiReady}
              aria-disabled={!isAiReady}
              data-tooltip={
                isAiReady ? 'AI Improve Text' : 'AI Improve Text (No AI model configured)'
              }
              aria-label="AI Improve Text"
              data-testid="floating-ai-improve"
              onMouseDown={(e) => {
                e.preventDefault()
                if (!isAiReady) return
                onTriggerAIQuickAction(
                  'improve',
                  (activeFloatingCoords || fadingOutCoords)!.selectedText
                )
              }}
              className={`p-1 rounded flex items-center justify-center ${
                isAiReady
                  ? 'bg-accent text-white font-medium'
                  : 'bg-secondary/50 text-muted opacity-40 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!isAiReady}
              aria-disabled={!isAiReady}
              data-tooltip={
                isAiReady ? 'AI Fix Grammar' : 'AI Fix Grammar (No AI model configured)'
              }
              aria-label="AI Fix Grammar"
              data-testid="floating-ai-grammar"
              onMouseDown={(e) => {
                e.preventDefault()
                if (!isAiReady) return
                onTriggerAIQuickAction(
                  'grammar',
                  (activeFloatingCoords || fadingOutCoords)!.selectedText
                )
              }}
              className={`p-1 rounded flex items-center justify-center ${
                isAiReady
                  ? 'bg-secondary text-accent hover:bg-accent hover:text-white font-medium'
                  : 'bg-secondary/50 text-muted opacity-40 cursor-not-allowed'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!isAiReady}
              aria-disabled={!isAiReady}
              data-tooltip={
                isAiReady
                  ? 'Ask AI / Custom Instruction...'
                  : 'Ask AI / Custom Instruction (No AI model configured)'
              }
              aria-label="Ask AI / Custom Instruction"
              data-testid="floating-ai-custom-btn"
              onMouseDown={(e) => {
                e.preventDefault()
                if (!isAiReady) return
                onTriggerAIQuickAction(
                  'open-custom-dialog',
                  (activeFloatingCoords || fadingOutCoords)!.selectedText
                )
              }}
              className={`p-1 rounded font-bold text-[9px] tracking-tighter flex items-center justify-center ${
                isAiReady
                  ? 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent hover:text-white'
                  : 'bg-secondary/50 text-muted border border-subtle/40 opacity-40 cursor-not-allowed'
              }`}
            >
              AI…
            </button>
          </div>

          {/* Row 2: Callouts, Lists, Tables, Blocks, Links, Media, Icons, Diagrams & Clear (+ AI Translate EN->SV & SV->EN) */}
          <div
            data-testid="floating-toolbar-row-2"
            style={{
              gridTemplateColumns: 'repeat(15, minmax(26px, 1fr))',
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
            <button
              type="button"
              disabled={!isAiReady}
              aria-disabled={!isAiReady}
              data-tooltip={
                isAiReady
                  ? 'AI Translate EN -> SV'
                  : 'AI Translate EN -> SV (No AI model configured)'
              }
              aria-label="AI Translate EN -> SV"
              data-testid="floating-ai-translate-en-sv"
              onMouseDown={(e) => {
                e.preventDefault()
                if (!isAiReady) return
                onTriggerAIQuickAction(
                  'translate-en-sv',
                  (activeFloatingCoords || fadingOutCoords)!.selectedText
                )
              }}
              className={`p-1 rounded flex items-center justify-center text-[9px] font-bold tracking-tighter ${
                isAiReady
                  ? 'bg-secondary text-primary hover:border-accent'
                  : 'bg-secondary/50 text-muted opacity-40 cursor-not-allowed'
              }`}
            >
              EN→SV
            </button>
            <button
              type="button"
              disabled={!isAiReady}
              aria-disabled={!isAiReady}
              data-tooltip={
                isAiReady
                  ? 'AI Translate SV -> EN'
                  : 'AI Translate SV -> EN (No AI model configured)'
              }
              aria-label="AI Translate SV -> EN"
              data-testid="floating-ai-translate-sv-en"
              onMouseDown={(e) => {
                e.preventDefault()
                if (!isAiReady) return
                onTriggerAIQuickAction(
                  'translate-sv-en',
                  (activeFloatingCoords || fadingOutCoords)!.selectedText
                )
              }}
              className={`p-1 rounded flex items-center justify-center text-[9px] font-bold tracking-tighter ${
                isAiReady
                  ? 'bg-secondary text-primary hover:border-accent'
                  : 'bg-secondary/50 text-muted opacity-40 cursor-not-allowed'
              }`}
            >
              SV→EN
            </button>
          </div>
        </div>
      )}

      {/* 4.1 Smart URL Paste & Bookmark Card Conversion Banner */}
      {smartPastedUrlBanner && !isVisualAssetFile && (
        <div
          data-testid="smart-url-paste-banner"
          className="px-4 py-1.5 bg-secondary/95 border-b border-subtle flex items-center justify-between gap-3 text-xs z-30"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-accent font-semibold">🔗 Smart URL Paste:</span>
            <span className="font-medium text-primary truncate">
              [{smartPastedUrlBanner.title}]({smartPastedUrlBanner.url})
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="convert-to-bookmark-card-btn"
              onClick={() => {
                const view = viewRef.current
                if (view) {
                  const cardSnippet = `:::bookmark\nurl: ${smartPastedUrlBanner.url}\ntitle: ${smartPastedUrlBanner.title}\ndescription: ${smartPastedUrlBanner.description}\ndomain: ${smartPastedUrlBanner.domain}\n:::`
                  const docText = view.state.doc.toString()
                  const expectedLink = `[${smartPastedUrlBanner.title}](${smartPastedUrlBanner.url})`
                  const idx = docText.indexOf(expectedLink)
                  const from = idx !== -1 ? idx : Math.min(smartPastedUrlBanner.linkFrom, docText.length)
                  const to =
                    idx !== -1
                      ? idx + expectedLink.length
                      : Math.min(smartPastedUrlBanner.linkTo, docText.length)
                  view.dispatch({
                    changes: { from, to, insert: cardSnippet },
                    selection: { anchor: from + cardSnippet.length }
                  })
                  view.focus()
                }
                setSmartPastedUrlBanner(null)
              }}
              className="px-2.5 py-0.5 rounded bg-accent text-white font-semibold hover:opacity-90"
            >
              Convert to Bookmark Card
            </button>
            <button
              type="button"
              data-testid="dismiss-smart-url-banner-btn"
              onClick={() => setSmartPastedUrlBanner(null)}
              className="p-1 rounded hover:bg-panel text-muted hover:text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3.3 Footnote Hover Preview & Inline Footnote Editor Popover */}
      {footnotePopover && (
        <div
          data-testid="footnote-hover-popover"
          style={{
            position: 'fixed',
            top: `${footnotePopover.top}px`,
            left: `${footnotePopover.left}px`
          }}
          onMouseEnter={() => {
            if (footnoteHideTimerRef.current) {
              clearTimeout(footnoteHideTimerRef.current)
              footnoteHideTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            setFootnotePopover(null)
          }}
          className="z-50 w-80 rounded-lg bg-panel border border-subtle shadow-2xl p-3 text-xs flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2 border-b border-subtle pb-1.5">
            <span className="font-semibold text-primary font-mono">
              Footnote [^{footnotePopover.footnoteId}]
            </span>
            <div className="flex items-center gap-1">
              {footnotePopover.definitionLineNumber !== null && (
                <button
                  type="button"
                  data-testid="footnote-jump-btn"
                  onClick={() => {
                    const targetLine = footnotePopover.definitionLineNumber
                    setFootnotePopover(null)
                    if (targetLine) jumpToLine(targetLine)
                  }}
                  className="px-2 py-0.5 rounded bg-secondary border border-subtle text-primary hover:border-accent text-[10px]"
                >
                  Jump to L{footnotePopover.definitionLineNumber}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFootnotePopover(null)}
                className="p-0.5 rounded text-muted hover:text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Inline Footnote Definition
            </label>
            <textarea
              rows={2}
              data-testid="footnote-inline-editor-input"
              value={footnotePopover.definitionText}
              placeholder={`Enter definition for [^${footnotePopover.footnoteId}]...`}
              onChange={(e) =>
                setFootnotePopover((prev) =>
                  prev ? { ...prev, definitionText: e.target.value } : null
                )
              }
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveFootnoteInlineEdit()
                }
              }}
              className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary text-xs resize-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                data-testid="footnote-inline-save-btn"
                onClick={handleSaveFootnoteInlineEdit}
                className="px-2.5 py-1 rounded bg-accent text-white font-semibold text-[11px]"
              >
                Save Footnote
              </button>
            </div>
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
        <div
          ref={splitContainerRef}
          onMouseMove={(e) => {
            const view = viewRef.current
            const container = splitContainerRef.current
            if (!view || !container) return
            const target = e.target as HTMLElement
            if (
              target.closest('[data-testid="block-drag-handle"]') ||
              target.closest('[data-testid="block-turn-into-menu"]')
            ) {
              return
            }
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
            if (pos !== null) {
              const line = view.state.doc.lineAt(pos)
              const coords = view.coordsAtPos(line.from)
              const rect = container.getBoundingClientRect()
              if (coords) {
                const nextTop = Math.max(4, Math.round(coords.top - rect.top))
                const nextLeft = Math.max(6, Math.round(coords.left - rect.left - 28))
                setHoveredBlockLine((prev) =>
                  prev && prev.lineNumber === line.number && Math.abs(prev.top - nextTop) < 3
                    ? prev
                    : { lineNumber: line.number, top: nextTop, left: nextLeft }
                )
              }
            }
          }}
          onDragOver={(e) => {
            if (draggingBlockLineRef.current !== null && viewRef.current) {
              e.preventDefault()
              const pos = viewRef.current.posAtCoords({ x: e.clientX, y: e.clientY })
              if (pos !== null) {
                const line = viewRef.current.state.doc.lineAt(pos)
                setDropTargetBlockLine(line.number)
              }
            }
          }}
          onDrop={(e) => {
            if (draggingBlockLineRef.current !== null && viewRef.current) {
              e.preventDefault()
              const srcLine = draggingBlockLineRef.current
              draggingBlockLineRef.current = null
              const pos = viewRef.current.posAtCoords({ x: e.clientX, y: e.clientY })
              const tgtLine =
                pos !== null
                  ? viewRef.current.state.doc.lineAt(pos).number
                  : dropTargetBlockLine
              setDropTargetBlockLine(null)
              if (tgtLine && tgtLine !== srcLine) {
                handleReorderBlockLines(srcLine, tgtLine)
              }
            }
          }}
          onMouseOver={(e) => {
            const target = e.target as HTMLElement
            const wikiEl = target.closest('[data-wikilink]') as HTMLElement | null
            if (wikiEl) {
              const rawWiki = wikiEl.getAttribute('data-wikilink')
              if (rawWiki) {
                openWikiHoverPreview(
                  decodeURIComponent(rawWiki),
                  wikiEl.getBoundingClientRect()
                )
              }
            }
            const fnEl = target.closest('[data-footnote-id]') as HTMLElement | null
            if (fnEl) {
              const fnId = fnEl.getAttribute('data-footnote-id')
              if (fnId) {
                openFootnotePopover(fnId, fnEl.getBoundingClientRect())
              }
            }
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement
            const fnEl = target.closest('[data-footnote-id]') as HTMLElement | null
            if (fnEl) {
              const fnId = fnEl.getAttribute('data-footnote-id')
              if (fnId) {
                openFootnotePopover(fnId, fnEl.getBoundingClientRect())
              }
            }
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLElement
            const wikiEl = target.closest('[data-wikilink]')
            if (wikiEl) {
              if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current)
              hoverHideTimerRef.current = setTimeout(() => {
                setWikiHoverPreview(null)
              }, 220)
            }
            const fnEl = target.closest('[data-footnote-id]')
            if (fnEl) {
              if (footnoteHideTimerRef.current) clearTimeout(footnoteHideTimerRef.current)
              footnoteHideTimerRef.current = setTimeout(() => {
                setFootnotePopover(null)
              }, 280)
            }
          }}
          className="flex-1 flex overflow-hidden relative editor-paper-surface"
        >
          {/* 1.2 Notion-Style Block Drag-and-Drop Grip Handle (`⋮⋮`) & "Turn Into" Menu */}
          {hoveredBlockLine && !isVisualAssetFile && (
            <button
              type="button"
              draggable
              data-testid="block-drag-handle"
              data-block-line={hoveredBlockLine.lineNumber}
              title={`Drag to reorder block L${hoveredBlockLine.lineNumber} or click to Turn Into...`}
              style={{
                position: 'absolute',
                top: `${hoveredBlockLine.top}px`,
                left: `${hoveredBlockLine.left}px`
              }}
              onDragStart={(e) => {
                draggingBlockLineRef.current = hoveredBlockLine.lineNumber
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(hoveredBlockLine.lineNumber))
              }}
              onDragEnd={() => {
                draggingBlockLineRef.current = null
                setDropTargetBlockLine(null)
              }}
              onClick={(e) => {
                e.stopPropagation()
                setBlockTurnIntoMenu((prev) =>
                  prev && prev.lineNumber === hoveredBlockLine.lineNumber
                    ? null
                    : {
                        lineNumber: hoveredBlockLine.lineNumber,
                        top: hoveredBlockLine.top + 22,
                        left: Math.max(8, hoveredBlockLine.left)
                      }
                )
              }}
              className="z-30 w-5 h-6 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-secondary/90 border border-transparent hover:border-subtle cursor-grab active:cursor-grabbing select-none font-mono text-xs transition-colors"
            >
              ⋮⋮
            </button>
          )}

          {blockTurnIntoMenu && (
            <div
              data-testid="block-turn-into-menu"
              style={{
                position: 'absolute',
                top: `${Math.min(blockTurnIntoMenu.top, 420)}px`,
                left: `${Math.max(12, blockTurnIntoMenu.left)}px`
              }}
              className="z-40 w-56 rounded-lg bg-panel border border-subtle shadow-2xl py-1.5 text-xs flex flex-col"
            >
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-subtle flex items-center justify-between">
                <span>Turn Block Into (L{blockTurnIntoMenu.lineNumber})</span>
                <button
                  type="button"
                  onClick={() => setBlockTurnIntoMenu(null)}
                  className="text-muted hover:text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                data-testid="block-turn-into-paragraph"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'paragraph')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Text / Paragraph</span>
                <span className="font-mono text-[10px] text-muted">¶</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-h1"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'h1')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Heading 1</span>
                <span className="font-mono text-[10px] text-accent">H1</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-h2"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'h2')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Heading 2</span>
                <span className="font-mono text-[10px] text-accent">H2</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-h3"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'h3')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Heading 3</span>
                <span className="font-mono text-[10px] text-accent">H3</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-bullet"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'bullet')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Bulleted List</span>
                <span className="font-mono text-[10px] text-muted">•</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-checklist"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'checklist')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Task Checklist</span>
                <span className="font-mono text-[10px] text-muted">☑</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-callout"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'callout')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Callout Block</span>
                <span className="font-mono text-[10px] text-accent">!NOTE</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-toggle"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'toggle')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Toggle List</span>
                <span className="font-mono text-[10px] text-muted">▸</span>
              </button>
              <button
                type="button"
                data-testid="block-turn-into-code"
                onClick={() => handleBlockTurnInto(blockTurnIntoMenu.lineNumber, 'code')}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Code Block</span>
                <span className="font-mono text-[10px] text-muted">&lt;/&gt;</span>
              </button>

              <div className="my-1 border-t border-subtle" />
              <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Block Actions
              </div>
              <button
                type="button"
                data-testid="block-action-move-up"
                onClick={() => handleBlockAction(blockTurnIntoMenu.lineNumber, 'move-up')}
                className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Move Block Up</span>
                <span className="font-mono text-[10px] text-muted">↑</span>
              </button>
              <button
                type="button"
                data-testid="block-action-move-down"
                onClick={() => handleBlockAction(blockTurnIntoMenu.lineNumber, 'move-down')}
                className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Move Block Down</span>
                <span className="font-mono text-[10px] text-muted">↓</span>
              </button>
              <button
                type="button"
                data-testid="block-action-duplicate"
                onClick={() => handleBlockAction(blockTurnIntoMenu.lineNumber, 'duplicate')}
                className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
              >
                <span>Duplicate Block</span>
                <span className="font-mono text-[10px] text-muted">⧉</span>
              </button>
              <button
                type="button"
                data-testid="block-action-delete"
                onClick={() => handleBlockAction(blockTurnIntoMenu.lineNumber, 'delete')}
                className="w-full text-left px-3 py-1 hover:bg-secondary text-danger flex items-center justify-between"
              >
                <span>Delete Block</span>
                <span className="font-mono text-[10px]">⌫</span>
              </button>
            </div>
          )}

          <div
            ref={editorScrollWrapperRef}
            data-margin-mode={marginMode}
            data-dynamic-margin-px={marginConfig.marginPx}
            data-focus-mode={focusMode ? 'true' : 'false'}
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
              data-focus-mode={focusMode ? 'true' : 'false'}
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

      {/* 3.4 Full-Screen Image Lightbox Zoom Modal */}
      {lightboxImage && (
        <div
          data-testid="image-lightbox-modal"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl max-h-[85vh] flex flex-col items-center gap-3 bg-panel border border-subtle rounded-xl p-4 shadow-2xl"
          >
            <div className="w-full flex items-center justify-between gap-4 border-b border-subtle pb-2 text-xs">
              <span className="font-semibold text-primary truncate">
                {lightboxImage.caption || 'Image Lightbox Preview'}
              </span>
              <button
                type="button"
                data-testid="image-lightbox-close-btn"
                onClick={() => setLightboxImage(null)}
                className="px-2.5 py-1 rounded bg-secondary border border-subtle text-primary hover:border-accent"
              >
                Close (Esc)
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.caption}
              className="max-w-full max-h-[72vh] object-contain rounded"
            />
            {lightboxImage.caption && (
              <div className="text-xs text-muted italic text-center">
                {lightboxImage.caption}
              </div>
            )}
          </div>
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
