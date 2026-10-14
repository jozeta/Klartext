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
  Plus
} from 'lucide-react'
import type {
  AppSettings,
  BacklinkItem,
  EditMode,
  FileTreeNode,
  GitRepoStatus,
  RecoverySnapshot,
  WorkspaceRoot
} from '../../shared/types'
import {
  extractHeadings,
  extractFrontmatter,
  updateFrontmatterInMarkdown
} from '../../shared/markdown/pipeline'
import { MultiRootSidebar, type LeftSidebarTab } from '../features/workspace/MultiRootSidebar'
import { MarkdownEditorWorkspace } from '../features/editor/MarkdownEditorWorkspace'
import {
  SPELL_LANGUAGE_LABELS,
  type SupportedSpellLanguage
} from '../features/editor/spellcheck-extension'
import { LocalAIPanel } from '../features/ai/LocalAIPanel'
import { ExcalidrawCanvasModal } from '../features/diagrams/DiagramWidgets'
import {
  CommandPaletteModal,
  SettingsModal,
  type CommandActionItem
} from '../components/command-palette/CommandPaletteAndSettings'

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

const DEFAULT_FRONTMATTER_KEYS = ['title', 'author', 'date', 'tags', 'status']

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [roots, setRoots] = useState<WorkspaceRoot[]>([])
  const [treesByRoot, setTreesByRoot] = useState<Record<string, FileTreeNode[]>>({})
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitRepoStatus>>({})

  const [tabs, setTabs] = useState<OpenDocumentTab[]>([])
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<EditMode>('inline')
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>('explorer')
  const [lastActiveRightPanel, setLastActiveRightPanel] = useState<'frontmatter' | 'ai'>('ai')
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [scrollToLine, setScrollToLine] = useState<{ line: number; nonce: number } | null>(null)
  const [editorCommandTrigger, setEditorCommandTrigger] = useState<{
    command:
      | 'undo'
      | 'redo'
      | 'cut'
      | 'copy'
      | 'paste'
      | 'select-all'
      | 'copy-rich-html'
      | 'toggle-inline-ai'
      | 'ai-improve'
    nonce: number
  } | null>(null)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [customFrontmatterKey, setCustomFrontmatterKey] = useState('')

  // Tab bar horizontal scroll state when many tabs are open
  const tabBarScrollRef = useRef<HTMLDivElement | null>(null)
  const [tabBarHasOverflow, setTabBarHasOverflow] = useState(false)

  // Modals & Overlays
  const [paletteMode, setPaletteMode] = useState<'commands' | 'files' | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
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

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeTabKey) || tabs[0] || null,
    [tabs, activeTabKey]
  )

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    const mode = settings?.theme || 'light'
    if (mode === 'dark') return 'dark'
    if (mode === 'light') return 'light'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [settings?.theme])

  // Resizable Left & Right Sidebar widths
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(260)
  const [frontmatterSidebarWidth, setFrontmatterSidebarWidth] = useState<number>(288)
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(320)
  const activeSidebarDragRef = useRef<'left' | 'frontmatter' | 'right' | null>(null)

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
    frontmatterSidebarWidth,
    settings?.pageTabsPosition
  ])

  useEffect(() => {
    if (settings?.leftSidebarWidth) setLeftSidebarWidth(settings.leftSidebarWidth)
    if (settings?.frontmatterSidebarWidth) {
      setFrontmatterSidebarWidth(settings.frontmatterSidebarWidth)
    }
    if (settings?.rightSidebarWidth) setRightSidebarWidth(settings.rightSidebarWidth)
  }, [
    settings?.leftSidebarWidth,
    settings?.frontmatterSidebarWidth,
    settings?.rightSidebarWidth
  ])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!activeSidebarDragRef.current) return
      if (activeSidebarDragRef.current === 'left') {
        const nextW = Math.max(180, Math.min(520, e.clientX))
        setLeftSidebarWidth(nextW)
      } else if (activeSidebarDragRef.current === 'frontmatter') {
        const rightOffset = settings?.rightSidebarOpen ? rightSidebarWidth : 0
        const nextW = Math.max(
          200,
          Math.min(520, window.innerWidth - e.clientX - rightOffset)
        )
        setFrontmatterSidebarWidth(nextW)
      } else if (activeSidebarDragRef.current === 'right') {
        const nextW = Math.max(220, Math.min(560, window.innerWidth - e.clientX))
        setRightSidebarWidth(nextW)
      }
    }
    const onMouseUp = () => {
      if (activeSidebarDragRef.current === 'left') {
        window.klartext.updateSettings({ leftSidebarWidth }).catch(() => {})
      } else if (activeSidebarDragRef.current === 'frontmatter') {
        window.klartext.updateSettings({ frontmatterSidebarWidth }).catch(() => {})
      } else if (activeSidebarDragRef.current === 'right') {
        window.klartext.updateSettings({ rightSidebarWidth }).catch(() => {})
      }
      activeSidebarDragRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [
    leftSidebarWidth,
    frontmatterSidebarWidth,
    rightSidebarWidth,
    settings?.rightSidebarOpen
  ])

  const dispatchEditorCommand = useCallback(
    (
      command:
        | 'undo'
        | 'redo'
        | 'cut'
        | 'copy'
        | 'paste'
        | 'select-all'
        | 'copy-rich-html'
        | 'toggle-inline-ai'
        | 'ai-improve'
    ) => {
      setEditorCommandTrigger({ command, nonce: Date.now() + Math.random() })
    },
    []
  )

  // Auto-collapse File, Edit, View & AI menus when clicking anywhere in the app
  useEffect(() => {
    if (!showFileMenu && !showEditMenu && !showViewMenu && !showAIMenu) return
    const handleGlobalClick = () => {
      setShowFileMenu(false)
      setShowEditMenu(false)
      setShowViewMenu(false)
      setShowAIMenu(false)
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [showFileMenu, showEditMenu, showViewMenu, showAIMenu])

  // Apply theme, white-paper-in-dark-mode, & granular typography CSS variables to documentElement
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

      if (settings.accentColorOverride) {
        rootEl.style.setProperty('--accent-primary', settings.accentColorOverride)
      }
    }
  }, [resolvedTheme, settings])

  const isBootedRef = useRef(false)

  const handleUpdateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const effective: Partial<AppSettings> = { ...partial }
    // Enforce mutual exclusion on the right side: only one right panel visible at a time
    if (effective.frontmatterPanelVisible === true) {
      effective.rightSidebarOpen = false
      effective.lastActiveRightPanel = 'frontmatter'
      setLastActiveRightPanel('frontmatter')
    } else if (effective.rightSidebarOpen === true) {
      effective.frontmatterPanelVisible = false
      effective.lastActiveRightPanel = 'ai'
      setLastActiveRightPanel('ai')
    }

    setSettings((prev) => (prev ? { ...prev, ...effective } : prev))
    try {
      const updated = await window.klartext.updateSettings(effective)
      setSettings((prev) => ({ ...(prev || updated), ...updated, ...effective }))
    } catch {
      // Keep optimistic state if main process update fails
    }
  }, [])

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

  const refreshWorkspaceAndTrees = useCallback(async () => {
    const ws = await window.klartext.getWorkspaceState()
    setRoots(ws.roots)

    const nextTrees: Record<string, FileTreeNode[]> = {}
    for (const r of ws.roots) {
      nextTrees[r.id] = await window.klartext.listFilesForRoot(r.id)
    }
    setTreesByRoot(nextTrees)

    const statuses = await window.klartext.getAllGitStatus()
    const statusMap: Record<string, GitRepoStatus> = {}
    for (const st of statuses) {
      statusMap[st.rootId] = st
    }
    setGitStatuses(statusMap)
  }, [])

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

  const handleExportHtml = useCallback(async () => {
    if (!activeTab) return
    const res = await window.klartext.exportHtml({
      rootId: activeTab.rootId,
      relativePath: activeTab.relativePath,
      markdown: activeTab.content,
      title: activeTab.relativePath
    })
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
    setExportStatusBanner(`Exported PDF (${res.sizeBytes} bytes): ${res.outputPath}`)
  }, [activeTab])

  // Subscribe to native application File, Edit & View Menu actions
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
      } else if (action === 'toggle-spellcheck' && settings) {
        await handleUpdateSettings({
          spellcheckEnabled: settings.spellcheckEnabled === false
        })
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
    handleUpdateSettings
  ])

  // Initial boot: load settings, workspace roots, recovery snapshots, and saved open tabs (or first Markdown document)
  useEffect(() => {
    const init = async () => {
      const loadedSettings = await window.klartext.getSettings()
      const normalizedSettings: AppSettings = {
        ...loadedSettings,
        ...(loadedSettings.frontmatterPanelVisible && loadedSettings.rightSidebarOpen
          ? { rightSidebarOpen: false }
          : {})
      }
      if (normalizedSettings.frontmatterPanelVisible) {
        setLastActiveRightPanel('frontmatter')
      } else if (normalizedSettings.rightSidebarOpen) {
        setLastActiveRightPanel('ai')
      } else if (normalizedSettings.lastActiveRightPanel) {
        setLastActiveRightPanel(normalizedSettings.lastActiveRightPanel)
      }
      if (normalizedSettings.leftSidebarWidth) {
        setLeftSidebarWidth(normalizedSettings.leftSidebarWidth)
      }
      if (normalizedSettings.frontmatterSidebarWidth) {
        setFrontmatterSidebarWidth(normalizedSettings.frontmatterSidebarWidth)
      }
      if (normalizedSettings.rightSidebarWidth) {
        setRightSidebarWidth(normalizedSettings.rightSidebarWidth)
      }
      if (normalizedSettings.leftSidebarTab) {
        setLeftSidebarTab(normalizedSettings.leftSidebarTab)
      }
      setSettings(normalizedSettings)
      setEditMode(normalizedSettings.defaultEditMode || 'inline')

      const ws = await window.klartext.getWorkspaceState()
      setRoots(ws.roots)

      const nextTrees: Record<string, FileTreeNode[]> = {}
      for (const r of ws.roots) {
        nextTrees[r.id] = await window.klartext.listFilesForRoot(r.id)
      }
      setTreesByRoot(nextTrees)

      const statuses = await window.klartext.getAllGitStatus()
      const statusMap: Record<string, GitRepoStatus> = {}
      for (const st of statuses) {
        statusMap[st.rootId] = st
      }
      setGitStatuses(statusMap)

      const snaps = await window.klartext.listRecoverySnapshots()
      setRecoverySnapshots(snaps)

      // Restore previously open document tabs if available, otherwise open first .md file
      const restoredTabs: OpenDocumentTab[] = []
      if (Array.isArray(normalizedSettings.openTabs) && normalizedSettings.openTabs.length > 0) {
        for (const savedTab of normalizedSettings.openTabs) {
          const rootObj = ws.roots.find((r) => r.id === savedTab.rootId)
          if (!rootObj) continue
          try {
            const { content } = await window.klartext.readDocument(
              savedTab.rootId,
              savedTab.relativePath
            )
            const key = `${savedTab.rootId}::${savedTab.relativePath}`
            if (!restoredTabs.some((t) => t.key === key)) {
              restoredTabs.push({
                key,
                rootId: savedTab.rootId,
                rootName: rootObj.name,
                relativePath: savedTab.relativePath,
                content,
                savedContent: content,
                dirty: false
              })
            }
          } catch {
            // Skip missing or deleted files
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
  }, [])

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
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteMode((p) => (p === 'commands' ? null : 'commands'))
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteMode((p) => (p === 'files' ? null : 'files'))
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if (settings) {
          handleUpdateSettings({ zenMode: !settings.zenMode })
        }
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
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, settings, handleUpdateSettings])

  const handleEditorContentChange = (nextContent: string) => {
    if (!activeTab) return
    const tabKey = activeTab.key
    const rootId = activeTab.rootId
    const relativePath = activeTab.relativePath

    setTabs((prev) =>
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
    )

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      await window.klartext.saveRecoverySnapshot(rootId, relativePath, nextContent)
      await window.klartext.writeDocument(rootId, relativePath, nextContent)
      setTabs((prev) =>
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
      )
    }, settings?.autosaveDelayMs || 900)
  }

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

  const handleTriggerAIAction = async (
    action: string,
    promptOrSelectedText: string,
    modelOverride?: string
  ) => {
    if (!activeTab) return
    if (settings && !settings.rightSidebarOpen) {
      await handleUpdateSettings({ rightSidebarOpen: true })
    }
    const requestId = `ai-${Date.now()}`
    const originalText = activeTab.content
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
        prompt: promptOrSelectedText,
        selectedText: originalText,
        modelOverride
      })
    } catch {
      // Handled via chunk error event
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

  const commandActions: CommandActionItem[] = useMemo(
    () => [
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
      }
    ],
    [
      activeTab,
      resolvedTheme,
      settings,
      refreshWorkspaceAndTrees,
      handleExportHtml,
      handleExportPdf,
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

  const allFrontmatterKeys = useMemo(() => {
    const existingKeys = parsedFrontmatter.frontmatter
      ? Object.keys(parsedFrontmatter.frontmatter)
      : []
    const merged = [...DEFAULT_FRONTMATTER_KEYS]
    for (const k of existingKeys) {
      if (!merged.includes(k)) merged.push(k)
    }
    return merged
  }, [parsedFrontmatter.frontmatter])

  const updateFrontmatterField = (key: string, value: string) => {
    if (!activeTab) return
    const currentObj = { ...(parsedFrontmatter.frontmatter || {}) }
    if (key === 'tags') {
      currentObj[key] = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
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

            {/* File Menu (Open Folder, Export HTML/PDF, Settings) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="file-menu-btn"
                onClick={() => {
                  setShowFileMenu((v) => !v)
                  setShowEditMenu(false)
                  setShowViewMenu(false)
                  setShowAIMenu(false)
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>File</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showFileMenu && (
                <div
                  data-testid="file-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-56 rounded-md bg-panel border border-subtle shadow-lg py-1 text-xs"
                >
                  <button
                    type="button"
                    onClick={async () => {
                      setShowFileMenu(false)
                      await window.klartext.openFolderDialog()
                      await refreshWorkspaceAndTrees()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary"
                  >
                    Open Folder...
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
                    <span>Export to Standalone HTML...</span>
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
                    <span>Export to PDF...</span>
                    <kbd className="text-[10px] font-mono text-muted">⌥⌘E</kbd>
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
                    <span>Settings...</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘,</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu (Undo, Redo, Cut, Copy, Paste, Select All, Find, Copy Rich HTML) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="edit-menu-btn"
                onClick={() => {
                  setShowEditMenu((v) => !v)
                  setShowFileMenu(false)
                  setShowViewMenu(false)
                  setShowAIMenu(false)
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>Edit</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showEditMenu && (
                <div
                  data-testid="edit-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-56 rounded-md bg-panel border border-subtle shadow-lg py-1 text-xs"
                >
                  <button
                    type="button"
                    data-testid="edit-menu-undo"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('undo')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Undo</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘Z</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-redo"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('redo')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Redo</span>
                    <kbd className="text-[10px] font-mono text-muted">⇧⌘Z</kbd>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="edit-menu-cut"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('cut')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Cut</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘X</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-copy"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('copy')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘C</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-paste"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('paste')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Paste</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘V</kbd>
                  </button>
                  <button
                    type="button"
                    data-testid="edit-menu-select-all"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('select-all')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Select All</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘A</kbd>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="edit-menu-find"
                    onClick={() => {
                      setShowEditMenu(false)
                      if (!settings.leftSidebarOpen) {
                        handleUpdateSettings({ leftSidebarOpen: true, leftSidebarTab: 'search' })
                      } else {
                        handleSelectLeftSidebarTab('search')
                      }
                      setLeftSidebarTab('search')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Find in Workspace...</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘F</kbd>
                  </button>
                  <div className="my-1 border-t border-subtle" />
                  <button
                    type="button"
                    data-testid="copy-rich-html-btn"
                    onClick={() => {
                      setShowEditMenu(false)
                      dispatchEditorCommand('copy-rich-html')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Copy Rich HTML</span>
                  </button>
                </div>
              )}
            </div>

            {/* View & Spellcheck Menu Dropdown */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="view-menu-btn"
                onClick={() => {
                  setShowViewMenu((v) => !v)
                  setShowFileMenu(false)
                  setShowEditMenu(false)
                  setShowAIMenu(false)
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <span>View</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showViewMenu && (
                <div
                  data-testid="view-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-64 rounded-md bg-panel border border-subtle shadow-lg py-1.5 text-xs"
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>
                      Switch to {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                    <span>{resolvedTheme === 'dark' ? '☀️' : '🌙'}</span>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>White Paper Background in Dark Mode</span>
                    <span>{settings.lightPaperInDarkMode ? '✓' : ''}</span>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Word Wrap (Off = Infinite Workspace)</span>
                    <span>{settings.wordWrap !== false ? '✓' : ''}</span>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Show Formatting Toolbar Row</span>
                    <span>{settings.formattingToolbarVisible ? '✓' : ''}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-statusbar"
                    onClick={() => {
                      handleUpdateSettings({ statusBarVisible: !settings.statusBarVisible })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Show Bottom Status Row</span>
                    <span>{settings.statusBarVisible ? '✓' : ''}</span>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Show Left Panel Control Bar</span>
                    <span>{settings.sidebarControlBarVisible !== false ? '✓' : ''}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-frontmatter"
                    onClick={() => {
                      handleUpdateSettings({
                        frontmatterPanelVisible: !settings.frontmatterPanelVisible
                      })
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Show Right Frontmatter Window</span>
                    <span>{settings.frontmatterPanelVisible ? '✓' : ''}</span>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Show Outline in Sidebar</span>
                    <span>{settings.showOutlineTab !== false ? '✓' : ''}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="view-menu-toggle-links"
                    onClick={() => {
                      const nextVal = settings.showBacklinksTab === false
                      if (!nextVal && leftSidebarTab === 'backlinks') {
                        setLeftSidebarTab('explorer')
                        handleUpdateSettings({
                          showBacklinksTab: nextVal,
                          leftSidebarTab: 'explorer'
                        })
                      } else {
                        handleUpdateSettings({ showBacklinksTab: nextVal })
                      }
                      setShowViewMenu(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Show Links in Sidebar</span>
                    <span>{settings.showBacklinksTab !== false ? '✓' : ''}</span>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Spellcheck (Red Squiggly Underlines)</span>
                    <span>{settings.spellcheckEnabled !== false ? '✓' : ''}</span>
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

            {/* AI Menu Dropdown (Local AI Panel, Inline Draft, AI Improve) */}
            <div className="relative titlebar-no-drag" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-testid="ai-menu-btn"
                onClick={() => {
                  setShowAIMenu((v) => !v)
                  setShowFileMenu(false)
                  setShowEditMenu(false)
                  setShowViewMenu(false)
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted hover:text-primary font-medium"
              >
                <Sparkles className="w-3 h-3 text-accent" />
                <span>AI</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showAIMenu && (
                <div
                  data-testid="ai-menu-dropdown"
                  className="absolute left-0 top-7 z-50 w-64 rounded-md bg-panel border border-subtle shadow-lg py-1.5 text-xs"
                >
                  <button
                    type="button"
                    data-testid="toggle-right-sidebar-btn"
                    onClick={() => {
                      setShowAIMenu(false)
                      handleUpdateSettings({ rightSidebarOpen: !settings.rightSidebarOpen })
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Local AI Panel ({settings.ai.activeModel})</span>
                    <span>{settings.rightSidebarOpen ? '✓' : ''}</span>
                  </button>

                  <div className="my-1 border-t border-subtle" />

                  <button
                    type="button"
                    data-testid="toggle-inline-ai-prompt-btn"
                    onClick={() => {
                      setShowAIMenu(false)
                      dispatchEditorCommand('toggle-inline-ai')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span>Inline Draft</span>
                    <kbd className="text-[10px] font-mono text-muted">⌘J</kbd>
                  </button>

                  <button
                    type="button"
                    data-testid="ai-quick-improve-btn"
                    onClick={() => {
                      setShowAIMenu(false)
                      dispatchEditorCommand('ai-improve')
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-accent" />
                      <span>AI Improve (SV/EN)</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Page Tabs on Top Menu Row (starting on the right side of the last menu item when configured) */}
          {settings.pageTabsPosition === 'top-menu' && tabs.length > 0 && (
            <div
              data-testid="document-tab-bar"
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
                  const isCurrent = tab.key === activeTab?.key
                  const fileNameOnly = tab.relativePath.split('/').pop() || tab.relativePath
                  return (
                    <div
                      key={tab.key}
                      title={`${tab.rootName} — ${tab.relativePath}`}
                      data-testid={`doc-tab-${tab.rootId}-${tab.relativePath}`}
                      onClick={() => setActiveTabKey(tab.key)}
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
                      {tabs.length > 1 && (
                        <button
                          type="button"
                          data-testid={`close-tab-${tab.rootId}-${tab.relativePath}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            const remaining = tabs.filter((t) => t.key !== tab.key)
                            setTabs(remaining)
                            if (isCurrent && remaining[0]) {
                              setActiveTabKey(remaining[0].key)
                            }
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
                if (settings.frontmatterPanelVisible || settings.rightSidebarOpen) {
                  const lastPanel = settings.frontmatterPanelVisible ? 'frontmatter' : 'ai'
                  setLastActiveRightPanel(lastPanel)
                  handleUpdateSettings({
                    frontmatterPanelVisible: false,
                    rightSidebarOpen: false,
                    lastActiveRightPanel: lastPanel
                  })
                } else if (lastActiveRightPanel === 'frontmatter') {
                  handleUpdateSettings({
                    frontmatterPanelVisible: true,
                    rightSidebarOpen: false,
                    lastActiveRightPanel: 'frontmatter'
                  })
                } else {
                  handleUpdateSettings({
                    rightSidebarOpen: true,
                    frontmatterPanelVisible: false,
                    lastActiveRightPanel: 'ai'
                  })
                }
              }}
              className={`p-1 rounded hover:bg-secondary ${
                settings.frontmatterPanelVisible || settings.rightSidebarOpen
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

      {/* Main Workspace Area: Resizable Collapsible Left Sidebar + Editor Canvas + Resizable Right Frontmatter Window + Resizable Right AI Panel */}
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
                showBacklinksTab={settings.showBacklinksTab !== false}
                roots={roots}
                treesByRoot={treesByRoot}
                gitStatuses={gitStatuses}
                activeDoc={
                  activeTab
                    ? { rootId: activeTab.rootId, relativePath: activeTab.relativePath }
                    : null
                }
                headings={headings}
                backlinks={backlinks}
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
                  await refreshWorkspaceAndTrees()
                }}
                onCreateFileInRoot={async (rootId, relativePath) => {
                  await window.klartext.createDocument(
                    rootId,
                    relativePath,
                    `# ${relativePath.replace(/\.md$/i, '')}\n\n`
                  )
                  await refreshWorkspaceAndTrees()
                  await openDocument(rootId, relativePath)
                }}
                onDeleteFileInRoot={async (rootId, relativePath) => {
                  await window.klartext.deleteDocument(rootId, relativePath)
                  const closedKey = `${rootId}::${relativePath}`
                  setTabs((prev) => {
                    const remaining = prev.filter((t) => t.key !== closedKey)
                    if (activeTabKey === closedKey) {
                      setActiveTabKey(remaining[0]?.key || null)
                    }
                    return remaining
                  })
                  await refreshWorkspaceAndTrees()
                }}
                onRenameFileInRoot={async (rootId, oldRelativePath, newRelativePath) => {
                  await window.klartext.renameDocument(rootId, oldRelativePath, newRelativePath)
                  await refreshWorkspaceAndTrees()
                  const oldKey = `${rootId}::${oldRelativePath}`
                  const newKey = `${rootId}::${newRelativePath}`
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.key === oldKey
                        ? { ...t, key: newKey, relativePath: newRelativePath }
                        : t
                    )
                  )
                  if (activeTabKey === oldKey) {
                    setActiveTabKey(newKey)
                  } else {
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

        {/* Center Document Tabs + Editor */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-panel min-w-0">
          {/* Document Tab Bar (Single-row tabs with ellipsis truncation + < > scroll buttons when overflowing + window drag region to the right of the last tab) */}
          {!settings.zenMode && settings.pageTabsPosition !== 'top-menu' && tabs.length > 0 && (
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
                  const isCurrent = tab.key === activeTab?.key
                  const fileNameOnly = tab.relativePath.split('/').pop() || tab.relativePath
                  return (
                    <div
                      key={tab.key}
                      title={`${tab.rootName} — ${tab.relativePath}`}
                      data-testid={`doc-tab-${tab.rootId}-${tab.relativePath}`}
                      onClick={() => setActiveTabKey(tab.key)}
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
                      {tabs.length > 1 && (
                        <button
                          type="button"
                          data-testid={`close-tab-${tab.rootId}-${tab.relativePath}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            const remaining = tabs.filter((t) => t.key !== tab.key)
                            setTabs(remaining)
                            if (isCurrent && remaining[0]) {
                              setActiveTabKey(remaining[0].key)
                            }
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

          {activeTab ? (
            <MarkdownEditorWorkspace
              rootId={activeTab.rootId}
              relativePath={activeTab.relativePath}
              content={activeTab.content}
              editMode={editMode}
              theme={resolvedTheme}
              floatingToolbarEnabled={settings.floatingToolbarEnabled}
              formattingToolbarVisible={Boolean(settings.formattingToolbarVisible)}
              aiEnabled={settings.ai.enabled}
              showLineNumbers={Boolean(settings.showLineNumbers)}
              wordWrap={settings.wordWrap !== false}
              spellcheckEnabled={settings.spellcheckEnabled !== false}
              spellcheckLanguages={currentSpellLangs}
              customDictionaryWords={settings.customDictionaryWords || []}
              scrollToLine={scrollToLine}
              editorCommandTrigger={editorCommandTrigger}
              initialSplitPercent={settings.splitViewPercent ?? 50}
              onChangeSplitPercent={(percent) =>
                handleUpdateSettings({ splitViewPercent: percent })
              }
              onChangeContent={handleEditorContentChange}
              onPasteOrDropAsset={handlePasteOrDropAsset}
              onOpenExcalidrawModal={(drawingRelPath) =>
                setExcalidrawTarget({
                  rootId: activeTab.rootId,
                  relativePath: drawingRelPath
                })
              }
              onTriggerAIQuickAction={(action, selectedText) =>
                handleTriggerAIAction(action, selectedText)
              }
              onResolveConflictHunk={(hunkIndex, resolution) =>
                handleResolveConflict(
                  activeTab.rootId,
                  activeTab.relativePath,
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
                    isWiki && !filePart.includes('.') ? `${filePart}.md` : filePart.replace(/^\.\//, '')
                  const foundInAll =
                    allWorkspaceFiles.find(
                      (f) =>
                        f.rootId === activeTab.rootId &&
                        (f.relativePath === clean ||
                          f.relativePath.toLowerCase() === `${clean.toLowerCase()}.md`)
                    ) ||
                    allWorkspaceFiles.find(
                      (f) =>
                        f.relativePath === clean ||
                        f.relativePath.toLowerCase() === `${clean.toLowerCase()}.md`
                    )
                  const targetRoot = foundInAll?.rootId || activeTab.rootId
                  const targetRel = foundInAll?.relativePath || (clean.endsWith('.md') ? clean : `${clean}.md`)
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
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              Select or create a Markdown document in any root folder.
            </div>
          )}
        </main>

        {/* Right-Aligned Resizable Frontmatter Properties Window (mutually exclusive with Local AI Panel) */}
        {!settings.zenMode && settings.frontmatterPanelVisible && activeTab && (
          <>
            <div
              data-testid="frontmatter-sidebar-resizer"
              title="Drag to resize Frontmatter Window"
              onMouseDown={(e) => {
                e.preventDefault()
                activeSidebarDragRef.current = 'frontmatter'
              }}
              className="w-1 h-full cursor-col-resize bg-transparent hover:bg-accent transition-colors shrink-0 z-20"
            />
            <aside
              data-testid="right-frontmatter-window"
              style={{ width: `${frontmatterSidebarWidth}px` }}
              className="h-full shrink-0 bg-app border-l border-subtle flex flex-col overflow-hidden select-none"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-panel border-b border-subtle text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
                  <span>Frontmatter Properties</span>
                </div>
                <button
                  type="button"
                  title="Hide Frontmatter Window"
                  data-testid="close-frontmatter-window-btn"
                  onClick={() => handleUpdateSettings({ frontmatterPanelVisible: false })}
                  className="p-0.5 rounded hover:bg-secondary text-muted hover:text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                {!parsedFrontmatter.frontmatter && (
                  <div className="text-[11px] text-muted bg-panel border border-subtle rounded p-2">
                    No YAML frontmatter in this document yet. Type in any field below to create it automatically.
                  </div>
                )}

                {allFrontmatterKeys.map((key) => {
                  const rawVal = parsedFrontmatter.frontmatter?.[key]
                  const strVal = Array.isArray(rawVal)
                    ? rawVal.join(', ')
                    : rawVal !== undefined && rawVal !== null
                      ? String(rawVal)
                      : ''
                  return (
                    <div key={key} className="space-y-1">
                      <label className="block text-[11px] font-medium text-muted capitalize">
                        {key}
                      </label>
                      <input
                        type="text"
                        data-testid={`frontmatter-input-${key}`}
                        placeholder={`Enter ${key}...`}
                        value={strVal}
                        onChange={(e) => updateFrontmatterField(key, e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  )
                })}

                {/* Add custom frontmatter property */}
                <div className="pt-2 border-t border-subtle space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase text-muted">
                    Add Custom Property
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Property key..."
                      value={customFrontmatterKey}
                      onChange={(e) => setCustomFrontmatterKey(e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-panel border border-subtle text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const k = customFrontmatterKey.trim()
                        if (k) {
                          updateFrontmatterField(k, '')
                          setCustomFrontmatterKey('')
                        }
                      }}
                      className="px-2 py-1 rounded bg-accent text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Right Collapsible & Resizable Local AI Assistant & Hardware Advisor Panel (mutually exclusive with Frontmatter Window) */}
        {!settings.zenMode && settings.rightSidebarOpen && !settings.frontmatterPanelVisible && (
          <>
            <div
              data-testid="right-sidebar-resizer"
              title="Drag to resize Local AI Panel"
              onMouseDown={(e) => {
                e.preventDefault()
                activeSidebarDragRef.current = 'right'
              }}
              className="w-1 h-full cursor-col-resize bg-transparent hover:bg-accent transition-colors shrink-0 z-20"
            />
            <div
              style={{ width: `${rightSidebarWidth}px` }}
              className="h-full shrink-0"
            >
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
                  handleEditorContentChange(proposedText)
                  setPendingAIDiff(null)
                }}
                onRejectDiff={() => setPendingAIDiff(null)}
              />
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

      {/* Command Palette / Quick Switcher */}
      {paletteMode && (
        <CommandPaletteModal
          mode={paletteMode}
          actions={commandActions}
          files={allWorkspaceFiles}
          onSelectFile={openDocument}
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
    </div>
  )
}
