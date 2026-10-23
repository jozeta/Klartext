import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PanelLeft,
  PanelRight,
  Maximize2,
  Sparkles,
  AlertCircle,
  GitBranch,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  HelpCircle,
  FileCode2,
  Smile,
  Columns,
  Copy,
  ArrowRightLeft,
  FolderOpen,
  FolderPlus,
  Download,
  FileText,
  BookOpen,
  Keyboard,
  Trash2,
  Calendar,
  CheckSquare,
  Info
} from '../components/icons/untitled-icons'
import type {
  AppSettings,
  BacklinkItem,
  DynamicFolderDef,
  DynamicWorkspaceDef,
  EditMode,
  FileTreeNode,
  GitRepoStatus,
  RecoverySnapshot,
  WorkspaceRoot
} from '../../shared/types'
import {
  DEFAULT_NORDIC_SAVED_THEMES,
  shouldRunScheduledUpdateCheck
} from '../../shared/constants'
import { DEFAULT_FRONTMATTER_PROPERTIES } from '../../shared/schemas'
import {
  parseTagListInput,
  type DynamicCandidateDocument
} from '../../shared/markdown/dynamic-workspace'
import {
  extractHeadings,
  extractFrontmatter,
  updateFrontmatterInMarkdown
} from '../../shared/markdown/pipeline'
import {
  DEFAULT_BUILT_IN_TEMPLATES,
  evaluateTemplateFileName,
  evaluateTemplateVariables,
  evaluateTemplateVariablesAsync,
  type TemplateEvaluationContext
} from '../../shared/templates/template-engine'
import { MultiRootSidebar, type LeftSidebarTab } from '../features/workspace/MultiRootSidebar'
import {
  GitHubWorkspaceWizardModal,
  DynamicWorkspaceWizardModal
} from '../features/workspace/WorkspaceWizards'
import {
  MarkdownEditorWorkspace,
  type EditorDispatchedCommand
} from '../features/editor/MarkdownEditorWorkspace'
import {
  SPELL_LANGUAGE_LABELS,
  type SupportedSpellLanguage
} from '../features/editor/spellcheck-extension'
import {
  LocalAIPanel,
  AICustomInstructionDialogModal
} from '../features/ai/LocalAIPanel'
import { TemplatesPanel } from '../features/templates/TemplatesPanel'
import { FrontmatterPropertiesPanel } from '../features/frontmatter/FrontmatterPropertiesPanel'
import {
  DailyNotesCalendarPanel,
  GlobalTasksRightPanel
} from '../features/productivity/RightProductivityPanels'
import { AboutModal, HelpModal, type HelpModalTab } from '../components/help/HelpModal'
import { ExcalidrawCanvasModal } from '../features/diagrams/DiagramWidgets'
import {
  CommandPaletteModal,
  SettingsModal,
  type CommandActionItem
} from '../components/command-palette/CommandPaletteAndSettings'
import { KnowledgeGraphModal } from '../features/knowledge/KnowledgeGraphModal'
import { SlideDeckModal } from '../features/presentation/SlideDeckModal'
import { WebClipperModal } from '../features/clipper/WebClipperModal'
import {
  extractGlobalTasks,
  findUnlinkedMentions,
  linkUnlinkedMentionInContent,
  refactorWikiLinksOnRename,
  toggleTaskAtLineInMarkdown,
  type GlobalTaskItem,
  type UnlinkedMentionItem,
  type WorkspaceDocEntry
} from '../../shared/markdown/knowledge-features'

export interface OpenDocumentTab {
  key: string
  rootId: string
  rootName: string
  relativePath: string
  content: string
  savedContent: string
  dirty: boolean
  externalConflictContent?: string
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [roots, setRoots] = useState<WorkspaceRoot[]>([])
  const [treesByRoot, setTreesByRoot] = useState<Record<string, FileTreeNode[]>>({})
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitRepoStatus>>({})

  const [tabs, setTabs] = useState<OpenDocumentTab[]>([])
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null)
  const [secondaryTabs, setSecondaryTabs] = useState<OpenDocumentTab[]>([])
  const [secondaryActiveTabKey, setSecondaryActiveTabKey] = useState<string | null>(null)
  const [focusedEditorPane, setFocusedEditorPane] = useState<'primary' | 'secondary'>('primary')
  const [editorWindowsSplitPercent, setEditorWindowsSplitPercent] = useState<number>(50)
  const [draggedDocTab, setDraggedDocTab] = useState<{
    fromPane: 'primary' | 'secondary'
    tab: OpenDocumentTab
  } | null>(null)
  const [dragOverPane, setDragOverPane] = useState<'primary' | 'secondary' | null>(null)
  const [tabContextMenu, setTabContextMenu] = useState<{
    pane: 'primary' | 'secondary'
    tab: OpenDocumentTab
    x: number
    y: number
  } | null>(null)

  const [editMode, setEditMode] = useState<EditMode>('inline')
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>('explorer')
  const [lastActiveRightPanel, setLastActiveRightPanel] = useState<
    'frontmatter' | 'ai' | 'templates' | 'help' | 'calendar' | 'tasks'
  >('ai')
  const [selectedFolder, setSelectedFolder] = useState<{
    rootId: string
    relativePath: string
  } | null>(null)
  const [systemEnvInfo, setSystemEnvInfo] = useState<{
    userName: string
    hostName: string
    osPlatform: string
    cpuArch: string
    cpuCores?: number
    memoryFree?: string
    uptime?: string
    ipLocal?: string
    appVersion: string
    envVars?: Record<string, string>
  }>({
    userName: 'user',
    hostName: 'localhost',
    osPlatform: 'macOS',
    cpuArch: 'arm64',
    appVersion: '1.1.0'
  })
  const [workspaceTemplateFiles, setWorkspaceTemplateFiles] = useState<
    Array<{
      id: string
      name: string
      rootId: string
      rootName: string
      relativePath: string
      content: string
    }>
  >([])
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [scrollToLine, setScrollToLine] = useState<{ line: number; nonce: number } | null>(null)
  const [editorCommandTrigger, setEditorCommandTrigger] = useState<{
    command: EditorDispatchedCommand
    nonce: number
  } | null>(null)
  const [textInsertTrigger, setTextInsertTrigger] = useState<{
    text: string
    cursorOffset: number | null
    nonce: number
  } | null>(null)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  const [showInsertMenu, setShowInsertMenu] = useState(false)
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [showHelpMenu, setShowHelpMenu] = useState(false)
  const [helpModalTab, setHelpModalTab] = useState<HelpModalTab>('formatting')
  const [customFrontmatterKey, setCustomFrontmatterKey] = useState('')

  // Top-level fixed Tooltip Portal state so tooltips are ALWAYS on top of everything
  const [portalTooltip, setPortalTooltip] = useState<{
    text: string
    top: number
    left: number
    pos: 'top' | 'bottom'
  } | null>(null)

  useEffect(() => {
    const updateTooltipFromTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        setPortalTooltip(null)
        return
      }
      const el = target.closest('[data-tooltip]') as HTMLElement | null
      if (!el) {
        setPortalTooltip(null)
        return
      }
      const text = el.getAttribute('data-tooltip')
      if (!text) {
        setPortalTooltip(null)
        return
      }
      const rect = el.getBoundingClientRect()
      const explicitPos = el.getAttribute('data-tooltip-pos')
      const pos: 'top' | 'bottom' =
        explicitPos === 'bottom' || (explicitPos !== 'top' && rect.top < 42)
          ? 'bottom'
          : 'top'
      const rawLeft = rect.left + rect.width / 2
      const clampedLeft = Math.max(64, Math.min(window.innerWidth - 64, rawLeft))
      const top = pos === 'top' ? rect.top - 7 : rect.bottom + 7
      setPortalTooltip({ text, top, left: clampedLeft, pos })
    }

    document.body.dataset.portalTooltips = 'true'
    const onMouseOver = (e: MouseEvent) => updateTooltipFromTarget(e.target)
    const onMouseDown = () => setPortalTooltip(null)
    const onScroll = () => setPortalTooltip(null)
    window.addEventListener('mouseover', onMouseOver, true)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      delete document.body.dataset.portalTooltips
      window.removeEventListener('mouseover', onMouseOver, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  // Tab bar horizontal scroll state when many tabs are open
  const tabBarScrollRef = useRef<HTMLDivElement | null>(null)
  const [tabBarHasOverflow, setTabBarHasOverflow] = useState(false)

  // Modals & Overlays
  const [paletteMode, setPaletteMode] = useState<'commands' | 'files' | 'icons' | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showSlideDeckModal, setShowSlideDeckModal] = useState(false)
  const [showWebClipperModal, setShowWebClipperModal] = useState(false)
  const [excalidrawTarget, setExcalidrawTarget] = useState<{
    rootId: string
    relativePath: string
  } | null>(null)
  const [recoverySnapshots, setRecoverySnapshots] = useState<RecoverySnapshot[]>([])
  const [crossRootMovePrompt, setCrossRootMovePrompt] = useState<{
    sourceRootId: string
    sourceRelativePath: string
    targetRootId: string
    referencedAssets: string[]
  } | null>(null)
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null)

  // Local AI streaming & diff review state
  const [pendingAIDiff, setPendingAIDiff] = useState<{
    originalText: string
    proposedText: string
    isStreaming: boolean
    requestId: string
    error?: string
  } | null>(null)
  const [aiInstructionDialog, setAiInstructionDialog] = useState<{
    open: boolean
    selectedText: string
  } | null>(null)

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const primaryActiveTab = useMemo(
    () => tabs.find((t) => t.key === activeTabKey) || tabs[0] || null,
    [tabs, activeTabKey]
  )
  const secondaryActiveTab = useMemo(
    () =>
      secondaryTabs.find((t) => t.key === secondaryActiveTabKey) ||
      secondaryTabs[0] ||
      null,
    [secondaryTabs, secondaryActiveTabKey]
  )
  const activeTab = useMemo(() => {
    if (focusedEditorPane === 'secondary' && secondaryActiveTab) {
      return secondaryActiveTab
    }
    return primaryActiveTab || secondaryActiveTab || null
  }, [focusedEditorPane, primaryActiveTab, secondaryActiveTab])

  // Automatically close an editor pane when its last tab is closed or all tabs are dragged to the other side
  useEffect(() => {
    if (tabs.length === 0 && secondaryTabs.length > 0) {
      setTabs(secondaryTabs)
      setActiveTabKey(secondaryActiveTabKey || secondaryTabs[0]?.key || null)
      setSecondaryTabs([])
      setSecondaryActiveTabKey(null)
      setFocusedEditorPane('primary')
    } else if (secondaryTabs.length === 0 && focusedEditorPane === 'secondary') {
      setFocusedEditorPane('primary')
    }
  }, [tabs.length, secondaryTabs, secondaryActiveTabKey, focusedEditorPane])

  const closeTabInPane = useCallback(
    (pane: 'primary' | 'secondary', tabKey: string) => {
      if (pane === 'primary') {
        setTabs((prev) => {
          const remaining = prev.filter((t) => t.key !== tabKey)
          if (activeTabKey === tabKey) {
            setActiveTabKey(remaining[0]?.key || null)
          }
          return remaining
        })
      } else {
        setSecondaryTabs((prev) => {
          const remaining = prev.filter((t) => t.key !== tabKey)
          if (secondaryActiveTabKey === tabKey) {
            setSecondaryActiveTabKey(remaining[0]?.key || null)
          }
          return remaining
        })
      }
    },
    [activeTabKey, secondaryActiveTabKey]
  )

  const splitTabView = useCallback(
    (pane: 'primary' | 'secondary', tab: OpenDocumentTab) => {
      if (pane === 'primary') {
        setSecondaryTabs((prev) =>
          prev.some((t) => t.key === tab.key) ? prev : [...prev, { ...tab }]
        )
        setSecondaryActiveTabKey(tab.key)
        setFocusedEditorPane('secondary')
        if (tabs.length > 1) {
          const remaining = tabs.filter((t) => t.key !== tab.key)
          setTabs(remaining)
          if (activeTabKey === tab.key && remaining[0]) {
            setActiveTabKey(remaining[0].key)
          }
        }
      } else {
        setTabs((prev) =>
          prev.some((t) => t.key === tab.key) ? prev : [...prev, { ...tab }]
        )
        setActiveTabKey(tab.key)
        setFocusedEditorPane('primary')
        if (secondaryTabs.length > 1) {
          const remaining = secondaryTabs.filter((t) => t.key !== tab.key)
          setSecondaryTabs(remaining)
          if (secondaryActiveTabKey === tab.key && remaining[0]) {
            setSecondaryActiveTabKey(remaining[0].key)
          }
        }
      }
    },
    [tabs, secondaryTabs, activeTabKey, secondaryActiveTabKey]
  )

  const duplicateTabView = useCallback(
    (pane: 'primary' | 'secondary', tab: OpenDocumentTab) => {
      if (pane === 'primary') {
        setSecondaryTabs((prev) =>
          prev.some((t) => t.key === tab.key) ? prev : [...prev, { ...tab }]
        )
        setSecondaryActiveTabKey(tab.key)
        setFocusedEditorPane('secondary')
      } else {
        setTabs((prev) =>
          prev.some((t) => t.key === tab.key) ? prev : [...prev, { ...tab }]
        )
        setActiveTabKey(tab.key)
        setFocusedEditorPane('primary')
      }
    },
    []
  )

  const moveTabToPane = useCallback(
    (
      fromPane: 'primary' | 'secondary',
      toPane: 'primary' | 'secondary',
      tab: OpenDocumentTab,
      targetBeforeKey?: string
    ) => {
      if (fromPane === toPane) {
        if (!targetBeforeKey || targetBeforeKey === tab.key) return
        const reorder = (list: OpenDocumentTab[]) => {
          const without = list.filter((t) => t.key !== tab.key)
          const idx = without.findIndex((t) => t.key === targetBeforeKey)
          if (idx < 0) return [...without, tab]
          const next = [...without]
          next.splice(idx, 0, tab)
          return next
        }
        if (toPane === 'primary') setTabs(reorder)
        else setSecondaryTabs(reorder)
        return
      }

      if (fromPane === 'primary' && toPane === 'secondary') {
        const remainingPrimary = tabs.filter((t) => t.key !== tab.key)
        setTabs(remainingPrimary)
        if (activeTabKey === tab.key) {
          setActiveTabKey(remainingPrimary[0]?.key || null)
        }
        setSecondaryTabs((prev) => {
          const without = prev.filter((t) => t.key !== tab.key)
          if (targetBeforeKey) {
            const idx = without.findIndex((t) => t.key === targetBeforeKey)
            if (idx >= 0) {
              const next = [...without]
              next.splice(idx, 0, tab)
              return next
            }
          }
          return [...without, tab]
        })
        setSecondaryActiveTabKey(tab.key)
        setFocusedEditorPane('secondary')
      } else if (fromPane === 'secondary' && toPane === 'primary') {
        const remainingSecondary = secondaryTabs.filter((t) => t.key !== tab.key)
        setSecondaryTabs(remainingSecondary)
        if (secondaryActiveTabKey === tab.key) {
          setSecondaryActiveTabKey(remainingSecondary[0]?.key || null)
        }
        setTabs((prev) => {
          const without = prev.filter((t) => t.key !== tab.key)
          if (targetBeforeKey) {
            const idx = without.findIndex((t) => t.key === targetBeforeKey)
            if (idx >= 0) {
              const next = [...without]
              next.splice(idx, 0, tab)
              return next
            }
          }
          return [...without, tab]
        })
        setActiveTabKey(tab.key)
        setFocusedEditorPane('primary')
      }
    },
    [tabs, secondaryTabs, activeTabKey, secondaryActiveTabKey]
  )

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    const mode = settings?.theme || 'light'
    if (mode === 'dark') return 'dark'
    if (mode === 'light') return 'light'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [settings?.theme])

  // Resizable Left & Unified Right Sidebar width (constant across all right panels)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(260)
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(340)
  const activeSidebarDragRef = useRef<
    | 'left'
    | 'frontmatter'
    | 'right'
    | 'templates'
    | 'help'
    | 'calendar'
    | 'tasks'
    | 'editor-windows'
    | null
  >(null)
  const editorMainContainerRef = useRef<HTMLElement | null>(null)

  const updateTabBarOverflow = useCallback(() => {
    const el = tabBarScrollRef.current
    if (!el) {
      setTabBarHasOverflow(false)
      return
    }
    setTabBarHasOverflow(el.scrollWidth > el.clientWidth + 4 || tabs.length > 5)
  }, [tabs.length])

  useEffect(() => {
    updateTabBarOverflow()
    window.addEventListener('resize', updateTabBarOverflow)
    return () => window.removeEventListener('resize', updateTabBarOverflow)
  }, [
    updateTabBarOverflow,
    tabs.length,
    leftSidebarWidth,
    rightSidebarWidth,
    settings?.pageTabsPosition
  ])

  useEffect(() => {
    if (settings?.leftSidebarWidth) setLeftSidebarWidth(settings.leftSidebarWidth)
    if (settings?.rightSidebarWidth) {
      setRightSidebarWidth(settings.rightSidebarWidth)
    }
  }, [settings?.leftSidebarWidth, settings?.rightSidebarWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!activeSidebarDragRef.current) return
      if (activeSidebarDragRef.current === 'left') {
        const nextW = Math.max(180, Math.min(520, e.clientX))
        setLeftSidebarWidth(nextW)
      } else if (activeSidebarDragRef.current === 'editor-windows') {
        const container = editorMainContainerRef.current
        if (container) {
          const rect = container.getBoundingClientRect()
          if (rect.width > 100) {
            const pct = ((e.clientX - rect.left) / rect.width) * 100
            setEditorWindowsSplitPercent(Math.max(20, Math.min(80, Math.round(pct))))
          }
        }
      } else {
        const nextW = Math.max(240, Math.min(640, window.innerWidth - e.clientX))
        setRightSidebarWidth(nextW)
      }
    }
    const onMouseUp = () => {
      if (activeSidebarDragRef.current === 'left') {
        window.klartext.updateSettings({ leftSidebarWidth }).catch(() => {})
      } else if (
        activeSidebarDragRef.current &&
        activeSidebarDragRef.current !== 'editor-windows'
      ) {
        window.klartext
          .updateSettings({
            rightSidebarWidth,
            frontmatterSidebarWidth: rightSidebarWidth,
            templatesSidebarWidth: rightSidebarWidth,
            helpSidebarWidth: rightSidebarWidth
          })
          .catch(() => {})
      }
      activeSidebarDragRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [leftSidebarWidth, rightSidebarWidth])

  const dispatchEditorCommand = useCallback((command: EditorDispatchedCommand) => {
    setEditorCommandTrigger({ command, nonce: Date.now() + Math.random() })
  }, [])

  const dispatchTextInsert = useCallback((text: string, cursorOffset: number | null = null) => {
    setTextInsertTrigger({ text, cursorOffset, nonce: Date.now() + Math.random() })
  }, [])

  // Auto-collapse File, Edit, View, Format, Insert, AI, Help & Tab context menus when clicking anywhere in the app
  useEffect(() => {
    if (
      !showFileMenu &&
      !showEditMenu &&
      !showViewMenu &&
      !showFormatMenu &&
      !showInsertMenu &&
      !showAIMenu &&
      !showHelpMenu &&
      !tabContextMenu
    )
      return
    const handleGlobalClick = () => {
      setShowFileMenu(false)
      setShowEditMenu(false)
      setShowViewMenu(false)
      setShowFormatMenu(false)
      setShowInsertMenu(false)
      setShowAIMenu(false)
      setShowHelpMenu(false)
      setTabContextMenu(null)
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [
    showFileMenu,
    showEditMenu,
    showViewMenu,
    showFormatMenu,
    showInsertMenu,
    showAIMenu,
    showHelpMenu,
    tabContextMenu
  ])

  // Apply theme, highlight color, custom theme colors, & granular typography CSS variables to documentElement
  useEffect(() => {
    const rootEl = document.documentElement
    rootEl.setAttribute('data-theme', resolvedTheme)
    rootEl.setAttribute('data-light-paper', String(Boolean(settings?.lightPaperInDarkMode)))
    if (settings) {
      const typo = settings.typography
      rootEl.style.setProperty('--font-editor', typo.bodyFontFamily)
      rootEl.style.setProperty('--font-mono', typo.monoFontFamily)
      rootEl.style.setProperty('--editor-font-size', `${typo.fontSizePx}px`)
      rootEl.style.setProperty('--code-font-size', `${typo.codeFontSizePx ?? 14}px`)
      rootEl.style.setProperty('--editor-line-height', String(typo.lineHeight))
      rootEl.style.setProperty(
        '--editor-max-width',
        typo.fullWidth || settings.wordWrap === false
          ? '100%'
          : `${typo.maxLineWidthCh}ch`
      )
      if (typo.bodyColor) {
        rootEl.style.setProperty('--text-editor-custom', typo.bodyColor)
      } else {
        rootEl.style.removeProperty('--text-editor-custom')
      }

      const defaultSizes: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', number> = {
        h1: 1.85,
        h2: 1.45,
        h3: 1.2,
        h4: 1.08,
        h5: 1.0,
        h6: 0.92
      }

      ;(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((lvl) => {
        const hCfg = typo.headings?.[lvl]
        rootEl.style.setProperty(
          `--${lvl}-font-family`,
          hCfg?.fontFamily || 'var(--font-editor)'
        )
        rootEl.style.setProperty(
          `--${lvl}-font-size`,
          `${hCfg?.fontSizeEm ?? defaultSizes[lvl]}em`
        )
        rootEl.style.setProperty(
          `--${lvl}-color`,
          hCfg?.color || 'var(--text-editor-effective)'
        )
      })

      const activeAccent =
        settings.highlightColor || settings.accentColorOverride || '#4C78A8'
      rootEl.style.setProperty('--accent-primary', activeAccent)
      rootEl.style.setProperty('--accent-hover', activeAccent)
      rootEl.style.setProperty('--highlight-color', activeAccent)

      const customColors = settings.customThemeColors || {}
      if (customColors.bgApp) rootEl.style.setProperty('--bg-app', customColors.bgApp)
      else rootEl.style.removeProperty('--bg-app')

      if (customColors.bgPanel) rootEl.style.setProperty('--bg-panel', customColors.bgPanel)
      else rootEl.style.removeProperty('--bg-panel')

      if (customColors.bgEditor) rootEl.style.setProperty('--bg-editor', customColors.bgEditor)
      else rootEl.style.removeProperty('--bg-editor')

      if (customColors.textPrimary) {
        rootEl.style.setProperty('--text-primary', customColors.textPrimary)
      } else {
        rootEl.style.removeProperty('--text-primary')
      }
    }
  }, [resolvedTheme, settings])

  const isBootedRef = useRef(false)

  const handleUpdateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const effective: Partial<AppSettings> = { ...partial }
    // Enforce mutual exclusion on the right side: only one right panel visible at a time
    if (effective.frontmatterPanelVisible === true) {
      effective.rightSidebarOpen = false
      effective.templatesPanelVisible = false
      effective.helpPanelVisible = false
      effective.calendarPanelVisible = false
      effective.tasksPanelVisible = false
      effective.lastActiveRightPanel = 'frontmatter'
      setLastActiveRightPanel('frontmatter')
    } else if (effective.rightSidebarOpen === true) {
      effective.frontmatterPanelVisible = false
      effective.templatesPanelVisible = false
      effective.helpPanelVisible = false
      effective.calendarPanelVisible = false
      effective.tasksPanelVisible = false
      effective.lastActiveRightPanel = 'ai'
      setLastActiveRightPanel('ai')
    } else if (effective.templatesPanelVisible === true) {
      effective.frontmatterPanelVisible = false
      effective.rightSidebarOpen = false
      effective.helpPanelVisible = false
      effective.calendarPanelVisible = false
      effective.tasksPanelVisible = false
      effective.lastActiveRightPanel = 'templates'
      setLastActiveRightPanel('templates')
    } else if (effective.helpPanelVisible === true) {
      effective.frontmatterPanelVisible = false
      effective.rightSidebarOpen = false
      effective.templatesPanelVisible = false
      effective.calendarPanelVisible = false
      effective.tasksPanelVisible = false
      effective.lastActiveRightPanel = 'help'
      setLastActiveRightPanel('help')
    } else if (effective.calendarPanelVisible === true) {
      effective.frontmatterPanelVisible = false
      effective.rightSidebarOpen = false
      effective.templatesPanelVisible = false
      effective.helpPanelVisible = false
      effective.tasksPanelVisible = false
      effective.lastActiveRightPanel = 'calendar'
      setLastActiveRightPanel('calendar')
    } else if (effective.tasksPanelVisible === true) {
      effective.frontmatterPanelVisible = false
      effective.rightSidebarOpen = false
      effective.templatesPanelVisible = false
      effective.helpPanelVisible = false
      effective.calendarPanelVisible = false
      effective.lastActiveRightPanel = 'tasks'
      setLastActiveRightPanel('tasks')
    }

    setSettings((prev) => (prev ? { ...prev, ...effective } : prev))
    try {
      const updated = await window.klartext.updateSettings(effective)
      setSettings((prev) => ({ ...(prev || updated), ...updated, ...effective }))
    } catch {
      // Keep optimistic state if main process update fails
    }
  }, [])

  const openRightHelpPanel = useCallback(
    (tab: HelpModalTab = 'formatting') => {
      setHelpModalTab(tab)
      handleUpdateSettings({ helpPanelVisible: true })
    },
    [handleUpdateSettings]
  )

  const handleSelectLeftSidebarTab = useCallback(
    (tab: LeftSidebarTab) => {
      setLeftSidebarTab(tab)
      handleUpdateSettings({ leftSidebarTab: tab })
    },
    [handleUpdateSettings]
  )

  const handleChangeEditMode = useCallback(
    (mode: EditMode) => {
      setEditMode(mode)
      handleUpdateSettings({ defaultEditMode: mode })
    },
    [handleUpdateSettings]
  )

  const [workspaceMarkdownDocs, setWorkspaceMarkdownDocs] = useState<DynamicCandidateDocument[]>([])
  const [showGitHubWizardModal, setShowGitHubWizardModal] = useState(false)
  const [showGraphViewModal, setShowGraphViewModal] = useState(false)
  const [dynamicWizardState, setDynamicWizardState] = useState<{
    open: boolean
    targetWorkspace?: DynamicWorkspaceDef | null
    editingFolder?: DynamicFolderDef | null
    editingRootRules?: boolean
  }>({ open: false })

  const dynamicCandidateDocuments = useMemo<DynamicCandidateDocument[]>(() => {
    const tabMap = new Map<string, string>()
    for (const t of tabs) {
      tabMap.set(`${t.rootId}::${t.relativePath}`, t.content)
    }
    return workspaceMarkdownDocs.map((doc) => {
      const liveContent = tabMap.get(`${doc.rootId}::${doc.relativePath}`)
      return liveContent !== undefined ? { ...doc, content: liveContent } : doc
    })
  }, [workspaceMarkdownDocs, tabs])

  const workspaceDocEntries = useMemo<WorkspaceDocEntry[]>(() => {
    return dynamicCandidateDocuments.map((d) => {
      const { frontmatter } = extractFrontmatter(d.content)
      const rawTags = frontmatter?.tags
      const tags: string[] = Array.isArray(rawTags)
        ? rawTags.map((x) => String(x))
        : typeof rawTags === 'string'
          ? rawTags
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      const baseTitle = d.name.replace(/\.(md|markdown|mdx|txt)$/i, '')
      const title =
        typeof frontmatter?.title === 'string' && frontmatter.title.trim()
          ? frontmatter.title.trim()
          : baseTitle
      return {
        rootId: d.rootId,
        rootName: d.rootName,
        relativePath: d.relativePath,
        name: d.name,
        title,
        content: d.content,
        tags
      }
    })
  }, [dynamicCandidateDocuments])

  const unlinkedMentions = useMemo<UnlinkedMentionItem[]>(() => {
    if (!activeTab) return []
    const baseTitle = (
      activeTab.relativePath.split('/').pop() || activeTab.relativePath
    ).replace(/\.(md|markdown|mdx|txt)$/i, '')
    const { frontmatter } = extractFrontmatter(activeTab.content)
    const targetTitle =
      typeof frontmatter?.title === 'string' && frontmatter.title.trim()
        ? frontmatter.title.trim()
        : baseTitle
    return findUnlinkedMentions({
      activeDocTitle: targetTitle,
      activeRootId: activeTab.rootId,
      activeRelativePath: activeTab.relativePath,
      documents: workspaceDocEntries
    })
  }, [activeTab, workspaceDocEntries])

  const globalTasks = useMemo<GlobalTaskItem[]>(() => {
    return extractGlobalTasks(workspaceDocEntries)
  }, [workspaceDocEntries])

  const collectWorkspaceTemplateFiles = useCallback(
    async (
      rootList: WorkspaceRoot[],
      trees: Record<string, FileTreeNode[]>
    ) => {
      const candidates: Array<{
        rootId: string
        rootName: string
        relativePath: string
        name: string
      }> = []

      const mdFiles: Array<{
        rootId: string
        rootName: string
        relativePath: string
        name: string
        updatedAt?: number
      }> = []

      for (const r of rootList) {
        const walk = (nodes: FileTreeNode[], insideTemplateFolder: boolean) => {
          for (const n of nodes) {
            const lowerName = n.name.toLowerCase()
            const isTplDir =
              insideTemplateFolder ||
              (n.isDirectory &&
                (lowerName === 'templates' ||
                  lowerName === '_templates' ||
                  lowerName === '.templates'))
            if (n.isDirectory && n.children) {
              walk(n.children, isTplDir)
            } else if (!n.isDirectory) {
              if (/\.(md|markdown|mdx|txt)$/i.test(lowerName)) {
                mdFiles.push({
                  rootId: r.id,
                  rootName: r.name,
                  relativePath: n.relativePath,
                  name: n.name,
                  updatedAt: n.updatedAt
                })
              }
              if (isTplDir && lowerName.endsWith('.md')) {
                candidates.push({
                  rootId: r.id,
                  rootName: r.name,
                  relativePath: n.relativePath,
                  name: n.name.replace(/\.md$/i, '')
                })
              }
            }
          }
        }
        walk(trees[r.id] || [], false)
      }

      const loadedMdDocs = await Promise.all(
        mdFiles.map(async (f): Promise<DynamicCandidateDocument | null> => {
          try {
            const { content } = await window.klartext.readDocument(f.rootId, f.relativePath)
            return {
              rootId: f.rootId,
              rootName: f.rootName,
              relativePath: f.relativePath,
              name: f.name,
              content,
              updatedAt: f.updatedAt
            }
          } catch {
            return null
          }
        })
      )
      setWorkspaceMarkdownDocs(
        loadedMdDocs.filter((x): x is DynamicCandidateDocument => x !== null)
      )

      if (candidates.length === 0) {
        setWorkspaceTemplateFiles([])
        return
      }

      const loaded = await Promise.all(
        candidates.map(async (c) => {
          try {
            const { content } = await window.klartext.readDocument(c.rootId, c.relativePath)
            return {
              id: `ws-tpl::${c.rootId}::${c.relativePath}`,
              name: c.name,
              rootId: c.rootId,
              rootName: c.rootName,
              relativePath: c.relativePath,
              content
            }
          } catch {
            return null
          }
        })
      )
      setWorkspaceTemplateFiles(loaded.filter((x): x is NonNullable<typeof x> => x !== null))
    },
    []
  )

  const refreshWorkspaceAndTrees = useCallback(async () => {
    const ws = await window.klartext.getWorkspaceState()
    setRoots(ws.roots)

    const [treeEntries, statuses] = await Promise.all([
      Promise.all(
        ws.roots.map(async (r) => [r.id, await window.klartext.listFilesForRoot(r.id)] as const)
      ),
      window.klartext.getAllGitStatus()
    ])

    const nextTrees: Record<string, FileTreeNode[]> = {}
    for (const [rootId, nodes] of treeEntries) {
      nextTrees[rootId] = nodes
    }
    setTreesByRoot(nextTrees)

    const statusMap: Record<string, GitRepoStatus> = {}
    for (const st of statuses) {
      statusMap[st.rootId] = st
    }
    setGitStatuses(statusMap)
    await collectWorkspaceTemplateFiles(ws.roots, nextTrees)
  }, [collectWorkspaceTemplateFiles])

  const openDocument = useCallback(
    async (rootId: string, relativePath: string) => {
      const key = `${rootId}::${relativePath}`
      const existing = tabs.find((t) => t.key === key)
      if (existing) {
        setActiveTabKey(key)
        return
      }
      try {
        const { content } = await window.klartext.readDocument(rootId, relativePath)
        const rootObj = roots.find((r) => r.id === rootId)
        const newTab: OpenDocumentTab = {
          key,
          rootId,
          rootName: rootObj?.name || rootId,
          relativePath,
          content,
          savedContent: content,
          dirty: false
        }
        setTabs((prev) => [...prev, newTab])
        setActiveTabKey(key)
      } catch {
        // Ignore missing file
      }
    },
    [tabs, roots]
  )

  const navigateToLine = useCallback(
    async (rootId: string, relativePath: string, lineNumber: number) => {
      await openDocument(rootId, relativePath)
      setScrollToLine({ line: lineNumber, nonce: Date.now() + Math.random() })
    },
    [openDocument]
  )

  // 1.3 Convert an Unlinked Mention into a [[WikiLink]] in its source document
  const handleLinkUnlinkedMention = useCallback(
    async (mention: UnlinkedMentionItem) => {
      const docKey = `${mention.sourceRootId}::${mention.sourceRelativePath}`
      const openTab = tabs.find((t) => t.key === docKey)
      let currentContent = openTab?.content
      if (currentContent === undefined) {
        try {
          const res = await window.klartext.readDocument(
            mention.sourceRootId,
            mention.sourceRelativePath
          )
          currentContent = res.content
        } catch {
          return
        }
      }
      const nextContent = linkUnlinkedMentionInContent(
        currentContent,
        mention.lineNumber,
        mention.matchedTitle
      )
      await window.klartext.writeDocument(
        mention.sourceRootId,
        mention.sourceRelativePath,
        nextContent
      )
      setTabs((prev) =>
        prev.map((t) =>
          t.key === docKey
            ? { ...t, content: nextContent, savedContent: nextContent, dirty: false }
            : t
        )
      )
      setWorkspaceMarkdownDocs((prev) =>
        prev.map((d) =>
          d.rootId === mention.sourceRootId && d.relativePath === mention.sourceRelativePath
            ? { ...d, content: nextContent }
            : d
        )
      )
      if (activeTab) {
        window.klartext
          .findBacklinks(activeTab.rootId, activeTab.relativePath)
          .then(setBacklinks)
          .catch(() => {})
      }
    },
    [tabs, activeTab]
  )

  // 3.2 Toggle a task checkbox directly from the Global Tasks dashboard
  const handleToggleGlobalTask = useCallback(
    async (task: GlobalTaskItem) => {
      const docKey = `${task.rootId}::${task.relativePath}`
      const openTab = tabs.find((t) => t.key === docKey)
      let currentContent = openTab?.content
      if (currentContent === undefined) {
        try {
          const res = await window.klartext.readDocument(task.rootId, task.relativePath)
          currentContent = res.content
        } catch {
          return
        }
      }
      const nextContent = toggleTaskAtLineInMarkdown(currentContent, task.lineNumber)
      await window.klartext.writeDocument(task.rootId, task.relativePath, nextContent)
      setTabs((prev) =>
        prev.map((t) =>
          t.key === docKey
            ? { ...t, content: nextContent, savedContent: nextContent, dirty: false }
            : t
        )
      )
      setWorkspaceMarkdownDocs((prev) =>
        prev.map((d) =>
          d.rootId === task.rootId && d.relativePath === task.relativePath
            ? { ...d, content: nextContent }
            : d
        )
      )
    },
    [tabs]
  )

  // 3.1 Open or auto-create a Daily Note (Daily-Notes/YYYY-MM-DD.md)
  const handleOpenDailyNote = useCallback(
    async (dateYmd?: string) => {
      const targetRootId =
        (activeTab && activeTab.rootId !== '__templates__' ? activeTab.rootId : null) ||
        roots[0]?.id
      if (!targetRootId) return
      const now = new Date()
      const ymd =
        dateYmd ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const existing = dynamicCandidateDocuments.find(
        (d) =>
          d.name.replace(/\.(md|markdown)$/i, '') === ymd ||
          d.relativePath.endsWith(`/${ymd}.md`) ||
          d.relativePath === `${ymd}.md`
      )
      if (existing) {
        await openDocument(existing.rootId, existing.relativePath)
        return
      }

      const relPath = `Daily-Notes/${ymd}.md`
      const initialContent = [
        '---',
        `title: "${ymd} Daily Note"`,
        `date: "${ymd}"`,
        'tags: ["#daily", "#journal"]',
        'status: "In Progress"',
        '---',
        `# 📅 ${ymd}`,
        '',
        '## Top Priorities',
        '- [ ] Review today\'s focus items',
        '',
        '## Notes & Journal',
        ''
      ].join('\n')

      try {
        await window.klartext.createDirectory(targetRootId, 'Daily-Notes').catch(() => {})
        await window.klartext.createDocument(targetRootId, relPath, initialContent)
      } catch {
        // Ignore if file already exists
      }
      await refreshWorkspaceAndTrees()
      await openDocument(targetRootId, relPath)
    },
    [activeTab, roots, dynamicCandidateDocuments, openDocument, refreshWorkspaceAndTrees]
  )

  // Auto-disappear export notification banner after 10 seconds
  useEffect(() => {
    if (!exportStatusBanner) return
    const timer = setTimeout(() => {
      setExportStatusBanner(null)
    }, 10000)
    return () => clearTimeout(timer)
  }, [exportStatusBanner])

  const handleExportHtml = useCallback(async () => {
    if (!activeTab) return
    const res = await window.klartext.exportHtml({
      rootId: activeTab.rootId,
      relativePath: activeTab.relativePath,
      markdown: activeTab.content,
      title: activeTab.relativePath
    })
    if ((res as any)?.canceled || !res.outputPath) return
    setExportStatusBanner(`Exported HTML: ${res.outputPath}`)
  }, [activeTab])

  const handleExportPdf = useCallback(async () => {
    if (!activeTab) return
    const res = await window.klartext.exportPdf({
      rootId: activeTab.rootId,
      relativePath: activeTab.relativePath,
      markdown: activeTab.content,
      title: activeTab.relativePath
    })
    if ((res as any)?.canceled || !res.outputPath) return
    setExportStatusBanner(`Exported PDF (${res.sizeBytes} bytes): ${res.outputPath}`)
  }, [activeTab])

  const handleExportDocx = useCallback(async () => {
    if (!activeTab) return
    const res = await window.klartext.exportDocx({
      rootId: activeTab.rootId,
      relativePath: activeTab.relativePath,
      markdown: activeTab.content,
      title: activeTab.relativePath
    })
    if ((res as any)?.canceled || !res.outputPath) return
    setExportStatusBanner(`Exported DOCX (${res.sizeBytes} bytes): ${res.outputPath}`)
  }, [activeTab])

  // Subscribe to native application File, Edit, View, Format, Insert & Help Menu actions
  useEffect(() => {
    if (!window.klartext.onMenuAction) return
    const unsubscribe = window.klartext.onMenuAction(async (action) => {
      if (action === 'undo') {
        dispatchEditorCommand('undo')
      } else if (action === 'redo') {
        dispatchEditorCommand('redo')
      } else if (action === 'export-html') {
        await handleExportHtml()
      } else if (action === 'export-pdf') {
        await handleExportPdf()
      } else if (action === 'open-folder') {
        await window.klartext.openFolderDialog()
        await refreshWorkspaceAndTrees()
      } else if (action === 'open-git-workspace-wizard') {
        setShowGitHubWizardModal(true)
      } else if (action === 'open-dynamic-workspace-wizard') {
        setDynamicWizardState({ open: true, targetWorkspace: null, editingFolder: null })
      } else if (action === 'toggle-status-bar' && settings) {
        await handleUpdateSettings({ statusBarVisible: !settings.statusBarVisible })
      } else if (action === 'toggle-toolbar' && settings) {
        await handleUpdateSettings({
          formattingToolbarVisible: !settings.formattingToolbarVisible
        })
      } else if (action === 'toggle-theme') {
        await handleUpdateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })
      } else if (action === 'toggle-frontmatter' && settings) {
        await handleUpdateSettings({
          frontmatterPanelVisible: !settings.frontmatterPanelVisible
        })
      } else if (action === 'toggle-templates' && settings) {
        await handleUpdateSettings({
          templatesPanelVisible: !settings.templatesPanelVisible
        })
      } else if (action === 'toggle-ai-panel' && settings) {
        await handleUpdateSettings({
          rightSidebarOpen: !settings.rightSidebarOpen
        })
      } else if (action === 'toggle-help-panel' && settings) {
        await handleUpdateSettings({
          helpPanelVisible: !settings.helpPanelVisible
        })
      } else if (action === 'toggle-spellcheck' && settings) {
        await handleUpdateSettings({
          spellcheckEnabled: settings.spellcheckEnabled === false
        })
      } else if (action === 'help:formatting') {
        openRightHelpPanel('formatting')
      } else if (action === 'help:variables') {
        openRightHelpPanel('variables')
      } else if (action === 'help:ai') {
        openRightHelpPanel('ai')
      } else if (action === 'help:shortcuts') {
        openRightHelpPanel('shortcuts')
      } else if (action === 'help:about') {
        setShowAboutModal(true)
      } else if (action === 'help:check-updates') {
        setShowSettingsModal(true)
      } else if (action.startsWith('editor:')) {
        dispatchEditorCommand(action.slice('editor:'.length) as EditorDispatchedCommand)
      }
    })
    return unsubscribe
  }, [
    dispatchEditorCommand,
    handleExportHtml,
    handleExportPdf,
    refreshWorkspaceAndTrees,
    settings,
    resolvedTheme,
    handleUpdateSettings,
    openRightHelpPanel
  ])

  // Initial boot: load settings, workspace roots, recovery snapshots, and saved open tabs in parallel
  useEffect(() => {
    const init = async () => {
      const [loadedSettings, ws, statuses, snaps, envInfo] = await Promise.all([
        window.klartext.getSettings(),
        window.klartext.getWorkspaceState(),
        window.klartext.getAllGitStatus(),
        window.klartext.listRecoverySnapshots(),
        window.klartext.getSystemEnvInfo
          ? window.klartext.getSystemEnvInfo().catch(() => null)
          : Promise.resolve(null)
      ])
      if (envInfo) {
        setSystemEnvInfo(envInfo)
      }
      const existingCustomTpls = Array.isArray(loadedSettings.customTemplates)
        ? loadedSettings.customTemplates
        : []
      const mergedCustomTemplates =
        existingCustomTpls.length > 0
          ? [
              ...existingCustomTpls,
              ...DEFAULT_BUILT_IN_TEMPLATES.filter(
                (def) => !existingCustomTpls.some((t) => t.id === def.id)
              )
            ]
          : DEFAULT_BUILT_IN_TEMPLATES
      const existingSavedThemes = Array.isArray(loadedSettings.savedThemes)
        ? loadedSettings.savedThemes
        : []
      const mergedSavedThemes =
        existingSavedThemes.length > 0
          ? [
              ...existingSavedThemes,
              ...DEFAULT_NORDIC_SAVED_THEMES.filter(
                (def) => !existingSavedThemes.some((t) => t.id === def.id)
              )
            ]
          : DEFAULT_NORDIC_SAVED_THEMES
      const normalizedSettings: AppSettings = {
        ...loadedSettings,
        updateCheckInterval: loadedSettings.updateCheckInterval || 'weekly',
        customTemplates: mergedCustomTemplates,
        savedThemes: mergedSavedThemes,
        ...(loadedSettings.frontmatterPanelVisible && loadedSettings.rightSidebarOpen
          ? { rightSidebarOpen: false }
          : {})
      }

      // Run scheduled update check based on interval (default: once a week)
      const isAutomatedTest = typeof navigator !== 'undefined' && navigator.webdriver === true
      if (
        !isAutomatedTest &&
        window.klartext.checkForUpdates &&
        shouldRunScheduledUpdateCheck(
          normalizedSettings.updateCheckInterval || 'weekly',
          normalizedSettings.lastUpdateCheckAt
        )
      ) {
        window.klartext
          .checkForUpdates()
          .then((res) => {
            setSettings((prev) =>
              prev ? { ...prev, lastUpdateCheckAt: res.checkedAt } : prev
            )
            if (res.updateAvailable) {
              setExportStatusBanner(
                `Update available: Klartext v${res.latestVersion} is ready on GitHub Releases.`
              )
            }
          })
          .catch(() => {})
      }
      if (normalizedSettings.frontmatterPanelVisible) {
        setLastActiveRightPanel('frontmatter')
      } else if (normalizedSettings.templatesPanelVisible) {
        setLastActiveRightPanel('templates')
      } else if (normalizedSettings.helpPanelVisible) {
        setLastActiveRightPanel('help')
      } else if (normalizedSettings.calendarPanelVisible) {
        setLastActiveRightPanel('calendar')
      } else if (normalizedSettings.tasksPanelVisible) {
        setLastActiveRightPanel('tasks')
      } else if (normalizedSettings.rightSidebarOpen) {
        setLastActiveRightPanel('ai')
      } else if (normalizedSettings.lastActiveRightPanel) {
        setLastActiveRightPanel(normalizedSettings.lastActiveRightPanel)
      }
      if (normalizedSettings.leftSidebarWidth) {
        setLeftSidebarWidth(normalizedSettings.leftSidebarWidth)
      }
      if (normalizedSettings.rightSidebarWidth) {
        setRightSidebarWidth(normalizedSettings.rightSidebarWidth)
      }
      if (normalizedSettings.leftSidebarTab) {
        setLeftSidebarTab(normalizedSettings.leftSidebarTab)
      }
      if (normalizedSettings.selectedFolder) {
        setSelectedFolder(normalizedSettings.selectedFolder)
      }
      setSettings(normalizedSettings)
      setEditMode(normalizedSettings.defaultEditMode || 'inline')
      setRoots(ws.roots)

      const treeEntries = await Promise.all(
        ws.roots.map(async (r) => [r.id, await window.klartext.listFilesForRoot(r.id)] as const)
      )
      const nextTrees: Record<string, FileTreeNode[]> = {}
      for (const [rootId, nodes] of treeEntries) {
        nextTrees[rootId] = nodes
      }
      setTreesByRoot(nextTrees)
      await collectWorkspaceTemplateFiles(ws.roots, nextTrees)

      const statusMap: Record<string, GitRepoStatus> = {}
      for (const st of statuses) {
        statusMap[st.rootId] = st
      }
      setGitStatuses(statusMap)
      setRecoverySnapshots(snaps)

      // Restore previously open document tabs in parallel if available, otherwise open first .md file
      const restoredTabs: OpenDocumentTab[] = []
      if (Array.isArray(normalizedSettings.openTabs) && normalizedSettings.openTabs.length > 0) {
        const tabResults = await Promise.all(
          normalizedSettings.openTabs.map(async (savedTab) => {
            if (savedTab.rootId === '__templates__') {
              const matchedTpl = (normalizedSettings.customTemplates || []).find(
                (t) => t.name === savedTab.relativePath || t.id === savedTab.relativePath
              )
              if (!matchedTpl) return null
              return {
                key: `__templates__::${matchedTpl.name}`,
                rootId: '__templates__',
                rootName: 'Templates',
                relativePath: matchedTpl.name,
                content: matchedTpl.content,
                savedContent: matchedTpl.content,
                dirty: false
              } satisfies OpenDocumentTab
            }
            const rootObj = ws.roots.find((r) => r.id === savedTab.rootId)
            if (!rootObj) return null
            try {
              const { content } = await window.klartext.readDocument(
                savedTab.rootId,
                savedTab.relativePath
              )
              return {
                key: `${savedTab.rootId}::${savedTab.relativePath}`,
                rootId: savedTab.rootId,
                rootName: rootObj.name,
                relativePath: savedTab.relativePath,
                content,
                savedContent: content,
                dirty: false
              } satisfies OpenDocumentTab
            } catch {
              return null
            }
          })
        )
        for (const tab of tabResults) {
          if (tab && !restoredTabs.some((t) => t.key === tab.key)) {
            restoredTabs.push(tab)
          }
        }
      }

      if (restoredTabs.length > 0) {
        setTabs(restoredTabs)
        const matchingActive =
          normalizedSettings.activeTabKey &&
          restoredTabs.find((t) => t.key === normalizedSettings.activeTabKey)
        setActiveTabKey(matchingActive ? matchingActive.key : restoredTabs[0].key)
      } else if (ws.roots.length > 0) {
        const firstRoot = ws.roots[0]
        const firstTree = nextTrees[firstRoot.id] || []
        const firstMd = firstTree.find((n) => !n.isDirectory && n.name.endsWith('.md'))
        if (firstMd) {
          const { content } = await window.klartext.readDocument(
            firstRoot.id,
            firstMd.relativePath
          )
          const key = `${firstRoot.id}::${firstMd.relativePath}`
          setTabs([
            {
              key,
              rootId: firstRoot.id,
              rootName: firstRoot.name,
              relativePath: firstMd.relativePath,
              content,
              savedContent: content,
              dirty: false
            }
          ])
          setActiveTabKey(key)
        }
      }

      isBootedRef.current = true
    }
    init()
  }, [collectWorkspaceTemplateFiles])

  // Persist open document tabs and active tab key across restarts
  useEffect(() => {
    if (!isBootedRef.current) return
    const openTabs = tabs.map((t) => ({
      rootId: t.rootId,
      relativePath: t.relativePath
    }))
    window.klartext
      .updateSettings({
        openTabs,
        activeTabKey
      })
      .catch(() => {})
  }, [tabs, activeTabKey])

  // Subscribe to MultiRootWatcher external disk changes (never interrupt local edits with conflict errors)
  useEffect(() => {
    const unsubscribe = window.klartext.onWatcherChange(async (ev) => {
      await refreshWorkspaceAndTrees()
      if (ev.eventType !== 'change') return

      const key = `${ev.rootId}::${ev.relativePath}`
      setTabs((prevTabs) => {
        const target = prevTabs.find((t) => t.key === key)
        if (!target || target.dirty) return prevTabs
        window.klartext
          .readDocument(ev.rootId, ev.relativePath)
          .then(({ content: diskContent }) => {
            setTabs((current) =>
              current.map((t) => {
                if (t.key !== key) return t
                if (t.dirty || diskContent === t.content) return t
                return {
                  ...t,
                  content: diskContent,
                  savedContent: diskContent,
                  dirty: false,
                  externalConflictContent: undefined
                }
              })
            )
          })
          .catch(() => {})
        return prevTabs
      })
    })
    return unsubscribe
  }, [refreshWorkspaceAndTrees])

  // Subscribe to Local AI streaming token chunks
  useEffect(() => {
    const unsubscribe = window.klartext.onAIStreamChunk((ev) => {
      setPendingAIDiff((prev) => {
        if (!prev || prev.requestId !== ev.requestId) return prev
        if (ev.done) {
          return {
            ...prev,
            proposedText: ev.cleanedFullText || prev.proposedText,
            isStreaming: false,
            error: ev.error
          }
        }
        return {
          ...prev,
          proposedText: prev.proposedText + ev.chunk
        }
      })
    })
    return unsubscribe
  }, [])

  // Update backlinks when active tab changes
  useEffect(() => {
    if (!activeTab) {
      setBacklinks([])
      return
    }
    window.klartext
      .findBacklinks(activeTab.rootId, activeTab.relativePath)
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
  }, [activeTab?.rootId, activeTab?.relativePath, activeTab?.savedContent])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteMode((p) => (p === 'commands' ? null : 'commands'))
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteMode((p) => (p === 'files' ? null : 'files'))
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setPaletteMode((p) => (p === 'icons' ? null : 'icons'))
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if (settings) {
          handleUpdateSettings({ zenMode: !settings.zenMode })
        }
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        dispatchEditorCommand('open-in-doc-find')
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
        // Note: Mod+B when not focused inside editor toggles left sidebar
        const activeEl = document.activeElement
        if (!activeEl || !activeEl.closest('.cm-editor')) {
          e.preventDefault()
          if (settings) {
            handleUpdateSettings({ leftSidebarOpen: !settings.leftSidebarOpen })
          }
        }
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (activeTab) {
          if (activeTab.rootId === '__templates__') {
            const currentTpls =
              settings?.customTemplates && settings.customTemplates.length > 0
                ? settings.customTemplates
                : DEFAULT_BUILT_IN_TEMPLATES
            const nextTpls = currentTpls.map((t) =>
              t.name === activeTab.relativePath
                ? { ...t, content: activeTab.content, updatedAt: Date.now() }
                : t
            )
            handleUpdateSettings({ customTemplates: nextTpls })
            setTabs((prev) =>
              prev.map((t) =>
                t.key === activeTab.key
                  ? {
                      ...t,
                      savedContent: t.content,
                      dirty: false,
                      externalConflictContent: undefined
                    }
                  : t
              )
            )
          } else {
            window.klartext
              .writeDocument(activeTab.rootId, activeTab.relativePath, activeTab.content)
              .then(() => {
                setTabs((prev) =>
                  prev.map((t) =>
                    t.key === activeTab.key
                      ? {
                          ...t,
                          savedContent: t.content,
                          dirty: false,
                          externalConflictContent: undefined
                        }
                      : t
                  )
                )
              })
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, settings, handleUpdateSettings])

  const handleEditorContentChangeForTab = (
    targetTab: OpenDocumentTab,
    nextContent: string
  ) => {
    const tabKey = targetTab.key
    const rootId = targetTab.rootId
    const relativePath = targetTab.relativePath

    const applyOptimistic = (prev: OpenDocumentTab[]) =>
      prev.map((t) =>
        t.key === tabKey
          ? {
              ...t,
              content: nextContent,
              dirty: nextContent !== t.savedContent,
              externalConflictContent: undefined
            }
          : t
      )
    setTabs(applyOptimistic)
    setSecondaryTabs(applyOptimistic)

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      if (rootId === '__templates__') {
        const currentTpls =
          settings?.customTemplates && settings.customTemplates.length > 0
            ? settings.customTemplates
            : DEFAULT_BUILT_IN_TEMPLATES
        const nextTpls = currentTpls.map((t) =>
          t.name === relativePath
            ? { ...t, content: nextContent, updatedAt: Date.now() }
            : t
        )
        await handleUpdateSettings({ customTemplates: nextTpls })
        const applySaved = (prev: OpenDocumentTab[]) =>
          prev.map((t) =>
            t.key === tabKey
              ? {
                  ...t,
                  savedContent: nextContent,
                  dirty: t.content !== nextContent,
                  externalConflictContent: undefined
                }
              : t
          )
        setTabs(applySaved)
        setSecondaryTabs(applySaved)
        return
      }
      await window.klartext.saveRecoverySnapshot(rootId, relativePath, nextContent)
      await window.klartext.writeDocument(rootId, relativePath, nextContent)
      const applySaved = (prev: OpenDocumentTab[]) =>
        prev.map((t) =>
          t.key === tabKey
            ? {
                ...t,
                savedContent: nextContent,
                dirty: t.content !== nextContent,
                externalConflictContent: undefined
              }
            : t
        )
      setTabs(applySaved)
      setSecondaryTabs(applySaved)
    }, settings?.autosaveDelayMs || 900)
  }

  const handleEditorContentChange = (nextContent: string) => {
    if (!activeTab) return
    handleEditorContentChangeForTab(activeTab, nextContent)
  }

  const openTemplateInEditor = useCallback(
    (tpl: { id: string; name: string; content: string }) => {
      const fileName = tpl.name.endsWith('.md') ? tpl.name : `${tpl.name}.md`
      const key = `__templates__::${fileName}`
      setTabs((prev) => {
        const existing = prev.find((t) => t.key === key)
        if (existing) {
          return prev.map((t) =>
            t.key === key ? { ...t, content: tpl.content, savedContent: tpl.content, dirty: false } : t
          )
        }
        return [
          ...prev,
          {
            key,
            rootId: '__templates__',
            rootName: 'Templates',
            relativePath: fileName,
            content: tpl.content,
            savedContent: tpl.content,
            dirty: false
          }
        ]
      })
      setActiveTabKey(key)
    },
    []
  )

  const handlePasteOrDropAsset = async (
    fileName: string,
    mimeType: string,
    base64Data: string
  ): Promise<string> => {
    if (!activeTab) return ''
    const saved = await window.klartext.saveAsset({
      rootId: activeTab.rootId,
      documentRelativePath: activeTab.relativePath,
      fileName,
      mimeType,
      base64Data,
      category: 'images'
    })
    await refreshWorkspaceAndTrees()
    return saved.markdownLink
  }

  const handleInitiateCrossRootMove = async (
    sourceRootId: string,
    sourceRelativePath: string,
    targetRootId: string
  ) => {
    const referencedAssets = await window.klartext.checkCrossRootAssets(
      sourceRootId,
      sourceRelativePath
    )
    setCrossRootMovePrompt({
      sourceRootId,
      sourceRelativePath,
      targetRootId,
      referencedAssets
    })
  }

  const handleConfirmCrossRootMove = async (migrateAssets: boolean) => {
    if (!crossRootMovePrompt) return
    const { sourceRootId, sourceRelativePath, targetRootId } = crossRootMovePrompt
    const res = await window.klartext.moveDocumentCrossRoot({
      sourceRootId,
      sourceRelativePath,
      targetRootId,
      targetRelativePath: sourceRelativePath,
      migrateAssets
    })
    setCrossRootMovePrompt(null)
    await refreshWorkspaceAndTrees()
    const oldKey = `${sourceRootId}::${sourceRelativePath}`
    setTabs((prev) => prev.filter((t) => t.key !== oldKey))
    await openDocument(targetRootId, res.movedFileRelativePath)
  }

  const openAICustomInstructionDialog = (explicitSelectedText?: string) => {
    const domSel = window.getSelection()?.toString()?.trim() || ''
    const cmSel = String((window as any).__klartextSelectedText || '').trim()
    const initialSelectedText =
      (explicitSelectedText && explicitSelectedText.trim()) ||
      domSel ||
      cmSel ||
      activeTab?.content ||
      ''
    setAiInstructionDialog({
      open: true,
      selectedText: initialSelectedText
    })
  }

  const handleTriggerAIAction = async (
    action: string,
    promptText: string,
    modelOverride?: string,
    selectedSnippet?: string
  ) => {
    if (!activeTab) return
    if (settings && !settings.rightSidebarOpen) {
      await handleUpdateSettings({ rightSidebarOpen: true })
    }
    const requestId = `ai-${Date.now()}`
    const domOrCmSel =
      window.getSelection()?.toString()?.trim() ||
      String((window as any).__klartextSelectedText || '').trim()
    const originalText =
      selectedSnippet && selectedSnippet.trim().length > 0
        ? selectedSnippet
        : domOrCmSel.length > 0
          ? domOrCmSel
          : activeTab.content
    setPendingAIDiff({
      originalText,
      proposedText: '',
      isStreaming: true,
      requestId
    })
    try {
      await window.klartext.startAIStream({
        requestId,
        action,
        prompt: promptText,
        selectedText: originalText,
        modelOverride
      })
    } catch (err: any) {
      setPendingAIDiff((prev) =>
        prev && prev.requestId === requestId
          ? {
              ...prev,
              isStreaming: false,
              error: err?.message || String(err)
            }
          : prev
      )
    }
  }

  const handleResolveConflict = async (
    rootId: string,
    relativePath: string,
    resolution: 'current' | 'incoming' | 'both' | 'custom',
    hunkIndex?: number
  ) => {
    const res = await window.klartext.gitResolveConflict({
      rootId,
      relativePath,
      hunkIndex,
      resolution
    })
    const key = `${rootId}::${relativePath}`
    setTabs((prev) =>
      prev.map((t) =>
        t.key === key
          ? {
              ...t,
              content: res.updatedContent,
              savedContent: res.updatedContent,
              dirty: false
            }
          : t
      )
    )
    await refreshWorkspaceAndTrees()
  }

  // Flatten all files across mounted roots for Quick Switcher
  const allWorkspaceFiles = useMemo(() => {
    const list: Array<{ rootId: string; rootName: string; relativePath: string }> = []
    for (const r of roots) {
      const walk = (nodes: FileTreeNode[]) => {
        for (const n of nodes) {
          if (n.isDirectory && n.children) walk(n.children)
          else if (!n.isDirectory) {
            list.push({ rootId: r.id, rootName: r.name, relativePath: n.relativePath })
          }
        }
      }
      walk(treesByRoot[r.id] || [])
    }
    return list
  }, [roots, treesByRoot])

  const templateEvaluationContext: TemplateEvaluationContext = useMemo(() => {
    const activeRootObj =
      activeTab && activeTab.rootId !== '__templates__'
        ? roots.find((r) => r.id === activeTab.rootId)
        : selectedFolder
          ? roots.find((r) => r.id === selectedFolder.rootId)
          : roots[0]
    const relPath =
      activeTab && activeTab.rootId !== '__templates__' ? activeTab.relativePath : ''
    const parts = relPath.split('/').filter(Boolean)
    const fileName = parts.length > 0 ? parts[parts.length - 1] : 'Untitled.md'
    const fileTitle = fileName.replace(/\.(md|markdown)$/i, '')
    const folderRelPath =
      selectedFolder &&
      (!activeTab ||
        activeTab.rootId === '__templates__' ||
        selectedFolder.rootId === activeTab.rootId)
        ? selectedFolder.relativePath
        : parts.length > 1
          ? parts.slice(0, -1).join('/')
          : ''
    const folderParts = folderRelPath.split('/').filter(Boolean)
    const folderName =
      folderParts.length > 0
        ? folderParts[folderParts.length - 1]
        : activeRootObj?.name || 'Workspace'
    const parentFolderName =
      folderParts.length > 1
        ? folderParts[folderParts.length - 2]
        : activeRootObj?.name || 'Workspace'
    const gitSt = activeRootObj ? gitStatuses[activeRootObj.id] : undefined
    const folderNoteCount = activeRootObj
      ? allWorkspaceFiles.filter((f) => {
          if (f.rootId !== activeRootObj.id) return false
          const fParts = f.relativePath.split('/').filter(Boolean)
          const fFolder = fParts.length > 1 ? fParts.slice(0, -1).join('/') : ''
          return fFolder === folderRelPath
        }).length
      : 0

    return {
      fileName,
      fileTitle,
      relativePath: relPath || (folderRelPath ? `${folderRelPath}/${fileName}` : fileName),
      folderName,
      folderPath: folderRelPath || '/',
      parentFolderName,
      rootName: activeRootObj?.name || 'Workspace',
      rootPath: activeRootObj?.path || '',
      allRootNames: roots.map((r) => r.name),
      noteCount: allWorkspaceFiles.length,
      folderNoteCount,
      gitBranch: gitSt?.branch || 'main',
      gitStatus: gitSt?.state || 'Local',
      userName: systemEnvInfo.userName,
      hostName: systemEnvInfo.hostName,
      osPlatform: systemEnvInfo.osPlatform,
      cpuArch: systemEnvInfo.cpuArch,
      cpuCores: systemEnvInfo.cpuCores,
      memoryFree: systemEnvInfo.memoryFree,
      uptime: systemEnvInfo.uptime,
      ipLocal: systemEnvInfo.ipLocal,
      appVersion: systemEnvInfo.appVersion,
      envVars: systemEnvInfo.envVars,
      locale: navigator.language || 'en-US'
    }
  }, [activeTab, selectedFolder, roots, gitStatuses, systemEnvInfo, allWorkspaceFiles])

  const allAvailableTemplates = useMemo(() => {
    const baseList =
      settings?.customTemplates && settings.customTemplates.length > 0
        ? settings.customTemplates
        : DEFAULT_BUILT_IN_TEMPLATES
    const combined: Array<{ id: string; name: string; content: string }> = baseList.map((t) => ({
      id: t.id,
      name: t.name,
      content: t.content
    }))
    for (const wf of workspaceTemplateFiles) {
      if (!combined.some((c) => c.id === wf.id)) {
        combined.push({
          id: wf.id,
          name: wf.name,
          content: wf.content
        })
      }
    }
    return combined
  }, [settings?.customTemplates, workspaceTemplateFiles])

  const createNoteFromTemplateInFolder = useCallback(
    async (
      targetRootId: string,
      folderRelativePath: string,
      templateName: string,
      rawTemplateContent: string
    ) => {
      const rootObj = roots.find((r) => r.id === targetRootId) || roots[0]
      if (!rootObj) return

      const now = new Date()
      const folderParts = folderRelativePath.split('/').filter(Boolean)
      const folderName =
        folderParts.length > 0 ? folderParts[folderParts.length - 1] : rootObj.name
      const parentFolderName =
        folderParts.length > 1 ? folderParts[folderParts.length - 2] : rootObj.name
      const gitSt = gitStatuses[rootObj.id]
      const folderNoteCount = allWorkspaceFiles.filter((f) => {
        if (f.rootId !== rootObj.id) return false
        const fParts = f.relativePath.split('/').filter(Boolean)
        const fFolder = fParts.length > 1 ? fParts.slice(0, -1).join('/') : ''
        return fFolder === folderRelativePath
      }).length

      const preliminaryCtx: TemplateEvaluationContext = {
        ...templateEvaluationContext,
        now,
        folderName,
        folderPath: folderRelativePath || '/',
        parentFolderName,
        rootName: rootObj.name,
        rootPath: rootObj.path,
        noteCount: allWorkspaceFiles.length,
        folderNoteCount,
        gitBranch: gitSt?.branch || 'main',
        gitStatus: gitSt?.state || 'Local'
      }

      // Evaluate any <% ... %> dynamic variables inside the template's name
      const evaluatedTitle =
        evaluateTemplateFileName(templateName, preliminaryCtx).replace(/\.(md|markdown)$/i, '') ||
        'Note'
      const safeStem = evaluatedTitle
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-')

      // Avoid overwriting existing files in the target folder
      const existingInRoot = allWorkspaceFiles
        .filter((f) => f.rootId === rootObj.id)
        .map((f) => f.relativePath.toLowerCase())
      let baseFile = `${safeStem || 'Note'}.md`
      let relPath = folderRelativePath ? `${folderRelativePath}/${baseFile}` : baseFile
      let counter = 1
      while (existingInRoot.includes(relPath.toLowerCase())) {
        baseFile = `${safeStem || 'Note'}-${counter}.md`
        relPath = folderRelativePath ? `${folderRelativePath}/${baseFile}` : baseFile
        counter++
      }

      const folderEvalCtx: TemplateEvaluationContext = {
        ...preliminaryCtx,
        fileName: baseFile,
        fileTitle: baseFile.replace(/\.md$/i, ''),
        relativePath: relPath
      }

      const evaluated = await evaluateTemplateVariablesAsync(rawTemplateContent, folderEvalCtx)
      await window.klartext.createDocument(rootObj.id, relPath, evaluated.content)
      await refreshWorkspaceAndTrees()
      await openDocument(rootObj.id, relPath)
    },
    [
      roots,
      allWorkspaceFiles,
      gitStatuses,
      templateEvaluationContext,
      refreshWorkspaceAndTrees,
      openDocument
    ]
  )

  const [aiServerConnected, setAiServerConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    const enabled = settings?.ai?.enabled
    const activeModel = settings?.ai?.activeModel?.trim()
    const endpoint = settings?.ai?.endpoint?.trim()
    if (!enabled || !activeModel || !endpoint) {
      setAiServerConnected(false)
      return
    }
    window.klartext
      .testAIConnection()
      .then((res) => {
        if (!cancelled) {
          setAiServerConnected(Boolean(res.ok && Array.isArray(res.models) && res.models.length > 0))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiServerConnected(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    settings?.ai?.enabled,
    settings?.ai?.activeModel,
    settings?.ai?.endpoint,
    settings?.ai?.provider
  ])

  const aiModelConfigured = Boolean(
    settings?.ai?.enabled &&
      settings?.ai?.activeModel &&
      settings.ai.activeModel.trim().length > 0 &&
      aiServerConnected
  )

  const buildNewDocumentContentWithDefaultFrontmatter = useCallback(
    async (rootId: string, relativePath: string, baseTitle: string): Promise<string> => {
      const rootObj = roots.find((r) => r.id === rootId) || roots[0]
      const now = new Date()
      const parts = relativePath.split('/').filter(Boolean)
      const fileName = parts.length > 0 ? parts[parts.length - 1] : `${baseTitle}.md`
      const folderRelPath = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
      const folderParts = folderRelPath.split('/').filter(Boolean)
      const folderName =
        folderParts.length > 0
          ? folderParts[folderParts.length - 1]
          : rootObj?.name || 'Workspace'
      const parentFolderName =
        folderParts.length > 1
          ? folderParts[folderParts.length - 2]
          : rootObj?.name || 'Workspace'
      const gitSt = rootObj ? gitStatuses[rootObj.id] : undefined

      const creationDateIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const evalCtx: TemplateEvaluationContext = {
        ...templateEvaluationContext,
        now,
        creationDate: creationDateIso,
        fileName,
        fileTitle: baseTitle,
        relativePath,
        folderName,
        folderPath: folderRelPath || '/',
        parentFolderName,
        rootName: rootObj?.name || 'Workspace',
        rootPath: rootObj?.path || '',
        gitBranch: gitSt?.branch || 'main',
        gitStatus: gitSt?.state || 'Local'
      }

      const defaultProps = Array.isArray(settings?.defaultFrontmatterProperties)
        ? settings.defaultFrontmatterProperties
        : DEFAULT_FRONTMATTER_PROPERTIES

      const baseBody = `# ${baseTitle}\n\n`
      if (defaultProps.length === 0) {
        return baseBody
      }

      const fmObj: Record<string, unknown> = {}
      for (const prop of defaultProps) {
        if (!prop.key) continue
        const rawDefault =
          (prop.key === 'date' || prop.key === 'creation_date') && !prop.defaultValue
            ? '<% creation_date %>'
            : prop.defaultValue || ''
        let evaluatedStr = ''
        if (rawDefault) {
          const res = await evaluateTemplateVariablesAsync(rawDefault, evalCtx)
          evaluatedStr = res.output.trim()
        }
        if (prop.type === 'tags') {
          fmObj[prop.key] = evaluatedStr ? parseTagListInput(evaluatedStr) : []
        } else if (prop.type === 'checkbox') {
          const lower = evaluatedStr.toLowerCase()
          fmObj[prop.key] = lower === 'true' || lower === '1' || lower === 'yes'
        } else if (prop.type === 'number') {
          if (evaluatedStr !== '' && !Number.isNaN(Number(evaluatedStr))) {
            fmObj[prop.key] = Number(evaluatedStr)
          } else {
            fmObj[prop.key] = evaluatedStr
          }
        } else {
          fmObj[prop.key] = evaluatedStr
        }
      }

      return updateFrontmatterInMarkdown(baseBody, fmObj)
    },
    [roots, gitStatuses, templateEvaluationContext, settings?.defaultFrontmatterProperties]
  )

  const commandActions: CommandActionItem[] = useMemo(
    () => [
      {
        id: 'insert-icon',
        category: 'Insert',
        label: 'Insert Icon from Untitled UI Free Icons (:icon[Name]:)',
        shortcut: 'Mod+Shift+I',
        run: () => setPaletteMode('icons')
      },
      {
        id: 'insert-mermaid-builder',
        category: 'Insert',
        label: 'Open Visual Mermaid Diagram Studio',
        run: () => dispatchEditorCommand('open-mermaid-builder')
      },
      {
        id: 'import-web-clipper',
        category: 'File',
        label: 'Import Web Page / URL as Markdown (Web Clipper)',
        run: () => setShowWebClipperModal(true)
      },
      {
        id: 'open-daily-note',
        category: 'Productivity',
        label: "Open or Create Today's Daily Note",
        run: () => handleOpenDailyNote()
      },
      {
        id: 'start-slide-deck',
        category: 'Presentation',
        label: 'Present Document as Slide Deck',
        run: () => setShowSlideDeckModal(true)
      },
      {
        id: 'mode-source',
        category: 'Editor',
        label: 'Switch to Source Mode',
        shortcut: 'Mod+1',
        run: () => handleChangeEditMode('source')
      },
      {
        id: 'mode-inline',
        category: 'Editor',
        label: 'Switch to Inline Rich Mode (Live Preview)',
        shortcut: 'Mod+2',
        run: () => handleChangeEditMode('inline')
      },
      {
        id: 'mode-split',
        category: 'Editor',
        label: 'Switch to Split Mode',
        shortcut: 'Mod+3',
        run: () => handleChangeEditMode('split')
      },
      {
        id: 'zen-toggle',
        category: 'View',
        label: 'Toggle Zen / Focus Mode',
        shortcut: 'Mod+Shift+F',
        run: () => settings && handleUpdateSettings({ zenMode: !settings.zenMode })
      },
      {
        id: 'frontmatter-panel-toggle',
        category: 'View',
        label: 'Toggle Right Frontmatter Properties Window',
        run: () =>
          settings &&
          handleUpdateSettings({
            frontmatterPanelVisible: !settings.frontmatterPanelVisible
          })
      },
      {
        id: 'templates-panel-toggle',
        category: 'View',
        label: 'Toggle Right Templates Panel (<% %>)',
        run: () =>
          settings &&
          handleUpdateSettings({
            templatesPanelVisible: !settings.templatesPanelVisible
          })
      },
      {
        id: 'calendar-panel-toggle',
        category: 'View',
        label: 'Toggle Right Daily Notes & Calendar Panel',
        run: () =>
          settings &&
          handleUpdateSettings({
            calendarPanelVisible: !settings.calendarPanelVisible
          })
      },
      {
        id: 'tasks-panel-toggle',
        category: 'View',
        label: 'Toggle Right Global Tasks Dashboard',
        run: () =>
          settings &&
          handleUpdateSettings({
            tasksPanelVisible: !settings.tasksPanelVisible
          })
      },
      {
        id: 'help-variables-guide',
        category: 'Help',
        label: 'Open Help: Dynamic Variables (<% %>) & Formatting Reference',
        run: () => openRightHelpPanel('variables')
      },
      {
        id: 'help-about',
        category: 'Help',
        label: 'About Klartext (Name, Version, License, Author)',
        run: () => setShowAboutModal(true)
      },
      {
        id: 'spellcheck-toggle',
        category: 'Spellcheck',
        label: 'Toggle Document Spellcheck (Red Squiggly Underlines)',
        run: () =>
          settings &&
          handleUpdateSettings({
            spellcheckEnabled: settings.spellcheckEnabled === false
          })
      },
      {
        id: 'git-sync-all',
        category: 'Git',
        label: 'Git: Sync All Repositories',
        run: async () => {
          await window.klartext.gitSyncAll()
          await refreshWorkspaceAndTrees()
        }
      },
      {
        id: 'theme-toggle',
        category: 'Appearance',
        label: 'Toggle Light / Dark Theme',
        run: () =>
          handleUpdateSettings({
            theme: resolvedTheme === 'dark' ? 'light' : 'dark'
          })
      },
      {
        id: 'export-html',
        category: 'Export',
        label: 'Export Document to Standalone HTML',
        run: handleExportHtml
      },
      {
        id: 'export-pdf',
        category: 'Export',
        label: 'Export Document to PDF',
        run: handleExportPdf
      },
      {
        id: 'export-docx',
        category: 'Export',
        label: 'Export Document to Word (.docx)',
        run: handleExportDocx
      }
    ],
    [
      activeTab,
      resolvedTheme,
      settings,
      refreshWorkspaceAndTrees,
      handleExportHtml,
      handleExportPdf,
      handleExportDocx,
      handleOpenDailyNote,
      dispatchEditorCommand,
      openRightHelpPanel,
      handleUpdateSettings,
      handleChangeEditMode
    ]
  )

  const headings = useMemo(
    () => (activeTab ? extractHeadings(activeTab.content) : []),
    [activeTab?.content]
  )

  const parsedFrontmatter = useMemo(() => {
    if (!activeTab || activeTab.relativePath.toLowerCase().endsWith('.svg')) {
      return { frontmatter: null, body: '' }
    }
    return extractFrontmatter(activeTab.content)
  }, [activeTab?.content, activeTab?.relativePath])

  const updateFrontmatterField = (key: string, value: unknown) => {
    if (!activeTab) return
    const currentObj: Record<string, unknown> = { ...(parsedFrontmatter.frontmatter || {}) }
    if (key === 'tags' && typeof value === 'string') {
      currentObj[key] = parseTagListInput(value)
    } else {
      currentObj[key] = value
    }
    const nextContent = updateFrontmatterInMarkdown(activeTab.content, currentObj)
    handleEditorContentChange(nextContent)
  }

  const wordCount = useMemo(() => {
    if (!activeTab) return 0
    return activeTab.content.trim().split(/\s+/).filter(Boolean).length
  }, [activeTab?.content])

  // Aggregate multi-repo sync summary badge
  const gitAggregateSummary = useMemo(() => {
    const repoList = Object.values(gitStatuses).filter((s) => s.isGitRepo)
    if (repoList.length === 0) return 'Local Workspace'
    const conflicts = repoList.filter((s) => s.state === 'Merge Conflict').length
    if (conflicts > 0) return `${conflicts} Conflict(s)`
    const synced = repoList.filter((s) => s.state === 'Synced').length
    return `${synced}/${repoList.length} Repos Synced`
  }, [gitStatuses])

  if (!settings) {
    return <div className="h-screen w-screen bg-app flex items-center justify-center text-xs">Loading Klartext...</div>
  }

  const currentSpellLangs = settings.spellcheckLanguages || ['en-US', 'sv-SE']

  const isAnyTopMenuOpen =
    showFileMenu ||
    showEditMenu ||
    showViewMenu ||
    showFormatMenu ||
    showAIMenu ||
    showHelpMenu

  const openExclusiveTopMenu = (
    menu: 'file' | 'edit' | 'view' | 'format' | 'ai' | 'help' | null
  ) => {
    setShowFileMenu(menu === 'file')
    setShowEditMenu(menu === 'edit')
    setShowViewMenu(menu === 'view')
    setShowFormatMenu(menu === 'format')
    setShowAIMenu(menu === 'ai')
    setShowHelpMenu(menu === 'help')
    if (menu !== 'edit') {
      setShowInsertMenu(false)
    }
  }

  return (
    <div
      data-testid="klartext-app-shell"
      className="h-screen w-screen flex flex-col bg-app text-primary overflow-hidden"
    >
      {/* Top 36px Frameless Technical Nordic Header Bar (Hidden in Zen Mode) */}
      {!settings.zenMode && (
        <header
          data-testid="top-titlebar"
          className="h-9 px-3 bg-app border-b border-subtle flex items-center justify-between text-xs titlebar-drag-region shrink-0"
        >
          <div className="flex items-center gap-2 titlebar-drag-region pl-14 relative shrink-0">
            <button
              type="button"
              title="Toggle Left Sidebar (Mod+B)"
              aria-label="Toggle Left Sidebar"
              data-testid="toggle-left-sidebar-btn"
              onClick={() =>
                handleUpdateSettings({ leftSidebarOpen: !settings.leftSidebarOpen })
              }
              className={`p-1 rounded hover:bg-secondary titlebar-no-drag ${
                settings.leftSidebarOpen ? 'text-accent' : 'text-muted'
              }`}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <span
              data-testid="app-title-drag"
              className="font-semibold tracking-tight text-primary titlebar-drag-region select-none px-1 py-1"
            >
              Klartext
            </span>

            {/* File Menu (Open new workspace, Export HTML/PDF, Settings) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="file-menu-btn"
                onMouseEnter={() => {
                  if (isAnyTopMenuOpen) openExclusiveTopMenu('file')
                }}
                onClick={() => openExclusiveTopMenu(showFileMenu ? null : 'file')}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>File</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showFileMenu && (
                <div
                  data-testid="file-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-64 rounded-md bg-panel border border-subtle shadow-lg py-1 text-xs"
                >
                  <button
                    type="button"
                    data-testid="file-menu-open-workspace"
                    onClick={async () => {
                      setShowFileMenu(false)
                      await window.klartext.openFolderDialog()
                      await refreshWorkspaceAndTrees()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FolderPlus className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Open new workspace...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">⌘O</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="file-menu-add-git-workspace"
                    onClick={() => {
                      setShowFileMenu(false)
                      setShowGitHubWizardModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Add Git workspace...</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="file-menu-create-dynamic-workspace"
                    onClick={() => {
                      setShowFileMenu(false)
                      setDynamicWizardState({
                        open: true,
                        targetWorkspace: null,
                        editingFolder: null
                      })
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Create a new dynamic workspace...</span>
                    </span>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="file-menu-web-clipper"
                    onClick={() => {
                      setShowFileMenu(false)
                      setShowWebClipperModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Import Web Page / URL as Markdown...</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="file-menu-slide-deck"
                    onClick={() => {
                      setShowFileMenu(false)
                      setShowSlideDeckModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Present as Slide Deck...</span>
                    </span>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="export-html-btn"
                    onClick={async () => {
                      setShowFileMenu(false)
                      await handleExportHtml()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Export to Standalone HTML...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">⇧⌘E</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="export-pdf-btn"
                    onClick={async () => {
                      setShowFileMenu(false)
                      await handleExportPdf()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Export to PDF...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">⌥⌘E</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="export-docx-btn"
                    onClick={async () => {
                      setShowFileMenu(false)
                      await handleExportDocx()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Export to Word (.docx)...</span>
                    </span>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="open-settings-btn"
                    onClick={() => {
                      setShowFileMenu(false)
                      setShowSettingsModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Settings...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">⌘,</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu (Undo, Redo, Cut, Copy, Paste, Select All, Insert Submenu, Find, Copy Rich HTML, Document Cleanup, Diagrams) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="edit-menu-btn"
                onMouseEnter={() => {
                  if (isAnyTopMenuOpen) openExclusiveTopMenu('edit')
                }}
                onClick={() => openExclusiveTopMenu(showEditMenu ? null : 'edit')}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>Edit</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showEditMenu && (
                <div
                  data-testid="edit-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-64 rounded-md bg-panel border border-subtle shadow-lg py-1 text-xs"
                >
                  <button
                    type="button"
                    data-testid="edit-menu-undo"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('undo')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Undo</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘Z</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-redo"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('redo')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Redo</span>
                    <kbd className="text-[10px] font-mono text-muted">⇧⌘Z</kbd>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="edit-menu-cut"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('cut')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Cut</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘X</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-copy"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('copy')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘C</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-paste"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('paste')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Paste</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘V</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-select-all"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('select-all')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Select All</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘A</kbd>
                  </button>
                  <div className="my-1 border-t border-subtle" />

                  {/* Insert Submenu inside Edit Menu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setShowInsertMenu(true)}
                  >
                    <button
                      type="button"
                      data-testid="insert-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowInsertMenu((v) => !v)
                      }}
                      className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between font-medium"
                    >
                      <span>Insert</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted" />
                    </button>

                    {showInsertMenu && (
                      <div
                        data-testid="insert-menu-dropdown"
                        className="absolute left-full top-0 ml-0.5 z-50 w-72 max-h-[80vh] overflow-y-auto rounded-md bg-panel border border-subtle shadow-lg py-1.5 text-xs"
                      >
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Tables
                        </div>
                        <button
                          type="button"
                          data-testid="insert-menu-table-2x2"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('table-2x2')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Insert Table (2 × 2)</span>
                          <kbd className="text-[10px] font-mono text-muted">2 cols</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-table-3x3"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('table-3x3')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Insert Table (3 × 3)</span>
                          <kbd className="text-[10px] font-mono text-muted">3 cols</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-table-4x4"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('table-4x4')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Insert Table (4 × 4)</span>
                          <kbd className="text-[10px] font-mono text-muted">4 cols</kbd>
                        </button>

                        <div className="my-1 border-t border-subtle" />
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Callouts &amp; Alerts
                        </div>
                        {(
                          [
                            ['callout-note', 'Note Callout', '> [!NOTE]'],
                            ['callout-tip', 'Tip Callout', '> [!TIP]'],
                            ['callout-important', 'Important Callout', '> [!IMPORTANT]'],
                            ['callout-warning', 'Warning Alert', '> [!WARNING]'],
                            ['callout-caution', 'Caution Alert', '> [!CAUTION]']
                          ] as const
                        ).map(([cmd, label, syntax]) => (
                          <button
                            key={cmd}
                            type="button"
                            data-testid={`insert-menu-${cmd}`}
                            onClick={() => {
                              setShowInsertMenu(false)
                              setShowEditMenu(false)
                              dispatchEditorCommand(cmd)
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                          >
                            <span>{label}</span>
                            <kbd className="text-[10px] font-mono text-muted">{syntax}</kbd>
                          </button>
                        ))}

                        <div className="my-1 border-t border-subtle" />
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Code, Math &amp; Structure
                        </div>
                        <button
                          type="button"
                          data-testid="insert-menu-codeblock"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('codeblock')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Fenced Code Block</span>
                          <kbd className="text-[10px] font-mono text-muted">```ts</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-math-inline"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('math-inline')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Inline Math Formula (KaTeX)</span>
                          <kbd className="text-[10px] font-mono text-muted">$E = mc^2$</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-math-block"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('math-block')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Display Math Equation Block</span>
                          <kbd className="text-[10px] font-mono text-muted">$$ ... $$</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-details"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('details')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Collapsible Accordion Section</span>
                          <kbd className="text-[10px] font-mono text-muted">&lt;details&gt;</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-hr"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('hr')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Horizontal Divider Line</span>
                          <kbd className="text-[10px] font-mono text-muted">---</kbd>
                        </button>

                        <div className="my-1 border-t border-subtle" />
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Links, Media &amp; Metadata
                        </div>
                        <button
                          type="button"
                          data-testid="insert-menu-link"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('link')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Hyperlink</span>
                          <kbd className="text-[10px] font-mono text-muted">[text](url) · ⌘K</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-bookmark-card"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('bookmark-card')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Web Bookmark Card</span>
                          <kbd className="text-[10px] font-mono text-muted">:::bookmark</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-wikilink"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('wikilink')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Wiki-Link to Document</span>
                          <kbd className="text-[10px] font-mono text-muted">[[Doc]]</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-image"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('image')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Image Reference</span>
                          <kbd className="text-[10px] font-mono text-muted">![alt](img)</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-icon"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            setPaletteMode('icons')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-accent font-medium flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5">
                            <Smile className="w-3.5 h-3.5" />
                            <span>Insert Icon (Untitled UI)...</span>
                          </span>
                          <kbd className="text-[10px] font-mono text-muted">:icon[Name]: · ⌘⇧I</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-footnote"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('footnote')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Footnote Reference</span>
                          <kbd className="text-[10px] font-mono text-muted">[^1]</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-toc"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('toc')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Table of Contents</span>
                          <kbd className="text-[10px] font-mono text-muted">[[_TOC_]]</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-frontmatter"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('frontmatter')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>YAML Frontmatter Block</span>
                          <kbd className="text-[10px] font-mono text-muted">---</kbd>
                        </button>
                        <button
                          type="button"
                          data-testid="insert-menu-date"
                          onClick={() => {
                            setShowInsertMenu(false)
                            setShowEditMenu(false)
                            dispatchEditorCommand('date')
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                        >
                          <span>Current Date (ISO)</span>
                          <kbd className="text-[10px] font-mono text-muted">YYYY-MM-DD</kbd>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    data-testid="edit-menu-insert-icon"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      setPaletteMode('icons')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-accent font-medium flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5" />
                      <span>Insert Icon...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">⌘⇧I</kbd>
                  </button>

                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="edit-menu-find-in-doc"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('open-in-doc-find')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Find &amp; Replace in Document...</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘F</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-find"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      if (!settings.leftSidebarOpen) {
                        handleUpdateSettings({ leftSidebarOpen: true, leftSidebarTab: 'search' })
                      } else {
                        handleSelectLeftSidebarTab('search')
                      }
                      setLeftSidebarTab('search')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Find in Workspace...</span>
                    <kbd className="text-[10px] font-mono text-muted">⇧⌘F</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="copy-rich-html-btn"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('copy-rich-html')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy Rich HTML</span>
                  </button>
                  <button
                    type="button"
                    data-testid="copy-slack-md-btn"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('copy-slack-md')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy as Slack Markdown</span>
                  </button>
                  <button
                    type="button"
                    data-testid="copy-jira-md-btn"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('copy-jira-md')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy as Jira Markdown</span>
                  </button>
                  <button
                    type="button"
                    data-testid="copy-gfm-md-btn"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('copy-gfm-md')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy as GitHub Markdown (GFM)</span>
                  </button>

                  {/* Document Cleanup Section (moved from Format menu to Edit menu) */}
                  <div className="my-1 border-t border-subtle" />
                  <div
                    className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    onMouseEnter={() => setShowInsertMenu(false)}
                  >
                    Document Cleanup
                  </div>
                  <button
                    type="button"
                    data-testid="format-menu-prettify-doc"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('format-doc')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between font-medium"
                  >
                    <span>Format &amp; Prettify Document</span>
                    <kbd className="text-[10px] font-mono text-muted">⇧⌘I</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-align-tables"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('format-tables')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Align All GFM Tables</span>
                    <kbd className="text-[10px] font-mono text-muted">| A | B |</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-clear"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('clear-format')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Clear Formatting</span>
                  </button>

                  {/* Diagrams (Mermaid) Section (moved from Insert to Edit menu) */}
                  <div className="my-1 border-t border-subtle" />
                  <div
                    className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    onMouseEnter={() => setShowInsertMenu(false)}
                  >
                    Diagrams (Mermaid)
                  </div>
                  <button
                    type="button"
                    data-testid="insert-menu-visual-builder"
                    onMouseEnter={() => setShowInsertMenu(false)}
                    onClick={() => {
                      setShowEditMenu(false)
                      setShowInsertMenu(false)
                      dispatchEditorCommand('open-mermaid-builder')
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-secondary text-accent font-medium flex items-center justify-between"
                  >
                    <span>Open Visual Diagram Builder...</span>
                    <kbd className="text-[10px] font-mono text-muted">Canvas</kbd>
                  </button>
                  {(
                    [
                      ['mermaid', 'Flowchart Diagram', 'flowchart LR'],
                      ['mermaid-sequence', 'Sequence Diagram', 'sequenceDiagram'],
                      ['mermaid-state', 'State Diagram', 'stateDiagram-v2'],
                      ['mermaid-class', 'Class Diagram', 'classDiagram'],
                      ['mermaid-er', 'ER Diagram', 'erDiagram'],
                      ['mermaid-gantt', 'Gantt Roadmap', 'gantt'],
                      ['mermaid-pie', 'Pie Chart', 'pie'],
                      ['mermaid-mindmap', 'Mindmap', 'mindmap']
                    ] as const
                  ).map(([cmd, label, syntax]) => (
                    <button
                      key={cmd}
                      type="button"
                      data-testid={`insert-menu-${cmd}`}
                      onMouseEnter={() => setShowInsertMenu(false)}
                      onClick={() => {
                        setShowEditMenu(false)
                        setShowInsertMenu(false)
                        dispatchEditorCommand(cmd)
                      }}
                      className="w-full text-left px-3 py-1 hover:bg-secondary text-primary flex items-center justify-between"
                    >
                      <span>{label}</span>
                      <kbd className="text-[10px] font-mono text-muted">{syntax}</kbd>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Format Menu Dropdown (Moved to the left of View menu) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="format-menu-btn"
                onMouseEnter={() => {
                  if (isAnyTopMenuOpen) openExclusiveTopMenu('format')
                }}
                onClick={() => openExclusiveTopMenu(showFormatMenu ? null : 'format')}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>Format</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showFormatMenu && (
                <div
                  data-testid="format-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-72 max-h-[82vh] overflow-y-auto rounded-md bg-panel border border-subtle shadow-lg py-1.5 text-xs"
                >
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Text Styles
                  </div>
                  <button
                    type="button"
                    data-testid="format-menu-bold"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('bold')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="font-semibold">Bold</span>
                    <kbd className="text-[10px] font-mono text-muted">**text** · ⌘B</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-italic"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('italic')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="italic">Italic</span>
                    <kbd className="text-[10px] font-mono text-muted">*text* · ⌘I</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-bold-italic"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('bold-italic')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="font-semibold italic">Bold &amp; Italic</span>
                    <kbd className="text-[10px] font-mono text-muted">***text***</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-strike"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('strikethrough')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="line-through">Strikethrough</span>
                    <kbd className="text-[10px] font-mono text-muted">~~text~~ · ⇧⌘X</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-highlight"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('highlight')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Highlight</span>
                    <kbd className="text-[10px] font-mono text-muted">==text== · ⇧⌘H</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-underline"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('underline')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="underline">Underline</span>
                    <kbd className="text-[10px] font-mono text-muted">&lt;u&gt;text&lt;/u&gt;</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-superscript"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('superscript')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Superscript (X²)</span>
                    <kbd className="text-[10px] font-mono text-muted">&lt;sup&gt;2&lt;/sup&gt;</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-subscript"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('subscript')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Subscript (H₂O)</span>
                    <kbd className="text-[10px] font-mono text-muted">&lt;sub&gt;2&lt;/sub&gt;</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-code"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('code')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Inline Code</span>
                    <kbd className="text-[10px] font-mono text-muted">`code`</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-kbd"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('kbd')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Keyboard Shortcut Key</span>
                    <kbd className="text-[10px] font-mono text-muted">&lt;kbd&gt;⌘K&lt;/kbd&gt;</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-spoiler"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('spoiler')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Spoiler Text</span>
                    <kbd className="text-[10px] font-mono text-muted">&gt;!spoiler!&lt;</kbd>
                  </button>

                  <div className="my-1 border-t border-subtle" />
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Headings (H1 – H6)
                  </div>
                  {(
                    [
                      ['h1', 'Heading 1', '# Heading'],
                      ['h2', 'Heading 2', '## Heading'],
                      ['h3', 'Heading 3', '### Heading'],
                      ['h4', 'Heading 4', '#### Heading'],
                      ['h5', 'Heading 5', '##### Heading'],
                      ['h6', 'Heading 6', '###### Heading']
                    ] as const
                  ).map(([cmd, label, syntax]) => (
                    <button
                      key={cmd}
                      type="button"
                      data-testid={`format-menu-${cmd}`}
                      onClick={() => {
                        setShowFormatMenu(false)
                        dispatchEditorCommand(cmd)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                    >
                      <span>{label}</span>
                      <kbd className="text-[10px] font-mono text-muted">{syntax}</kbd>
                    </button>
                  ))}

                  <div className="my-1 border-t border-subtle" />
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Lists &amp; Quotes
                  </div>
                  <button
                    type="button"
                    data-testid="format-menu-bullet"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('bullet')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Bulleted List</span>
                    <kbd className="text-[10px] font-mono text-muted">- item</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-numbered"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('numbered')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Numbered List</span>
                    <kbd className="text-[10px] font-mono text-muted">1. item</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-task"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('task')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Task Checklist</span>
                    <kbd className="text-[10px] font-mono text-muted">- [ ] task</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-deflist"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('def-list')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Definition List</span>
                    <kbd className="text-[10px] font-mono text-muted">Term : Def</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="format-menu-quote"
                    onClick={() => {
                      setShowFormatMenu(false)
                      dispatchEditorCommand('quote')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Blockquote</span>
                    <kbd className="text-[10px] font-mono text-muted">&gt; quote</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* View & Right Panels Menu Dropdown */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="view-menu-btn"
                onMouseEnter={() => {
                  if (isAnyTopMenuOpen) openExclusiveTopMenu('view')
                }}
                onClick={() => openExclusiveTopMenu(showViewMenu ? null : 'view')}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>View</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showViewMenu && (
                <div
                  data-testid="view-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-80 min-w-[320px] rounded-md bg-panel border border-subtle shadow-lg p-2 space-y-0.5 text-xs"
                >
                  <button
                    type="button"
                    data-testid="view-menu-toggle-theme"
                    onClick={() => {
                      handleUpdateSettings({
                        theme: resolvedTheme === 'dark' ? 'light' : 'dark'
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0">
                      {resolvedTheme === 'dark' ? '☀️' : '🌙'}
                    </span>
                    <span>
                      Switch to {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-lightpaper"
                    onClick={() => {
                      handleUpdateSettings({
                        lightPaperInDarkMode: !settings.lightPaperInDarkMode
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.lightPaperInDarkMode ? '✓' : ''}
                    </span>
                    <span>White Paper Background in Dark Mode</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-wordwrap"
                    onClick={() => {
                      handleUpdateSettings({
                        wordWrap: settings.wordWrap === false
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.wordWrap !== false ? '✓' : ''}
                    </span>
                    <span>Word Wrap (Off = Infinite Workspace)</span>
                  </button>

                  <div className="my-1 border-t border-subtle" />
                  <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Page Margins &amp; Word Flow
                  </div>

                  {(
                    [
                      ['small', 'Small Margins'],
                      ['medium', 'Medium Margins'],
                      ['wide', 'Wide Margins'],
                      ['word-flow', 'Word Flow (Dynamic Auto-Reflow)']
                    ] as const
                  ).map(([modeValue, modeLabel]) => {
                    const currentMarginMode = settings.editorMarginMode || 'medium'
                    const isCurrentMode = currentMarginMode === modeValue
                    return (
                      <button
                        key={modeValue}
                        type="button"
                        data-testid={`view-menu-margin-${modeValue}`}
                        onClick={() => {
                          handleUpdateSettings({
                            editorMarginMode: modeValue,
                            wordWrap: true
                          })
                          setShowViewMenu(false)
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                      >
                        <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                          {isCurrentMode ? '✓' : ''}
                        </span>
                        <span>{modeLabel}</span>
                      </button>
                    )
                  })}

                  <div className="my-1 border-t border-subtle" />
                  <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Writing Ergonomics
                  </div>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-focus-mode"
                    onClick={() => {
                      handleUpdateSettings({
                        focusMode: !settings.focusMode
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.focusMode ? '✓' : ''}
                    </span>
                    <span>Focus Mode (Dim Inactive Paragraphs)</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-open-daily-note"
                    onClick={() => {
                      setShowViewMenu(false)
                      void handleOpenDailyNote()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0">
                      📅
                    </span>
                    <span>Open Today&apos;s Daily Note</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-slide-deck"
                    onClick={() => {
                      setShowViewMenu(false)
                      setShowSlideDeckModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0">
                      📽️
                    </span>
                    <span>Start Slide Deck Presentation</span>
                  </button>

                  <div className="my-1 border-t border-subtle" />

                  <button
                    type="button"
                    data-testid="view-menu-toggle-toolbar"
                    onClick={() => {
                      handleUpdateSettings({
                        formattingToolbarVisible: !settings.formattingToolbarVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.formattingToolbarVisible ? '✓' : ''}
                    </span>
                    <span>Show Formatting Toolbar Row</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-statusbar"
                    onClick={() => {
                      handleUpdateSettings({ statusBarVisible: !settings.statusBarVisible })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.statusBarVisible ? '✓' : ''}
                    </span>
                    <span>Show Bottom Status Row</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-sidebar-bar"
                    onClick={() => {
                      handleUpdateSettings({
                        sidebarControlBarVisible: settings.sidebarControlBarVisible === false
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.sidebarControlBarVisible !== false ? '✓' : ''}
                    </span>
                    <span>Show Left Panel Control Bar</span>
                  </button>

                  <div className="my-1 border-t border-subtle" />
                  <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Right Side Panels
                  </div>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-frontmatter"
                    onClick={() => {
                      handleUpdateSettings({
                        frontmatterPanelVisible: !settings.frontmatterPanelVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.frontmatterPanelVisible ? '✓' : ''}
                    </span>
                    <span>Show Right Frontmatter Window</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-templates"
                    onClick={() => {
                      handleUpdateSettings({
                        templatesPanelVisible: !settings.templatesPanelVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.templatesPanelVisible ? '✓' : ''}
                    </span>
                    <span>Show Right Templates Panel (&lt;% %&gt;)</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-ai"
                    onClick={() => {
                      handleUpdateSettings({
                        rightSidebarOpen: !settings.rightSidebarOpen
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.rightSidebarOpen ? '✓' : ''}
                    </span>
                    <span>Show Right Local AI Panel</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-calendar"
                    onClick={() => {
                      handleUpdateSettings({
                        calendarPanelVisible: !settings.calendarPanelVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.calendarPanelVisible ? '✓' : ''}
                    </span>
                    <span>Show Right Daily Notes &amp; Calendar Panel</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-tasks"
                    onClick={() => {
                      handleUpdateSettings({
                        tasksPanelVisible: !settings.tasksPanelVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.tasksPanelVisible ? '✓' : ''}
                    </span>
                    <span>Show Right Global Tasks Panel</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-help"
                    onClick={() => {
                      handleUpdateSettings({
                        helpPanelVisible: !settings.helpPanelVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.helpPanelVisible ? '✓' : ''}
                    </span>
                    <span>Show Right Help &amp; Reference Panel</span>
                  </button>

                  <div className="my-1 border-t border-subtle" />

                  <button
                    type="button"
                    data-testid="view-menu-toggle-outline"
                    onClick={() => {
                      const nextVal = settings.showOutlineTab === false
                      if (!nextVal && leftSidebarTab === 'outline') {
                        setLeftSidebarTab('explorer')
                        handleUpdateSettings({
                          showOutlineTab: nextVal,
                          leftSidebarTab: 'explorer'
                        })
                      } else {
                        handleUpdateSettings({ showOutlineTab: nextVal })
                      }
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.showOutlineTab !== false ? '✓' : ''}
                    </span>
                    <span>Show Outline in Sidebar</span>
                  </button>

                  <div className="my-1 border-t border-subtle" />

                  <button
                    type="button"
                    data-testid="view-menu-toggle-spellcheck"
                    onClick={() => {
                      handleUpdateSettings({
                        spellcheckEnabled: settings.spellcheckEnabled === false
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
                  >
                    <span className="w-4 inline-flex items-center justify-center shrink-0 text-accent font-bold">
                      {settings.spellcheckEnabled !== false ? '✓' : ''}
                    </span>
                    <span>Spellcheck (Red Squiggly Underlines)</span>
                  </button>

                  <div className="px-3 py-1.5 space-y-1">
                    <div className="text-[10px] font-semibold uppercase text-muted">
                      Spellcheck Languages:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(SPELL_LANGUAGE_LABELS) as SupportedSpellLanguage[]).map(
                        (lang) => {
                          const active = currentSpellLangs.includes(lang)
                          return (
                            <button
                              key={lang}
                              type="button"
                              data-testid={`view-menu-spell-lang-${lang}`}
                              onClick={() => {
                                const next = active
                                  ? currentSpellLangs.filter((l) => l !== lang)
                                  : [...currentSpellLangs, lang]
                                handleUpdateSettings({
                                  spellcheckLanguages: next.length > 0 ? next : ['en-US']
                                })
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] border font-medium ${
                                active
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-app border-subtle text-muted hover:text-primary'
                              }`}
                            >
                              {lang}
                            </button>
                          )
                        }
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Help Menu Dropdown (Opens Right Help & Reference Panel) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="help-menu-btn"
                onMouseEnter={() => {
                  if (isAnyTopMenuOpen) openExclusiveTopMenu('help')
                }}
                onClick={() => openExclusiveTopMenu(showHelpMenu ? null : 'help')}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <HelpCircle className="w-3 h-3 text-accent" />
                <span>Help</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showHelpMenu && (
                <div
                  data-testid="help-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-72 rounded-md bg-panel border border-subtle shadow-lg py-1.5 text-xs"
                >
                  <button
                    type="button"
                    data-testid="help-menu-formatting"
                    onClick={() => {
                      setShowHelpMenu(false)
                      openRightHelpPanel('formatting')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Markdown Formatting Guide...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">Syntax</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="help-menu-variables"
                    onClick={() => {
                      setShowHelpMenu(false)
                      openRightHelpPanel('variables')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Dynamic Variables (&lt;% %&gt;) Guide...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-accent">&lt;% %&gt;</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="help-menu-ai"
                    onClick={() => {
                      setShowHelpMenu(false)
                      openRightHelpPanel('ai')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Local AI &amp; Workspace Q&amp;A Guide...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-accent">RAG / AI</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="help-menu-shortcuts"
                    onClick={() => {
                      setShowHelpMenu(false)
                      openRightHelpPanel('shortcuts')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Smart Editing &amp; Shortcuts...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-muted">Keys</kbd>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="help-menu-about"
                    onClick={() => {
                      setShowHelpMenu(false)
                      setHelpModalTab('about')
                      setShowAboutModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>About Klartext...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-accent">v1.4.0</kbd>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Page Tabs on Top Menu Row (starting on the right side of the last menu item when configured) */}
          {settings.pageTabsPosition === 'top-menu' && tabs.length > 0 && (
            <div
              data-testid="document-tab-bar"
              onDragOver={(e) => {
                if (draggedDocTab) {
                  e.preventDefault()
                  setDragOverPane('primary')
                }
              }}
              onDrop={(e) => {
                if (!draggedDocTab) return
                e.preventDefault()
                moveTabToPane(draggedDocTab.fromPane, 'primary', draggedDocTab.tab)
                setDraggedDocTab(null)
                setDragOverPane(null)
              }}
              className="flex-1 flex items-center gap-1 text-xs min-w-0 whitespace-nowrap titlebar-drag-region ml-2 mr-2 self-end pt-1"
            >
              {tabBarHasOverflow && (
                <button
                  type="button"
                  data-tooltip="Scroll Tabs Left"
                  data-testid="tab-bar-scroll-left"
                  onClick={() => {
                    tabBarScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })
                  }}
                  className="p-0.5 rounded bg-panel border border-subtle text-muted hover:text-primary hover:border-accent shrink-0 mb-1 titlebar-no-drag"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              <div
                ref={tabBarScrollRef}
                onScroll={updateTabBarOverflow}
                className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 max-w-full titlebar-no-drag"
              >
                {tabs.map((tab) => {
                  const isCurrent = tab.key === primaryActiveTab?.key
                  const fileNameOnly = tab.relativePath.split('/').pop() || tab.relativePath
                  return (
                    <div
                      key={tab.key}
                      draggable
                      onDragStart={(e) => {
                        setDraggedDocTab({ fromPane: 'primary', tab })
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData(
                          'application/x-klartext-doc-tab',
                          JSON.stringify({ fromPane: 'primary', key: tab.key })
                        )
                      }}
                      onDragEnd={() => {
                        setDraggedDocTab(null)
                        setDragOverPane(null)
                      }}
                      onDragOver={(e) => {
                        if (draggedDocTab) {
                          e.preventDefault()
                          e.stopPropagation()
                          setDragOverPane('primary')
                        }
                      }}
                      onDrop={(e) => {
                        if (!draggedDocTab) return
                        e.preventDefault()
                        e.stopPropagation()
                        moveTabToPane(
                          draggedDocTab.fromPane,
                          'primary',
                          draggedDocTab.tab,
                          tab.key
                        )
                        setDraggedDocTab(null)
                        setDragOverPane(null)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setTabContextMenu({
                          pane: 'primary',
                          tab,
                          x: e.clientX,
                          y: e.clientY
                        })
                      }}
                      title={`${tab.rootName} — ${tab.relativePath}`}
                      data-testid={`doc-tab-${tab.rootId}-${tab.relativePath}`}
                      onClick={() => {
                        setActiveTabKey(tab.key)
                        setFocusedEditorPane('primary')
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t-md border-t border-x cursor-pointer shrink-0 max-w-[180px] titlebar-no-drag ${
                        isCurrent
                          ? 'bg-panel border-subtle text-primary font-medium'
                          : 'bg-secondary/50 border-transparent text-muted hover:text-primary'
                      }`}
                    >
                      <span className="truncate whitespace-nowrap block max-w-[140px]">
                        {fileNameOnly}
                        {tab.dirty ? ' •' : ''}
                      </span>
                      {(tabs.length > 1 || secondaryTabs.length > 0) && (
                        <button
                          type="button"
                          data-testid={`close-tab-${tab.rootId}-${tab.relativePath}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            closeTabInPane('primary', tab.key)
                          }}
                          className="text-muted hover:text-danger shrink-0 titlebar-no-drag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {tabBarHasOverflow && (
                <button
                  type="button"
                  data-tooltip="Scroll Tabs Right"
                  data-testid="tab-bar-scroll-right"
                  onClick={() => {
                    tabBarScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })
                  }}
                  className="p-0.5 rounded bg-panel border border-subtle text-muted hover:text-primary hover:border-accent shrink-0 mb-1 titlebar-no-drag"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Draggable empty space to the right of the last page tab so dragging moves the app window */}
              <div
                data-testid="tab-bar-drag-spacer"
                className="flex-1 self-stretch min-w-[16px] titlebar-drag-region"
              />
            </div>
          )}

          {/* Right Utility Controls (Toggle Right Panel & Zen Mode) */}
          <div className="flex items-center gap-1.5 titlebar-no-drag shrink-0">
            <button
              type="button"
              title="Toggle Right Panel"
              aria-label="Toggle Right Panel"
              data-testid="toggle-right-panel-btn"
              onClick={() => {
                if (
                  settings.frontmatterPanelVisible ||
                  settings.rightSidebarOpen ||
                  settings.templatesPanelVisible ||
                  settings.helpPanelVisible ||
                  settings.calendarPanelVisible ||
                  settings.tasksPanelVisible
                ) {
                  const lastPanel = settings.frontmatterPanelVisible
                    ? 'frontmatter'
                    : settings.templatesPanelVisible
                      ? 'templates'
                      : settings.helpPanelVisible
                        ? 'help'
                        : settings.calendarPanelVisible
                          ? 'calendar'
                          : settings.tasksPanelVisible
                            ? 'tasks'
                            : 'ai'
                  setLastActiveRightPanel(lastPanel)
                  handleUpdateSettings({
                    frontmatterPanelVisible: false,
                    rightSidebarOpen: false,
                    templatesPanelVisible: false,
                    helpPanelVisible: false,
                    calendarPanelVisible: false,
                    tasksPanelVisible: false,
                    lastActiveRightPanel: lastPanel
                  })
                } else if (lastActiveRightPanel === 'frontmatter') {
                  handleUpdateSettings({
                    frontmatterPanelVisible: true,
                    lastActiveRightPanel: 'frontmatter'
                  })
                } else if (lastActiveRightPanel === 'templates') {
                  handleUpdateSettings({
                    templatesPanelVisible: true,
                    lastActiveRightPanel: 'templates'
                  })
                } else if (lastActiveRightPanel === 'help') {
                  handleUpdateSettings({
                    helpPanelVisible: true,
                    lastActiveRightPanel: 'help'
                  })
                } else if (lastActiveRightPanel === 'calendar') {
                  handleUpdateSettings({
                    calendarPanelVisible: true,
                    lastActiveRightPanel: 'calendar'
                  })
                } else if (lastActiveRightPanel === 'tasks') {
                  handleUpdateSettings({
                    tasksPanelVisible: true,
                    lastActiveRightPanel: 'tasks'
                  })
                } else {
                  handleUpdateSettings({
                    rightSidebarOpen: true,
                    lastActiveRightPanel: 'ai'
                  })
                }
              }}
              className={`p-1 rounded hover:bg-secondary ${
                settings.frontmatterPanelVisible ||
                settings.rightSidebarOpen ||
                settings.templatesPanelVisible ||
                settings.helpPanelVisible ||
                settings.calendarPanelVisible ||
                settings.tasksPanelVisible
                  ? 'text-accent'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <PanelRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Toggle Zen Mode (Cmd/Ctrl+Shift+F)"
              aria-label="Toggle Zen Mode"
              data-testid="toggle-zen-mode-btn"
              onClick={() => handleUpdateSettings({ zenMode: !settings.zenMode })}
              className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Zen Mode Floating Exit Pill */}
      {settings.zenMode && (
        <div className="fixed top-3 right-4 z-40">
          <button
            type="button"
            data-testid="exit-zen-mode-btn"
            onClick={() => handleUpdateSettings({ zenMode: false })}
            className="px-3 py-1 rounded-full bg-secondary border border-subtle text-xs text-muted hover:text-primary shadow-sm"
          >
            Exit Zen Mode (⌘⇧F)
          </button>
        </div>
      )}

      {/* Crash Recovery Banner if snapshots from previous session exist */}
      {recoverySnapshots.length > 0 && (
        <div
          data-testid="crash-recovery-banner"
          className="px-4 py-1.5 bg-secondary border-b border-subtle flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2 text-warning font-medium">
            <AlertCircle className="w-4 h-4" />
            <span>
              Unsaved recovery snapshot available for{' '}
              <strong>{recoverySnapshots[0].relativePath}</strong> ({recoverySnapshots[0].rootId})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="restore-recovery-snapshot-btn"
              onClick={async () => {
                const snap = recoverySnapshots[0]
                await window.klartext.writeDocument(snap.rootId, snap.relativePath, snap.content)
                await window.klartext.clearRecoverySnapshot(snap.rootId, snap.relativePath)
                setRecoverySnapshots((prev) => prev.slice(1))
                const key = `${snap.rootId}::${snap.relativePath}`
                setTabs((prev) => {
                  const found = prev.find((t) => t.key === key)
                  if (found) {
                    return prev.map((t) =>
                      t.key === key
                        ? { ...t, content: snap.content, savedContent: snap.content, dirty: false }
                        : t
                    )
                  }
                  const r = roots.find((x) => x.id === snap.rootId)
                  return [
                    ...prev,
                    {
                      key,
                      rootId: snap.rootId,
                      rootName: r?.name || snap.rootId,
                      relativePath: snap.relativePath,
                      content: snap.content,
                      savedContent: snap.content,
                      dirty: false
                    }
                  ]
                })
                setActiveTabKey(key)
              }}
              className="px-2.5 py-0.5 rounded bg-accent text-white font-medium"
            >
              Restore Buffer
            </button>
            <button
              type="button"
              onClick={async () => {
                const snap = recoverySnapshots[0]
                await window.klartext.clearRecoverySnapshot(snap.rootId, snap.relativePath)
                setRecoverySnapshots((prev) => prev.slice(1))
              }}
              className="px-2 py-0.5 rounded bg-panel border border-subtle text-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Export Notification Banner */}
      {exportStatusBanner && (
        <div
          data-testid="export-status-banner"
          className="px-4 py-1.5 bg-secondary border-b border-subtle flex items-center justify-between text-xs text-success"
        >
          <span>{exportStatusBanner}</span>
          <button
            type="button"
            onClick={() => setExportStatusBanner(null)}
            className="text-muted hover:text-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Area: Resizable Collapsible Left Sidebar + Editor Canvas + Resizable Right Frontmatter / Templates / AI Panel */}
      <div className="flex-1 flex overflow-hidden">
        {!settings.zenMode && settings.leftSidebarOpen && (
          <>
            <div
              style={{ width: `${leftSidebarWidth}px` }}
              className="h-full shrink-0"
            >
              <MultiRootSidebar
                activeTab={leftSidebarTab}
                onSelectTab={handleSelectLeftSidebarTab}
                onCollapseSidebar={() => handleUpdateSettings({ leftSidebarOpen: false })}
                sidebarControlBarVisible={settings.sidebarControlBarVisible !== false}
                editMode={editMode}
                onChangeEditMode={handleChangeEditMode}
                onOpenCommandPalette={() => setPaletteMode('commands')}
                onOpenQuickSwitcher={() => setPaletteMode('files')}
                showOutlineTab={settings.showOutlineTab !== false}
                roots={roots}
                treesByRoot={treesByRoot}
                gitStatuses={gitStatuses}
                activeDoc={
                  activeTab
                    ? { rootId: activeTab.rootId, relativePath: activeTab.relativePath }
                    : null
                }
                selectedFolder={selectedFolder}
                onSelectFolder={(folder) => {
                  setSelectedFolder(folder)
                  handleUpdateSettings({ selectedFolder: folder })
                }}
                collapsedRoots={settings.collapsedRoots || {}}
                collapsedDirs={settings.collapsedDirs || {}}
                onUpdateCollapsedRoots={(next) =>
                  handleUpdateSettings({ collapsedRoots: next })
                }
                onUpdateCollapsedDirs={(next) =>
                  handleUpdateSettings({ collapsedDirs: next })
                }
                workspaceSortOrder={settings.workspaceSortOrder || 'name-asc'}
                workspaceFoldersOnTop={settings.workspaceFoldersOnTop !== false}
                workspaceCustomOrder={settings.workspaceCustomOrder || {}}
                workspaceOrder={settings.workspaceOrder || []}
                stickyItems={settings.stickyItems || {}}
                onUpdateWorkspaceSortOrder={(next) =>
                  handleUpdateSettings({ workspaceSortOrder: next })
                }
                onUpdateWorkspaceFoldersOnTop={(next) =>
                  handleUpdateSettings({ workspaceFoldersOnTop: next })
                }
                onUpdateWorkspaceCustomOrder={(next, switchToCustom) =>
                  handleUpdateSettings(
                    switchToCustom
                      ? { workspaceCustomOrder: next, workspaceSortOrder: 'custom' }
                      : { workspaceCustomOrder: next }
                  )
                }
                onUpdateWorkspaceOrder={(next) =>
                  handleUpdateSettings({ workspaceOrder: next })
                }
                onUpdateStickyItems={(next) =>
                  handleUpdateSettings({ stickyItems: next })
                }
                folderIcons={settings.folderIcons || {}}
                folderColors={settings.folderColors || {}}
                onUpdateFolderIcon={(folderKey, iconName) => {
                  const next = { ...(settings.folderIcons || {}) }
                  if (!iconName) delete next[folderKey]
                  else next[folderKey] = iconName
                  handleUpdateSettings({ folderIcons: next })
                }}
                onUpdateFolderColor={(folderKey, colorValue) => {
                  const next = { ...(settings.folderColors || {}) }
                  if (!colorValue) delete next[folderKey]
                  else next[folderKey] = colorValue
                  handleUpdateSettings({ folderColors: next })
                }}
                availableTemplates={allAvailableTemplates}
                onCreateNoteFromTemplateInFolder={createNoteFromTemplateInFolder}
                headings={headings}
                globalTasks={globalTasks}
                onToggleGlobalTask={handleToggleGlobalTask}
                onOpenDailyNote={handleOpenDailyNote}
                onOpenDocument={openDocument}
                onNavigateToLine={navigateToLine}
                onAddRootDialog={async () => {
                  await window.klartext.openFolderDialog()
                  await refreshWorkspaceAndTrees()
                }}
                onAddRootByPath={async (folderPath, name) => {
                  await window.klartext.addRoot({ path: folderPath, name })
                  await refreshWorkspaceAndTrees()
                }}
                onRemoveRoot={async (rootId) => {
                  await window.klartext.removeRoot(rootId)
                  setTabs((prev) => {
                    const remaining = prev.filter((t) => t.rootId !== rootId)
                    if (activeTabKey && activeTabKey.startsWith(`${rootId}::`)) {
                      setActiveTabKey(remaining[0]?.key || null)
                    }
                    return remaining
                  })
                  await refreshWorkspaceAndTrees()
                }}
                onCreateFileInRoot={async (rootId, relativePath) => {
                  const baseTitle = (relativePath.split('/').pop() || relativePath).replace(
                    /\.(md|markdown|mdx)$/i,
                    ''
                  )
                  const initialContent = await buildNewDocumentContentWithDefaultFrontmatter(
                    rootId,
                    relativePath,
                    baseTitle
                  )
                  await window.klartext.createDocument(rootId, relativePath, initialContent)
                  await refreshWorkspaceAndTrees()
                  await openDocument(rootId, relativePath)
                }}
                onCreateFolderInRoot={async (rootId, relativePath) => {
                  await window.klartext.createDirectory(rootId, relativePath)
                  await refreshWorkspaceAndTrees()
                }}
                onDeleteFileInRoot={async (rootId, relativePath) => {
                  await window.klartext.deleteDocument(rootId, relativePath)
                  const closedKey = `${rootId}::${relativePath}`
                  const folderPrefix = `${rootId}::${relativePath}/`
                  setTabs((prev) => {
                    const remaining = prev.filter(
                      (t) => t.key !== closedKey && !t.key.startsWith(folderPrefix)
                    )
                    if (
                      activeTabKey === closedKey ||
                      (activeTabKey && activeTabKey.startsWith(folderPrefix))
                    ) {
                      setActiveTabKey(remaining[0]?.key || null)
                    }
                    return remaining
                  })
                  if (
                    selectedFolder &&
                    selectedFolder.rootId === rootId &&
                    (selectedFolder.relativePath === relativePath ||
                      selectedFolder.relativePath.startsWith(`${relativePath}/`))
                  ) {
                    setSelectedFolder(null)
                    handleUpdateSettings({ selectedFolder: null })
                  }
                  await refreshWorkspaceAndTrees()
                }}
                onRenameFileInRoot={async (rootId, oldRelativePath, newRelativePath) => {
                  await window.klartext.renameDocument(rootId, oldRelativePath, newRelativePath)

                  // If the renamed file is a Markdown document and its headline is still Untitled, update the headline (and frontmatter title if Untitled) to the new file name without extension
                  const oldKey = `${rootId}::${oldRelativePath}`
                  const newKey = `${rootId}::${newRelativePath}`
                  let updatedRenamedDocContent: string | undefined
                  if (
                    oldRelativePath !== newRelativePath &&
                    /\.(md|markdown|mdx)$/i.test(newRelativePath)
                  ) {
                    const newBaseTitle = (
                      newRelativePath.split('/').pop() || newRelativePath
                    ).replace(/\.(md|markdown|mdx)$/i, '')
                    const openRenamedTab =
                      tabs.find((t) => t.key === oldKey) ||
                      secondaryTabs.find((t) => t.key === oldKey)
                    let currentDocContent = openRenamedTab?.content
                    if (currentDocContent === undefined) {
                      try {
                        const diskDoc = await window.klartext.readDocument(rootId, newRelativePath)
                        currentDocContent = diskDoc.content
                      } catch {
                        // Ignore read failure
                      }
                    }
                    if (typeof currentDocContent === 'string') {
                      const { frontmatter, body } = extractFrontmatter(currentDocContent)
                      let nextDocContent = currentDocContent
                      const untitledHeadingRegex = /^#\s+Untitled(?:-\d+)?\s*$/im
                      if (untitledHeadingRegex.test(body)) {
                        const updatedBody = body.replace(
                          untitledHeadingRegex,
                          `# ${newBaseTitle}`
                        )
                        if (frontmatter) {
                          const nextFm = { ...frontmatter }
                          if (
                            typeof nextFm.title === 'string' &&
                            /^Untitled(?:-\d+)?$/i.test(nextFm.title.trim())
                          ) {
                            nextFm.title = newBaseTitle
                          }
                          nextDocContent = updateFrontmatterInMarkdown(updatedBody, nextFm)
                        } else {
                          nextDocContent = updatedBody
                        }
                      } else if (
                        frontmatter &&
                        typeof frontmatter.title === 'string' &&
                        /^Untitled(?:-\d+)?$/i.test(frontmatter.title.trim())
                      ) {
                        nextDocContent = updateFrontmatterInMarkdown(currentDocContent, {
                          ...frontmatter,
                          title: newBaseTitle
                        })
                      }
                      if (nextDocContent !== currentDocContent) {
                        updatedRenamedDocContent = nextDocContent
                        await window.klartext
                          .writeDocument(rootId, newRelativePath, nextDocContent)
                          .catch(() => {})
                      }
                    }
                  }

                  // Automatically refactor [[WikiLinks]] and ![[Transclusions]] across workspace documents
                  if (
                    oldRelativePath !== newRelativePath &&
                    /\.(md|markdown|mdx)$/i.test(oldRelativePath)
                  ) {
                    for (const doc of workspaceMarkdownDocs) {
                      const isRenamedDoc =
                        doc.rootId === rootId && doc.relativePath === oldRelativePath
                      const targetRel = isRenamedDoc ? newRelativePath : doc.relativePath
                      const openTab =
                        tabs.find((t) => t.rootId === doc.rootId && t.relativePath === doc.relativePath) ||
                        secondaryTabs.find(
                          (t) => t.rootId === doc.rootId && t.relativePath === doc.relativePath
                        )
                      const sourceContent =
                        isRenamedDoc && updatedRenamedDocContent !== undefined
                          ? updatedRenamedDocContent
                          : openTab
                            ? openTab.content
                            : doc.content
                      const refactored = refactorWikiLinksOnRename(
                        sourceContent,
                        oldRelativePath,
                        newRelativePath
                      )
                      if (refactored.changed) {
                        if (isRenamedDoc) {
                          updatedRenamedDocContent = refactored.nextContent
                        }
                        await window.klartext
                          .writeDocument(doc.rootId, targetRel, refactored.nextContent)
                          .catch(() => {})
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.rootId === doc.rootId &&
                            (t.relativePath === doc.relativePath || t.relativePath === targetRel)
                              ? {
                                  ...t,
                                  content: refactored.nextContent,
                                  savedContent: refactored.nextContent
                                }
                              : t
                          )
                        )
                        setSecondaryTabs((prev) =>
                          prev.map((t) =>
                            t.rootId === doc.rootId &&
                            (t.relativePath === doc.relativePath || t.relativePath === targetRel)
                              ? {
                                  ...t,
                                  content: refactored.nextContent,
                                  savedContent: refactored.nextContent
                                }
                              : t
                          )
                        )
                      }
                    }
                  }

                  await refreshWorkspaceAndTrees()
                  const oldFolderKey = `${rootId}/${oldRelativePath}`
                  const newFolderKey = `${rootId}/${newRelativePath}`
                  const oldFolderPrefix = `${oldRelativePath}/`

                  // Migrate folder icons, colors, collapsed state, sticky items & custom sort order
                  const currentIcons = settings.folderIcons || {}
                  const currentColors = settings.folderColors || {}
                  const currentCollapsedDirs = settings.collapsedDirs || {}
                  const currentStickyItems = settings.stickyItems || {}
                  const currentCustomOrder = settings.workspaceCustomOrder || {}
                  const nextIcons = { ...currentIcons }
                  const nextColors = { ...currentColors }
                  const nextCollapsedDirs = { ...currentCollapsedDirs }
                  const nextStickyItems = { ...currentStickyItems }
                  const nextCustomOrder: Record<string, string[]> = { ...currentCustomOrder }

                  for (const k of Object.keys(currentIcons)) {
                    if (k === oldKey || k === oldFolderKey) {
                      nextIcons[newFolderKey] = nextIcons[k]
                      delete nextIcons[k]
                    } else if (k.startsWith(`${oldFolderKey}/`)) {
                      const updated = `${newFolderKey}/${k.slice(oldFolderKey.length + 1)}`
                      nextIcons[updated] = nextIcons[k]
                      delete nextIcons[k]
                    }
                  }
                  for (const k of Object.keys(currentColors)) {
                    if (k === oldKey || k === oldFolderKey) {
                      nextColors[newFolderKey] = nextColors[k]
                      delete nextColors[k]
                    } else if (k.startsWith(`${oldFolderKey}/`)) {
                      const updated = `${newFolderKey}/${k.slice(oldFolderKey.length + 1)}`
                      nextColors[updated] = nextColors[k]
                      delete nextColors[k]
                    }
                  }
                  for (const k of Object.keys(currentCollapsedDirs)) {
                    if (k === oldKey || k === oldFolderKey) {
                      nextCollapsedDirs[newFolderKey] = nextCollapsedDirs[k]
                      delete nextCollapsedDirs[k]
                    } else if (k.startsWith(`${oldFolderKey}/`)) {
                      const updated = `${newFolderKey}/${k.slice(oldFolderKey.length + 1)}`
                      nextCollapsedDirs[updated] = nextCollapsedDirs[k]
                      delete nextCollapsedDirs[k]
                    }
                  }
                  for (const k of Object.keys(currentStickyItems)) {
                    if (k === oldKey || k === oldFolderKey) {
                      nextStickyItems[newFolderKey] = nextStickyItems[k]
                      delete nextStickyItems[k]
                    } else if (k.startsWith(`${oldFolderKey}/`)) {
                      const updated = `${newFolderKey}/${k.slice(oldFolderKey.length + 1)}`
                      nextStickyItems[updated] = nextStickyItems[k]
                      delete nextStickyItems[k]
                    }
                  }
                  for (const dirOrderKey of Object.keys(currentCustomOrder)) {
                    const list = currentCustomOrder[dirOrderKey] || []
                    const updatedList = list.map((item) => {
                      if (item === oldRelativePath) return newRelativePath
                      if (item.startsWith(oldFolderPrefix)) {
                        return `${newRelativePath}/${item.slice(oldFolderPrefix.length)}`
                      }
                      return item
                    })
                    if (dirOrderKey === oldFolderKey) {
                      nextCustomOrder[newFolderKey] = updatedList
                      delete nextCustomOrder[dirOrderKey]
                    } else if (dirOrderKey.startsWith(`${oldFolderKey}/`)) {
                      const updatedDirKey = `${newFolderKey}/${dirOrderKey.slice(oldFolderKey.length + 1)}`
                      nextCustomOrder[updatedDirKey] = updatedList
                      delete nextCustomOrder[dirOrderKey]
                    } else {
                      nextCustomOrder[dirOrderKey] = updatedList
                    }
                  }

                  let updatedSelectedFolder = selectedFolder
                  if (
                    selectedFolder &&
                    selectedFolder.rootId === rootId &&
                    (selectedFolder.relativePath === oldRelativePath ||
                      selectedFolder.relativePath.startsWith(oldFolderPrefix))
                  ) {
                    const nextRel =
                      selectedFolder.relativePath === oldRelativePath
                        ? newRelativePath
                        : `${newRelativePath}/${selectedFolder.relativePath.slice(oldFolderPrefix.length)}`
                    updatedSelectedFolder = { rootId, relativePath: nextRel }
                    setSelectedFolder(updatedSelectedFolder)
                  }

                  handleUpdateSettings({
                    folderIcons: nextIcons,
                    folderColors: nextColors,
                    collapsedDirs: nextCollapsedDirs,
                    stickyItems: nextStickyItems,
                    workspaceCustomOrder: nextCustomOrder,
                    workspaceSortOrder: 'custom',
                    selectedFolder: updatedSelectedFolder
                  })

                  const applyTabRename = (prev: OpenDocumentTab[]) =>
                    prev.map((t) => {
                      if (t.key === oldKey) {
                        return {
                          ...t,
                          key: newKey,
                          relativePath: newRelativePath,
                          ...(updatedRenamedDocContent !== undefined
                            ? {
                                content: updatedRenamedDocContent,
                                savedContent: updatedRenamedDocContent,
                                dirty: false
                              }
                            : {})
                        }
                      }
                      if (t.rootId === rootId && t.relativePath.startsWith(oldFolderPrefix)) {
                        const updatedRel = `${newRelativePath}/${t.relativePath.slice(oldFolderPrefix.length)}`
                        return {
                          ...t,
                          key: `${rootId}::${updatedRel}`,
                          relativePath: updatedRel
                        }
                      }
                      return t
                    })
                  setTabs(applyTabRename)
                  setSecondaryTabs(applyTabRename)
                  if (activeTabKey === oldKey) {
                    setActiveTabKey(newKey)
                  } else if (/\.(md|markdown|svg)$/i.test(newRelativePath)) {
                    await openDocument(rootId, newRelativePath)
                  }
                }}
                onMoveFileCrossRoot={handleInitiateCrossRootMove}
                onSyncAllRepos={async () => {
                  await window.klartext.gitSyncAll()
                  await refreshWorkspaceAndTrees()
                }}
                onRefreshGit={refreshWorkspaceAndTrees}
                onCommitRepo={async (rootId, message) => {
                  await window.klartext.gitStage(rootId, ['.'])
                  await window.klartext.gitCommit(rootId, message)
                  await refreshWorkspaceAndTrees()
                }}
                onResolveConflictFromGitPanel={(rootId, relPath, resolution) =>
                  handleResolveConflict(rootId, relPath, resolution)
                }
                onAbortMergeRepo={async (rootId) => {
                  await window.klartext.gitAbortMerge(rootId)
                  await refreshWorkspaceAndTrees()
                }}
                dynamicWorkspaces={settings.dynamicWorkspaces || []}
                dynamicCandidateDocuments={dynamicCandidateDocuments}
                onOpenAddDynamicFolder={(workspace) =>
                  setDynamicWizardState({
                    open: true,
                    targetWorkspace: workspace,
                    editingFolder: null,
                    editingRootRules: false
                  })
                }
                onOpenEditDynamicFolder={(workspace, folder) =>
                  setDynamicWizardState({
                    open: true,
                    targetWorkspace: workspace,
                    editingFolder: folder,
                    editingRootRules: false
                  })
                }
                onOpenEditDynamicRootRules={(workspace) =>
                  setDynamicWizardState({
                    open: true,
                    targetWorkspace: workspace,
                    editingFolder: null,
                    editingRootRules: true
                  })
                }
                onDeleteDynamicFolder={(workspaceId, folderId) => {
                  const currentList = settings.dynamicWorkspaces || []
                  const nextList = currentList.map((ws) =>
                    ws.id === workspaceId
                      ? { ...ws, folders: ws.folders.filter((f) => f.id !== folderId) }
                      : ws
                  )
                  handleUpdateSettings({ dynamicWorkspaces: nextList })
                }}
                onRemoveDynamicWorkspace={(workspaceId) => {
                  const currentList = settings.dynamicWorkspaces || []
                  handleUpdateSettings({
                    dynamicWorkspaces: currentList.filter((ws) => ws.id !== workspaceId)
                  })
                }}
              />
            </div>
            <div
              data-testid="left-sidebar-resizer"
              title="Drag to resize Left Sidebar"
              onMouseDown={(e) => {
                e.preventDefault()
                activeSidebarDragRef.current = 'left'
              }}
              className="w-1 h-full cursor-col-resize bg-transparent hover:bg-accent transition-colors shrink-0 z-20"
            />
          </>
        )}

        {/* Center Document Tabs + Dual Side-by-Side Editor Windows */}
        <main
          ref={editorMainContainerRef}
          data-testid="editor-main-container"
          className="flex-1 flex flex-row h-full overflow-hidden bg-panel min-w-0"
        >
          {/* Primary (Left) Editor Window */}
          <div
            data-testid="editor-pane-primary"
            style={
              secondaryTabs.length > 0
                ? { width: `${editorWindowsSplitPercent}%` }
                : undefined
            }
            onMouseDown={() => {
              if (focusedEditorPane !== 'primary') {
                setFocusedEditorPane('primary')
              }
            }}
            onDragOver={(e) => {
              if (draggedDocTab) {
                e.preventDefault()
                if (dragOverPane !== 'primary') setDragOverPane('primary')
              }
            }}
            onDrop={(e) => {
              if (!draggedDocTab) return
              e.preventDefault()
              moveTabToPane(draggedDocTab.fromPane, 'primary', draggedDocTab.tab)
              setDraggedDocTab(null)
              setDragOverPane(null)
            }}
            className={`${
              secondaryTabs.length > 0 ? 'shrink-0' : 'flex-1'
            } flex flex-col h-full overflow-hidden bg-panel min-w-0 ${
              dragOverPane === 'primary' && draggedDocTab?.fromPane === 'secondary'
                ? 'ring-2 ring-inset ring-accent/60'
                : ''
            }`}
          >
            {/* Primary Document Tab Bar */}
            {!settings.zenMode &&
              (settings.pageTabsPosition !== 'top-menu' || secondaryTabs.length > 0) &&
              tabs.length > 0 && (
                <div
                  data-testid="document-tab-bar"
                  className="flex items-center bg-app border-b border-subtle px-1.5 pt-1 gap-1 text-xs shrink-0 whitespace-nowrap titlebar-drag-region"
                >
                  {tabBarHasOverflow && (
                    <button
                      type="button"
                      data-tooltip="Scroll Tabs Left"
                      data-testid="tab-bar-scroll-left"
                      onClick={() => {
                        tabBarScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })
                      }}
                      className="p-1 rounded bg-panel border border-subtle text-muted hover:text-primary hover:border-accent shrink-0 mb-1 titlebar-no-drag"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div
                    ref={tabBarScrollRef}
                    onScroll={updateTabBarOverflow}
                    className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 max-w-full titlebar-no-drag"
                  >
                    {tabs.map((tab) => {
                      const isCurrent = tab.key === primaryActiveTab?.key
                      const fileNameOnly = tab.relativePath.split('/').pop() || tab.relativePath
                      return (
                        <div
                          key={tab.key}
                          draggable
                          onDragStart={(e) => {
                            setDraggedDocTab({ fromPane: 'primary', tab })
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData(
                              'application/x-klartext-doc-tab',
                              JSON.stringify({ fromPane: 'primary', key: tab.key })
                            )
                          }}
                          onDragEnd={() => {
                            setDraggedDocTab(null)
                            setDragOverPane(null)
                          }}
                          onDragOver={(e) => {
                            if (draggedDocTab) {
                              e.preventDefault()
                              e.stopPropagation()
                              setDragOverPane('primary')
                            }
                          }}
                          onDrop={(e) => {
                            if (!draggedDocTab) return
                            e.preventDefault()
                            e.stopPropagation()
                            moveTabToPane(
                              draggedDocTab.fromPane,
                              'primary',
                              draggedDocTab.tab,
                              tab.key
                            )
                            setDraggedDocTab(null)
                            setDragOverPane(null)
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setTabContextMenu({
                              pane: 'primary',
                              tab,
                              x: e.clientX,
                              y: e.clientY
                            })
                          }}
                          title={`${tab.rootName} — ${tab.relativePath} (Right-click for Split / Duplicate / Options)`}
                          data-testid={`doc-tab-${tab.rootId}-${tab.relativePath}`}
                          onClick={() => {
                            setActiveTabKey(tab.key)
                            setFocusedEditorPane('primary')
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md border-t border-x cursor-pointer shrink-0 max-w-[180px] titlebar-no-drag ${
                            isCurrent
                              ? 'bg-panel border-subtle text-primary font-medium'
                              : 'bg-secondary/50 border-transparent text-muted hover:text-primary'
                          }`}
                        >
                          <span className="truncate whitespace-nowrap block max-w-[140px]">
                            {fileNameOnly}
                            {tab.dirty ? ' •' : ''}
                          </span>
                          {(tabs.length > 1 || secondaryTabs.length > 0) && (
                            <button
                              type="button"
                              data-testid={`close-tab-${tab.rootId}-${tab.relativePath}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                closeTabInPane('primary', tab.key)
                              }}
                              className="text-muted hover:text-danger shrink-0 titlebar-no-drag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {tabBarHasOverflow && (
                    <button
                      type="button"
                      data-tooltip="Scroll Tabs Right"
                      data-testid="tab-bar-scroll-right"
                      onClick={() => {
                        tabBarScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })
                      }}
                      className="p-1 rounded bg-panel border border-subtle text-muted hover:text-primary hover:border-accent shrink-0 mb-1 titlebar-no-drag"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Draggable empty space to the right of the last page tab so dragging moves the app window */}
                  <div
                    data-testid="tab-bar-drag-spacer"
                    className="flex-1 self-stretch min-w-[16px] titlebar-drag-region"
                  />
                </div>
              )}

            {primaryActiveTab ? (
              <MarkdownEditorWorkspace
                rootId={primaryActiveTab.rootId}
                relativePath={primaryActiveTab.relativePath}
                content={primaryActiveTab.content}
                editMode={editMode}
                theme={resolvedTheme}
                floatingToolbarEnabled={settings.floatingToolbarEnabled}
                formattingToolbarVisible={Boolean(settings.formattingToolbarVisible)}
                aiEnabled={settings.ai.enabled}
                aiModelConfigured={aiModelConfigured}
                showLineNumbers={Boolean(settings.showLineNumbers)}
                wordWrap={settings.wordWrap !== false}
                marginMode={settings.editorMarginMode || 'medium'}
                focusMode={Boolean(settings.focusMode)}
                workspaceDocuments={workspaceDocEntries}
                spellcheckEnabled={settings.spellcheckEnabled !== false}
                spellcheckLanguages={currentSpellLangs}
                customDictionaryWords={settings.customDictionaryWords || []}
                scrollToLine={focusedEditorPane === 'primary' ? scrollToLine : null}
                editorCommandTrigger={
                  focusedEditorPane === 'primary' ? editorCommandTrigger : null
                }
                textInsertTrigger={
                  focusedEditorPane === 'primary' ? textInsertTrigger : null
                }
                initialSplitPercent={settings.splitViewPercent ?? 50}
                onChangeSplitPercent={(percent) =>
                  handleUpdateSettings({ splitViewPercent: percent })
                }
                onChangeContent={(nextContent) =>
                  handleEditorContentChangeForTab(primaryActiveTab, nextContent)
                }
                onPasteOrDropAsset={handlePasteOrDropAsset}
                onOpenExcalidrawModal={(drawingRelPath) =>
                  setExcalidrawTarget({
                    rootId: primaryActiveTab.rootId,
                    relativePath: drawingRelPath
                  })
                }
                onTriggerAIQuickAction={(action, arg) => {
                  if (action === 'open-custom-dialog') {
                    openAICustomInstructionDialog(arg)
                  } else if (action === 'draft') {
                    handleTriggerAIAction(action, arg)
                  } else {
                    handleTriggerAIAction(action, '', undefined, arg)
                  }
                }}
                onResolveConflictHunk={(hunkIndex, resolution) =>
                  handleResolveConflict(
                    primaryActiveTab.rootId,
                    primaryActiveTab.relativePath,
                    resolution,
                    hunkIndex
                  )
                }
                onNavigateLink={async (target, isWiki) => {
                  if (target.startsWith('http://') || target.startsWith('https://')) {
                    await window.klartext.openExternalUrl(target)
                    return
                  }
                  const [filePart, hashPart] = target.split('#')
                  if (filePart) {
                    const clean =
                      isWiki && !filePart.includes('.')
                        ? `${filePart}.md`
                        : filePart.replace(/^\.\//, '')
                    const foundInAll =
                      allWorkspaceFiles.find(
                        (f) =>
                          f.rootId === primaryActiveTab.rootId &&
                          (f.relativePath === clean ||
                            f.relativePath.toLowerCase() === `${clean.toLowerCase()}.md`)
                      ) ||
                      allWorkspaceFiles.find(
                        (f) =>
                          f.relativePath === clean ||
                          f.relativePath.toLowerCase() === `${clean.toLowerCase()}.md`
                      )
                    const targetRoot = foundInAll?.rootId || primaryActiveTab.rootId
                    const targetRel =
                      foundInAll?.relativePath ||
                      (clean.endsWith('.md') ? clean : `${clean}.md`)
                    await openDocument(targetRoot, targetRel)
                  }
                  if (hashPart) {
                    setScrollToLine({ line: 1, nonce: Date.now() })
                  }
                }}
                onToggleSpellcheck={(enabled) =>
                  handleUpdateSettings({ spellcheckEnabled: enabled })
                }
                onChangeSpellcheckLanguage={(lang) => {
                  const exists = currentSpellLangs.includes(lang)
                  const next = exists ? currentSpellLangs : [...currentSpellLangs, lang]
                  handleUpdateSettings({ spellcheckLanguages: next })
                }}
                onAddWordToDictionary={(word) => {
                  const existing = settings.customDictionaryWords || []
                  if (!existing.includes(word)) {
                    handleUpdateSettings({
                      customDictionaryWords: [...existing, word]
                    })
                  }
                }}
                onOpenIconPicker={() => setPaletteMode('icons')}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted text-sm">
                Select or create a Markdown document in any root folder.
              </div>
            )}
          </div>

          {/* Secondary (Right) Side-by-Side Editor Window */}
          {secondaryTabs.length > 0 && (
            <>
              <div
                data-testid="editor-windows-resizer"
                title="Drag to resize side-by-side editor windows"
                onMouseDown={(e) => {
                  e.preventDefault()
                  activeSidebarDragRef.current = 'editor-windows'
                }}
                className="w-1 h-full cursor-col-resize bg-subtle hover:bg-accent transition-colors shrink-0 z-20"
              />

              <div
                data-testid="editor-pane-secondary"
                onMouseDown={() => {
                  if (focusedEditorPane !== 'secondary') {
                    setFocusedEditorPane('secondary')
                  }
                }}
                onDragOver={(e) => {
                  if (draggedDocTab) {
                    e.preventDefault()
                    if (dragOverPane !== 'secondary') setDragOverPane('secondary')
                  }
                }}
                onDrop={(e) => {
                  if (!draggedDocTab) return
                  e.preventDefault()
                  moveTabToPane(draggedDocTab.fromPane, 'secondary', draggedDocTab.tab)
                  setDraggedDocTab(null)
                  setDragOverPane(null)
                }}
                className={`flex-1 flex flex-col h-full overflow-hidden bg-panel min-w-0 border-l border-subtle ${
                  dragOverPane === 'secondary' && draggedDocTab?.fromPane === 'primary'
                    ? 'ring-2 ring-inset ring-accent/60'
                    : ''
                }`}
              >
                {/* Secondary Window Tab Bar */}
                {!settings.zenMode && (
                  <div
                    data-testid="secondary-document-tab-bar"
                    className="flex items-center bg-app border-b border-subtle px-1.5 pt-1 gap-1 text-xs shrink-0 whitespace-nowrap titlebar-drag-region"
                  >
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 max-w-full titlebar-no-drag">
                      {secondaryTabs.map((tab) => {
                        const isCurrent = tab.key === secondaryActiveTab?.key
                        const fileNameOnly =
                          tab.relativePath.split('/').pop() || tab.relativePath
                        return (
                          <div
                            key={tab.key}
                            draggable
                            onDragStart={(e) => {
                              setDraggedDocTab({ fromPane: 'secondary', tab })
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData(
                                'application/x-klartext-doc-tab',
                                JSON.stringify({ fromPane: 'secondary', key: tab.key })
                              )
                            }}
                            onDragEnd={() => {
                              setDraggedDocTab(null)
                              setDragOverPane(null)
                            }}
                            onDragOver={(e) => {
                              if (draggedDocTab) {
                                e.preventDefault()
                                e.stopPropagation()
                                setDragOverPane('secondary')
                              }
                            }}
                            onDrop={(e) => {
                              if (!draggedDocTab) return
                              e.preventDefault()
                              e.stopPropagation()
                              moveTabToPane(
                                draggedDocTab.fromPane,
                                'secondary',
                                draggedDocTab.tab,
                                tab.key
                              )
                              setDraggedDocTab(null)
                              setDragOverPane(null)
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setTabContextMenu({
                                pane: 'secondary',
                                tab,
                                x: e.clientX,
                                y: e.clientY
                              })
                            }}
                            title={`${tab.rootName} — ${tab.relativePath}`}
                            data-testid={`secondary-doc-tab-${tab.rootId}-${tab.relativePath}`}
                            onClick={() => {
                              setSecondaryActiveTabKey(tab.key)
                              setFocusedEditorPane('secondary')
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md border-t border-x cursor-pointer shrink-0 max-w-[180px] titlebar-no-drag ${
                              isCurrent
                                ? 'bg-panel border-subtle text-primary font-medium'
                                : 'bg-secondary/50 border-transparent text-muted hover:text-primary'
                            }`}
                          >
                            <span className="truncate whitespace-nowrap block max-w-[140px]">
                              {fileNameOnly}
                              {tab.dirty ? ' •' : ''}
                            </span>
                            <button
                              type="button"
                              data-testid={`close-secondary-tab-${tab.rootId}-${tab.relativePath}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                closeTabInPane('secondary', tab.key)
                              }}
                              className="text-muted hover:text-danger shrink-0 titlebar-no-drag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex-1 self-stretch min-w-[16px] titlebar-drag-region" />
                  </div>
                )}

                {secondaryActiveTab && (
                  <MarkdownEditorWorkspace
                    rootId={secondaryActiveTab.rootId}
                    relativePath={secondaryActiveTab.relativePath}
                    content={secondaryActiveTab.content}
                    editMode={editMode}
                    theme={resolvedTheme}
                    floatingToolbarEnabled={settings.floatingToolbarEnabled}
                    formattingToolbarVisible={Boolean(settings.formattingToolbarVisible)}
                    aiEnabled={settings.ai.enabled}
                    aiModelConfigured={aiModelConfigured}
                    showLineNumbers={Boolean(settings.showLineNumbers)}
                    wordWrap={settings.wordWrap !== false}
                    marginMode={settings.editorMarginMode || 'medium'}
                    focusMode={Boolean(settings.focusMode)}
                    workspaceDocuments={workspaceDocEntries}
                    spellcheckEnabled={settings.spellcheckEnabled !== false}
                    spellcheckLanguages={currentSpellLangs}
                    customDictionaryWords={settings.customDictionaryWords || []}
                    scrollToLine={focusedEditorPane === 'secondary' ? scrollToLine : null}
                    editorCommandTrigger={
                      focusedEditorPane === 'secondary' ? editorCommandTrigger : null
                    }
                    textInsertTrigger={
                      focusedEditorPane === 'secondary' ? textInsertTrigger : null
                    }
                    initialSplitPercent={settings.splitViewPercent ?? 50}
                    onChangeSplitPercent={(percent) =>
                      handleUpdateSettings({ splitViewPercent: percent })
                    }
                    onChangeContent={(nextContent) =>
                      handleEditorContentChangeForTab(secondaryActiveTab, nextContent)
                    }
                    onPasteOrDropAsset={handlePasteOrDropAsset}
                    onOpenExcalidrawModal={(drawingRelPath) =>
                      setExcalidrawTarget({
                        rootId: secondaryActiveTab.rootId,
                        relativePath: drawingRelPath
                      })
                    }
                    onTriggerAIQuickAction={(action, arg) => {
                      if (action === 'open-custom-dialog') {
                        openAICustomInstructionDialog(arg)
                      } else if (action === 'draft') {
                        handleTriggerAIAction(action, arg)
                      } else {
                        handleTriggerAIAction(action, '', undefined, arg)
                      }
                    }}
                    onResolveConflictHunk={(hunkIndex, resolution) =>
                      handleResolveConflict(
                        secondaryActiveTab.rootId,
                        secondaryActiveTab.relativePath,
                        resolution,
                        hunkIndex
                      )
                    }
                    onNavigateLink={async (target, isWiki) => {
                      if (target.startsWith('http://') || target.startsWith('https://')) {
                        await window.klartext.openExternalUrl(target)
                        return
                      }
                      const [filePart] = target.split('#')
                      if (filePart) {
                        const clean =
                          isWiki && !filePart.includes('.')
                            ? `${filePart}.md`
                            : filePart.replace(/^\.\//, '')
                        const targetRel = clean.endsWith('.md') ? clean : `${clean}.md`
                        await openDocument(secondaryActiveTab.rootId, targetRel)
                      }
                    }}
                    onToggleSpellcheck={(enabled) =>
                      handleUpdateSettings({ spellcheckEnabled: enabled })
                    }
                    onChangeSpellcheckLanguage={(lang) => {
                      const exists = currentSpellLangs.includes(lang)
                      const next = exists ? currentSpellLangs : [...currentSpellLangs, lang]
                      handleUpdateSettings({ spellcheckLanguages: next })
                    }}
                    onAddWordToDictionary={(word) => {
                      const existing = settings.customDictionaryWords || []
                      if (!existing.includes(word)) {
                        handleUpdateSettings({
                          customDictionaryWords: [...existing, word]
                        })
                      }
                    }}
                    onOpenIconPicker={() => setPaletteMode('icons')}
                  />
                )}
              </div>
            </>
          )}
        </main>

        {/* Right-Aligned Resizable Panels (Frontmatter, Templates, Local AI, Daily Notes & Calendar, Global Tasks, Help & Reference) + Bottom Right-Panel Control Strip */}
        {!settings.zenMode &&
          (settings.frontmatterPanelVisible ||
            settings.templatesPanelVisible ||
            settings.rightSidebarOpen ||
            settings.helpPanelVisible ||
            settings.calendarPanelVisible ||
            settings.tasksPanelVisible) && (
            <>
              <div
                data-testid={
                  settings.frontmatterPanelVisible
                    ? 'frontmatter-sidebar-resizer'
                    : settings.templatesPanelVisible
                      ? 'templates-sidebar-resizer'
                      : settings.helpPanelVisible
                        ? 'help-sidebar-resizer'
                        : settings.calendarPanelVisible
                          ? 'calendar-sidebar-resizer'
                          : settings.tasksPanelVisible
                            ? 'tasks-sidebar-resizer'
                            : 'right-sidebar-resizer'
                }
                title="Drag to resize Right Panel"
                onMouseDown={(e) => {
                  e.preventDefault()
                  activeSidebarDragRef.current = settings.frontmatterPanelVisible
                    ? 'frontmatter'
                    : settings.templatesPanelVisible
                      ? 'templates'
                      : settings.helpPanelVisible
                        ? 'help'
                        : settings.calendarPanelVisible
                          ? 'calendar'
                          : settings.tasksPanelVisible
                            ? 'tasks'
                            : 'right'
                }}
                className="w-1 h-full cursor-col-resize bg-transparent hover:bg-accent transition-colors shrink-0 z-20"
              />
              <div
                data-testid="right-panel-container"
                style={{
                  width: `${rightSidebarWidth}px`
                }}
                className="h-full shrink-0 flex flex-col overflow-hidden bg-app"
              >
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* 1. Frontmatter Properties Window */}
                  {settings.frontmatterPanelVisible && (
                    <FrontmatterPropertiesPanel
                      activeTabKey={activeTab?.key || null}
                      frontmatter={parsedFrontmatter.frontmatter}
                      allDocumentContents={[
                        ...tabs.map((t) => t.content),
                        ...secondaryTabs.map((t) => t.content)
                      ]}
                      settings={settings}
                      evaluationContext={templateEvaluationContext}
                      onUpdateSettings={handleUpdateSettings}
                      onUpdateFrontmatterField={updateFrontmatterField}
                      onClose={() => handleUpdateSettings({ frontmatterPanelVisible: false })}
                    />
                  )}

                  {/* 2. Templates Panel (<% %> Dynamic Variables) */}
                  {settings.templatesPanelVisible && !settings.frontmatterPanelVisible && (
                    <TemplatesPanel
                      customTemplates={
                        settings.customTemplates && settings.customTemplates.length > 0
                          ? settings.customTemplates
                          : DEFAULT_BUILT_IN_TEMPLATES
                      }
                      workspaceTemplateFiles={workspaceTemplateFiles}
                      evaluationContext={templateEvaluationContext}
                      onSaveCustomTemplates={(nextTemplates) =>
                        handleUpdateSettings({ customTemplates: nextTemplates })
                      }
                      onOpenTemplateInEditor={openTemplateInEditor}
                      onOpenWorkspaceTemplateInEditor={openDocument}
                      onInsertRenderedTemplate={(renderedText, cursorOffset) => {
                        if (activeTab) {
                          dispatchTextInsert(renderedText, cursorOffset)
                        }
                      }}
                      onCreateNoteFromTemplate={async (templateName, rawTemplateContent) => {
                        const targetRootId =
                          selectedFolder?.rootId || activeTab?.rootId || roots[0]?.id
                        if (!targetRootId) return
                        const folderPrefix =
                          selectedFolder && selectedFolder.rootId === targetRootId
                            ? selectedFolder.relativePath
                            : ''
                        await createNoteFromTemplateInFolder(
                          targetRootId,
                          folderPrefix,
                          templateName,
                          rawTemplateContent
                        )
                      }}
                      onEvaluateActiveDocument={async () => {
                        if (!activeTab) return
                        const res = await evaluateTemplateVariablesAsync(
                          activeTab.content,
                          templateEvaluationContext,
                          (expressions, cwd) =>
                            window.klartext.evaluatePowerTemplate({ expressions, cwd })
                        )
                        handleEditorContentChange(res.content)
                      }}
                      onOpenHelpVariables={() => openRightHelpPanel('variables')}
                      onClose={() => handleUpdateSettings({ templatesPanelVisible: false })}
                    />
                  )}

                  {/* 3. Local AI Assistant & Hardware Advisor Panel */}
                  {settings.rightSidebarOpen &&
                    !settings.frontmatterPanelVisible &&
                    !settings.templatesPanelVisible &&
                    !settings.helpPanelVisible &&
                    !settings.calendarPanelVisible &&
                    !settings.tasksPanelVisible && (
                      <LocalAIPanel
                        settings={settings}
                        roots={roots}
                        activeRootName={activeTab?.rootName || 'None'}
                        activeFilePath={activeTab?.relativePath || 'None'}
                        selectedTextOrDoc={activeTab?.content || ''}
                        pendingDiff={pendingAIDiff}
                        onUpdateSettings={handleUpdateSettings}
                        onStartAIAction={handleTriggerAIAction}
                        onCancelStream={(requestId) => window.klartext.cancelAIStream(requestId)}
                        onAcceptDiff={(proposedText) => {
                          if (
                            activeTab &&
                            pendingAIDiff &&
                            pendingAIDiff.originalText !== activeTab.content &&
                            activeTab.content.includes(pendingAIDiff.originalText)
                          ) {
                            handleEditorContentChange(
                              activeTab.content.replace(
                                pendingAIDiff.originalText,
                                proposedText
                              )
                            )
                          } else {
                            handleEditorContentChange(proposedText)
                          }
                          setPendingAIDiff(null)
                        }}
                        onRejectDiff={() => setPendingAIDiff(null)}
                        onOpenHelpAI={() => openRightHelpPanel('ai')}
                        onOpenCitation={(rootId, relPath) => openDocument(rootId, relPath)}
                        onOpenCustomInstructionDialog={() => openAICustomInstructionDialog()}
                        onConnectionStatusChange={(ok, modelsCount) =>
                          setAiServerConnected(Boolean(ok && modelsCount > 0))
                        }
                      />
                    )}

                  {/* 4. Right-Side Daily Notes & Calendar Panel */}
                  {settings.calendarPanelVisible &&
                    !settings.frontmatterPanelVisible &&
                    !settings.templatesPanelVisible &&
                    !settings.rightSidebarOpen &&
                    !settings.helpPanelVisible &&
                    !settings.tasksPanelVisible && (
                      <DailyNotesCalendarPanel
                        dynamicCandidateDocuments={dynamicCandidateDocuments}
                        onOpenDailyNote={(dateYmd) => {
                          void handleOpenDailyNote(dateYmd)
                        }}
                        onOpenDocument={(rootId, relPath) => {
                          void openDocument(rootId, relPath)
                        }}
                        onClose={() => handleUpdateSettings({ calendarPanelVisible: false })}
                      />
                    )}

                  {/* 5. Right-Side Global Tasks Panel */}
                  {settings.tasksPanelVisible &&
                    !settings.frontmatterPanelVisible &&
                    !settings.templatesPanelVisible &&
                    !settings.rightSidebarOpen &&
                    !settings.helpPanelVisible &&
                    !settings.calendarPanelVisible && (
                      <GlobalTasksRightPanel
                        globalTasks={globalTasks}
                        onToggleGlobalTask={(task) => {
                          void handleToggleGlobalTask(task)
                        }}
                        onNavigateToLine={(rootId, relPath, lineNumber) => {
                          void navigateToLine(rootId, relPath, lineNumber)
                        }}
                        onClose={() => handleUpdateSettings({ tasksPanelVisible: false })}
                      />
                    )}

                  {/* 6. Right-Side Help & Reference Panel (Formatting, Dynamic Variables <% %>, Shortcuts) */}
                  {settings.helpPanelVisible &&
                    !settings.frontmatterPanelVisible &&
                    !settings.templatesPanelVisible &&
                    !settings.calendarPanelVisible &&
                    !settings.tasksPanelVisible && (
                      <HelpModal
                        initialTab={helpModalTab}
                        evaluationContext={templateEvaluationContext}
                        onInsertVariableTag={(tag) => {
                          if (activeTab) {
                            dispatchTextInsert(tag, null)
                          }
                        }}
                        onClose={() => handleUpdateSettings({ helpPanelVisible: false })}
                      />
                    )}
                </div>

                {/* Bottom Right-Window Control Strip (Matching the bottom bar of the left panel, with icons equal to all available right panel windows) */}
                {settings.sidebarControlBarVisible !== false && (
                  <div
                    data-testid="right-sidebar-bottom-controls"
                    className="px-1.5 py-1.5 bg-panel border-t border-l border-subtle flex items-center justify-between gap-1 shrink-0 select-none"
                  >
                    <div
                      className="flex items-center bg-secondary p-0.5 rounded border border-subtle gap-0.5"
                      data-testid="right-panel-tab-switcher"
                    >
                      <button
                        type="button"
                        data-tooltip="Frontmatter Properties"
                        data-tooltip-pos="top"
                        aria-label="Frontmatter Properties"
                        data-testid="right-panel-tab-frontmatter"
                        onClick={() =>
                          handleUpdateSettings({ frontmatterPanelVisible: true })
                        }
                        className={`p-1 rounded transition-colors ${
                          settings.frontmatterPanelVisible
                            ? 'bg-panel text-accent shadow-sm'
                            : 'text-muted hover:text-primary'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-tooltip="Templates (<% %>)"
                        data-tooltip-pos="top"
                        aria-label="Templates (<% %>)"
                        data-testid="right-panel-tab-templates"
                        onClick={() =>
                          handleUpdateSettings({ templatesPanelVisible: true })
                        }
                        className={`p-1 rounded transition-colors ${
                          settings.templatesPanelVisible
                            ? 'bg-panel text-accent shadow-sm'
                            : 'text-muted hover:text-primary'
                        }`}
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-tooltip="Local AI Assistant"
                        data-tooltip-pos="top"
                        aria-label="Local AI Assistant"
                        data-testid="right-panel-tab-ai"
                        onClick={() =>
                          handleUpdateSettings({ rightSidebarOpen: true })
                        }
                        className={`p-1 rounded transition-colors ${
                          settings.rightSidebarOpen
                            ? 'bg-panel text-accent shadow-sm'
                            : 'text-muted hover:text-primary'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-tooltip="Daily Notes & Calendar"
                        data-tooltip-pos="top"
                        aria-label="Daily Notes & Calendar"
                        data-testid="right-panel-tab-calendar"
                        onClick={() =>
                          handleUpdateSettings({ calendarPanelVisible: true })
                        }
                        className={`p-1 rounded transition-colors ${
                          settings.calendarPanelVisible
                            ? 'bg-panel text-accent shadow-sm'
                            : 'text-muted hover:text-primary'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-tooltip="Global Tasks"
                        data-tooltip-pos="top"
                        aria-label="Global Tasks"
                        data-testid="right-panel-tab-tasks"
                        onClick={() =>
                          handleUpdateSettings({ tasksPanelVisible: true })
                        }
                        className={`p-1 rounded transition-colors ${
                          settings.tasksPanelVisible
                            ? 'bg-panel text-accent shadow-sm'
                            : 'text-muted hover:text-primary'
                        }`}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-tooltip="Help & Reference"
                        data-tooltip-pos="top"
                        aria-label="Help & Reference"
                        data-testid="right-panel-tab-help"
                        onClick={() =>
                          handleUpdateSettings({ helpPanelVisible: true })
                        }
                        className={`p-1 rounded transition-colors ${
                          settings.helpPanelVisible
                            ? 'bg-panel text-accent shadow-sm'
                            : 'text-muted hover:text-primary'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      data-tooltip="Hide Right Panel"
                      data-tooltip-pos="top"
                      aria-label="Hide Right Panel"
                      data-testid="collapse-right-sidebar-btn"
                      onClick={() =>
                        handleUpdateSettings({
                          frontmatterPanelVisible: false,
                          templatesPanelVisible: false,
                          rightSidebarOpen: false,
                          helpPanelVisible: false,
                          calendarPanelVisible: false,
                          tasksPanelVisible: false
                        })
                      }
                      className="p-1 rounded bg-app border border-subtle text-muted hover:text-primary hover:border-accent"
                    >
                      <PanelRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
      </div>

      {/* Collapsible Bottom Status Bar (5 center icons moved to bottom of left sidebar window per user request) */}
      {!settings.zenMode && settings.statusBarVisible && (
        <footer
          data-testid="bottom-status-bar"
          className="h-7 px-3 bg-app border-t border-subtle flex items-center justify-between text-[11px] text-muted select-none shrink-0"
        >
          <div className="flex items-center gap-3">
            <span data-testid="status-active-root">
              Root: <strong className="text-primary">{activeTab?.rootName || 'None'}</strong>
            </span>
            <span data-testid="status-multi-repo-badge" className="flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-accent" />
              <span>{gitAggregateSummary}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span data-testid="status-word-count">{wordCount} words</span>
            <button
              type="button"
              data-testid="status-bar-ai-badge"
              onClick={() =>
                handleUpdateSettings({ rightSidebarOpen: !settings.rightSidebarOpen })
              }
              className="hover:text-primary"
            >
              Local AI: {settings.ai.activeModel}
            </button>
          </div>
        </footer>
      )}

      {/* Cross-Root File Move & Automatic Asset Migration Confirmation Modal */}
      {crossRootMovePrompt && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
          data-testid="cross-root-move-modal"
        >
          <div className="w-full max-w-md bg-panel border border-subtle rounded-lg shadow-xl p-4 space-y-3 text-xs">
            <div className="font-semibold text-sm text-primary">
              Move File Across Workspace Roots
            </div>
            <p className="text-muted">
              Moving <strong>{crossRootMovePrompt.sourceRelativePath}</strong> to{' '}
              <strong>
                {roots.find((r) => r.id === crossRootMovePrompt.targetRootId)?.name}
              </strong>
              .
            </p>
            {crossRootMovePrompt.referencedAssets.length > 0 && (
              <div className="p-2.5 rounded bg-secondary border border-subtle space-y-1">
                <div className="font-semibold text-primary">
                  Referenced Local Assets Detected ({crossRootMovePrompt.referencedAssets.length}):
                </div>
                {crossRootMovePrompt.referencedAssets.map((a) => (
                  <div key={a} className="font-mono text-[11px] text-accent">
                    {a}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCrossRootMovePrompt(null)}
                className="px-3 py-1 rounded bg-secondary border border-subtle text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-cross-root-migrate-btn"
                onClick={() => handleConfirmCrossRootMove(true)}
                className="px-3 py-1 rounded bg-accent text-white font-medium"
              >
                Move & Migrate Assets
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excalidraw Interactive Modal */}
      {excalidrawTarget && (
        <ExcalidrawCanvasModal
          rootId={excalidrawTarget.rootId}
          relativePath={excalidrawTarget.relativePath}
          theme={resolvedTheme}
          onClose={() => setExcalidrawTarget(null)}
          onSaved={async (savedRelPath) => {
            if (activeTab && !activeTab.content.includes(savedRelPath)) {
              handleEditorContentChange(
                `${activeTab.content}\n\n![Architecture Drawing](${savedRelPath})\n`
              )
            }
            await refreshWorkspaceAndTrees()
          }}
        />
      )}

      {/* Command Palette / Quick Switcher / Icon Picker */}
      {paletteMode && (
        <CommandPaletteModal
          mode={paletteMode}
          actions={commandActions}
          files={allWorkspaceFiles}
          onSelectFile={openDocument}
          onSelectIcon={(iconSyntax) => {
            if (activeTab) {
              dispatchTextInsert(iconSyntax, null)
            }
          }}
          onClose={() => setPaletteMode(null)}
        />
      )}

      {/* Settings & Workspace Manifest Modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          roots={roots}
          onUpdateSettings={handleUpdateSettings}
          onSaveWorkspaceManifest={async (filePath) => {
            await window.klartext.saveWorkspaceManifest(filePath, 'Multi-Root Workspace')
            setShowSettingsModal(false)
          }}
          onLoadWorkspaceManifest={async (filePath) => {
            await window.klartext.loadWorkspaceManifest(filePath, true)
            await refreshWorkspaceAndTrees()
            setShowSettingsModal(false)
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Document Tab Right-Click Context Menu */}
      {tabContextMenu && (
        <div
          data-testid="tab-context-menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${Math.min(window.innerHeight - 280, Math.max(8, tabContextMenu.y))}px`,
            left: `${Math.min(window.innerWidth - 240, Math.max(8, tabContextMenu.x))}px`,
            zIndex: 9999
          }}
          className="w-56 py-1 rounded-md bg-panel border border-subtle shadow-xl text-xs select-none"
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-subtle truncate">
            {tabContextMenu.tab.relativePath.split('/').pop() ||
              tabContextMenu.tab.relativePath}
          </div>

          <button
            type="button"
            data-testid="tab-context-split"
            onClick={() => {
              splitTabView(tabContextMenu.pane, tabContextMenu.tab)
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Columns className="w-3.5 h-3.5 text-accent" />
              <span>Split View Side by Side</span>
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-context-duplicate"
            onClick={() => {
              duplicateTabView(tabContextMenu.pane, tabContextMenu.tab)
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-accent" />
              <span>Duplicate View (Both Windows)</span>
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-context-move-other"
            onClick={() => {
              const targetPane =
                tabContextMenu.pane === 'primary' ? 'secondary' : 'primary'
              moveTabToPane(tabContextMenu.pane, targetPane, tabContextMenu.tab)
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-muted" />
              <span>
                Move to {tabContextMenu.pane === 'primary' ? 'Right' : 'Left'} Window
              </span>
            </span>
          </button>

          <div className="my-1 border-t border-subtle" />

          <button
            type="button"
            data-testid="tab-context-copy-path"
            onClick={() => {
              navigator.clipboard?.writeText(tabContextMenu.tab.relativePath).catch(() => {})
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5 text-muted" />
            <span>Copy Relative Path</span>
          </button>

          <button
            type="button"
            data-testid="tab-context-reveal"
            onClick={() => {
              const parts = tabContextMenu.tab.relativePath.split('/').filter(Boolean)
              const folderRel = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
              setSelectedFolder({
                rootId: tabContextMenu.tab.rootId,
                relativePath: folderRel
              })
              setLeftSidebarTab('explorer')
              handleUpdateSettings({ leftSidebarOpen: true, leftSidebarTab: 'explorer' })
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted" />
            <span>Reveal in Explorer</span>
          </button>

          <div className="my-1 border-t border-subtle" />

          <button
            type="button"
            data-testid="tab-context-close-others"
            onClick={() => {
              const targetKey = tabContextMenu.tab.key
              if (tabContextMenu.pane === 'primary') {
                setTabs((prev) => prev.filter((t) => t.key === targetKey))
                setActiveTabKey(targetKey)
              } else {
                setSecondaryTabs((prev) => prev.filter((t) => t.key === targetKey))
                setSecondaryActiveTabKey(targetKey)
              }
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
          >
            <X className="w-3.5 h-3.5 text-muted" />
            <span>Close Other Tabs</span>
          </button>

          <button
            type="button"
            data-testid="tab-context-close-right"
            onClick={() => {
              const targetKey = tabContextMenu.tab.key
              if (tabContextMenu.pane === 'primary') {
                setTabs((prev) => {
                  const idx = prev.findIndex((t) => t.key === targetKey)
                  return idx >= 0 ? prev.slice(0, idx + 1) : prev
                })
                setActiveTabKey(targetKey)
              } else {
                setSecondaryTabs((prev) => {
                  const idx = prev.findIndex((t) => t.key === targetKey)
                  return idx >= 0 ? prev.slice(0, idx + 1) : prev
                })
                setSecondaryActiveTabKey(targetKey)
              }
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted" />
            <span>Close Tabs to the Right</span>
          </button>

          <button
            type="button"
            data-testid="tab-context-close"
            onClick={() => {
              closeTabInPane(tabContextMenu.pane, tabContextMenu.tab.key)
              setTabContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-danger flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Close Tab</span>
          </button>
        </div>
      )}

      {showGitHubWizardModal && (
        <GitHubWorkspaceWizardModal
          defaultParentDir={
            roots[0]?.path
              ? roots[0].path.split('/').slice(0, -1).join('/') || '/tmp'
              : '/tmp'
          }
          onClose={() => setShowGitHubWizardModal(false)}
          onCloneSuccess={async () => {
            setShowGitHubWizardModal(false)
            await refreshWorkspaceAndTrees()
          }}
        />
      )}

      {dynamicWizardState.open && (
        <DynamicWorkspaceWizardModal
          targetWorkspace={dynamicWizardState.targetWorkspace}
          editingFolder={dynamicWizardState.editingFolder}
          editingRootRules={dynamicWizardState.editingRootRules}
          knownTags={settings.frontmatterKnownTags || []}
          statusOptions={
            settings.frontmatterStatusOptions || [
              'Draft',
              'In Progress',
              'In Review',
              'Approved',
              'Published',
              'Archived'
            ]
          }
          candidateDocuments={dynamicCandidateDocuments}
          onClose={() => setDynamicWizardState({ open: false })}
          onSaveWorkspace={(savedWs) => {
            const currentList = settings.dynamicWorkspaces || []
            const exists = currentList.some((w) => w.id === savedWs.id)
            const nextList = exists
              ? currentList.map((w) => (w.id === savedWs.id ? savedWs : w))
              : [...currentList, savedWs]
            handleUpdateSettings({ dynamicWorkspaces: nextList })
            setDynamicWizardState({ open: false })
          }}
        />
      )}

      {aiInstructionDialog?.open && (
        <AICustomInstructionDialogModal
          initialSelectedText={aiInstructionDialog.selectedText}
          activeFilePath={activeTab?.relativePath || 'Untitled.md'}
          pendingDiff={pendingAIDiff}
          onSubmitInstruction={(instruction, targetText) => {
            handleTriggerAIAction('custom', instruction, undefined, targetText)
          }}
          onCancelStream={(requestId) => window.klartext.cancelAIStream(requestId)}
          onAcceptResult={(proposedText, targetText) => {
            if (
              activeTab &&
              targetText &&
              targetText !== activeTab.content &&
              activeTab.content.includes(targetText)
            ) {
              handleEditorContentChange(activeTab.content.replace(targetText, proposedText))
            } else {
              handleEditorContentChange(proposedText)
            }
            setPendingAIDiff(null)
            setAiInstructionDialog(null)
          }}
          onInsertBelowResult={(proposedText, targetText) => {
            if (activeTab && targetText && activeTab.content.includes(targetText)) {
              handleEditorContentChange(
                activeTab.content.replace(targetText, `${targetText}\n\n${proposedText}`)
              )
            } else if (activeTab) {
              handleEditorContentChange(`${activeTab.content}\n\n${proposedText}`)
            }
            setPendingAIDiff(null)
            setAiInstructionDialog(null)
          }}
          onClose={() => setAiInstructionDialog(null)}
        />
      )}

      {/* 4.3 Slide Deck Presentation Mode Modal */}
      {showSlideDeckModal && activeTab && (
        <SlideDeckModal
          markdown={activeTab.content}
          rootId={activeTab.rootId}
          documentTitle={activeTab.relativePath.split('/').pop() || activeTab.relativePath}
          onClose={() => setShowSlideDeckModal(false)}
        />
      )}

      {/* 4.2 Web Clipper / Import from URL to Markdown Modal */}
      {showWebClipperModal && (
        <WebClipperModal
          onCreateNoteFromClip={async (clippedTitle, markdownContent) => {
            const targetRootId = activeTab?.rootId || roots[0]?.id
            if (!targetRootId) return
            const safeStem =
              clippedTitle
                .replace(/[^a-zA-Z0-9-_ ]/g, '')
                .trim()
                .replace(/\s+/g, '-') || 'Clipped-Note'
            const relPath = `${safeStem}.md`
            await window.klartext.createDocument(targetRootId, relPath, markdownContent)
            await refreshWorkspaceAndTrees()
            await openDocument(targetRootId, relPath)
          }}
          onInsertIntoCurrentDocument={(markdownContent) => {
            dispatchTextInsert(`\n${markdownContent}\n`, null)
          }}
          onClose={() => setShowWebClipperModal(false)}
        />
      )}

      {/* About Klartext Modal */}
      {showAboutModal && (
        <AboutModal
          onClose={() => setShowAboutModal(false)}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {/* Top-Level Global Tooltip Portal (Always Above All Stacking Contexts & Overflow Containers) */}
      {portalTooltip && (
        <div
          data-testid="global-tooltip-portal"
          style={{
            position: 'fixed',
            top: `${portalTooltip.top}px`,
            left: `${portalTooltip.left}px`,
            transform:
              portalTooltip.pos === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 2147483647,
            pointerEvents: 'none'
          }}
          className="px-2 py-0.5 rounded bg-app border border-subtle text-primary text-[10px] font-medium whitespace-nowrap shadow-lg"
        >
          {portalTooltip.text}
        </div>
      )}
    </div>
  )
}


