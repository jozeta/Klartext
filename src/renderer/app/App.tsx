import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PanelLeft,
  Command,
  Maximize2,
  Download,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Sparkles,
  AlertCircle,
  GitBranch,
  X
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
import { extractHeadings } from '../../shared/markdown/pipeline'
import { MultiRootSidebar, type LeftSidebarTab } from '../features/workspace/MultiRootSidebar'
import { MarkdownEditorWorkspace } from '../features/editor/MarkdownEditorWorkspace'
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

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [roots, setRoots] = useState<WorkspaceRoot[]>([])
  const [treesByRoot, setTreesByRoot] = useState<Record<string, FileTreeNode[]>>({})
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitRepoStatus>>({})

  const [tabs, setTabs] = useState<OpenDocumentTab[]>([])
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<EditMode>('inline')
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>('explorer')
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])

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

  // Apply theme & typography CSS variables to documentElement without remounting editor
  useEffect(() => {
    const rootEl = document.documentElement
    rootEl.setAttribute('data-theme', resolvedTheme)
    if (settings) {
      rootEl.style.setProperty('--editor-font-size', `${settings.typography.fontSizePx}px`)
      rootEl.style.setProperty('--editor-line-height', String(settings.typography.lineHeight))
      rootEl.style.setProperty(
        '--editor-max-width',
        settings.typography.fullWidth ? '100%' : `${settings.typography.maxLineWidthCh}ch`
      )
      if (settings.accentColorOverride) {
        rootEl.style.setProperty('--accent-primary', settings.accentColorOverride)
      }
    }
  }, [resolvedTheme, settings])

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

  // Initial boot: load settings, workspace roots, recovery snapshots, and first Markdown document
  useEffect(() => {
    const init = async () => {
      const loadedSettings = await window.klartext.getSettings()
      setSettings(loadedSettings)
      setEditMode(loadedSettings.defaultEditMode || 'inline')

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

      // Open first available .md file automatically
      if (ws.roots.length > 0) {
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
    }
    init()
  }, [])

  // Subscribe to MultiRootWatcher external disk changes
  useEffect(() => {
    const unsubscribe = window.klartext.onWatcherChange(async (ev) => {
      await refreshWorkspaceAndTrees()
      if (ev.eventType !== 'change') return

      const key = `${ev.rootId}::${ev.relativePath}`
      setTabs((prevTabs) => {
        const target = prevTabs.find((t) => t.key === key)
        if (!target) return prevTabs
        // Fetch disk content asynchronously
        window.klartext
          .readDocument(ev.rootId, ev.relativePath)
          .then(({ content: diskContent }) => {
            setTabs((current) =>
              current.map((t) => {
                if (t.key !== key) return t
                if (diskContent === t.content) return t
                // Seamless reload if clean; conflict prompt if dirty!
                if (!t.dirty) {
                  return {
                    ...t,
                    content: diskContent,
                    savedContent: diskContent,
                    dirty: false,
                    externalConflictContent: undefined
                  }
                } else {
                  return {
                    ...t,
                    externalConflictContent: diskContent
                  }
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
          const nextZen = !settings.zenMode
          window.klartext.updateSettings({ zenMode: nextZen }).then(setSettings)
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
                    ? { ...t, savedContent: t.content, dirty: false }
                    : t
                )
              )
            })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, settings])

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    const updated = await window.klartext.updateSettings(partial)
    setSettings(updated)
  }

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
              dirty: nextContent !== t.savedContent
            }
          : t
      )
    )

    // Write periodic crash recovery snapshot & debounced atomic save
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      await window.klartext.saveRecoverySnapshot(rootId, relativePath, nextContent)
      await window.klartext.writeDocument(rootId, relativePath, nextContent)
      setTabs((prev) =>
        prev.map((t) =>
          t.key === tabKey ? { ...t, savedContent: nextContent, dirty: false } : t
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
    // Close old tab if open and open moved file in target root
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
        run: () => setEditMode('source')
      },
      {
        id: 'mode-inline',
        category: 'Editor',
        label: 'Switch to Inline Rich Mode (Live Preview)',
        shortcut: 'Mod+2',
        run: () => setEditMode('inline')
      },
      {
        id: 'mode-split',
        category: 'Editor',
        label: 'Switch to Split Mode',
        shortcut: 'Mod+3',
        run: () => setEditMode('split')
      },
      {
        id: 'zen-toggle',
        category: 'View',
        label: 'Toggle Zen / Focus Mode',
        shortcut: 'Mod+Shift+F',
        run: () => settings && handleUpdateSettings({ zenMode: !settings.zenMode })
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
        run: async () => {
          if (!activeTab) return
          const res = await window.klartext.exportHtml({
            rootId: activeTab.rootId,
            relativePath: activeTab.relativePath,
            markdown: activeTab.content,
            title: activeTab.relativePath
          })
          setExportStatusBanner(`Exported HTML to ${res.outputPath}`)
        }
      }
    ],
    [activeTab, resolvedTheme, settings, refreshWorkspaceAndTrees]
  )

  const headings = useMemo(
    () => (activeTab ? extractHeadings(activeTab.content) : []),
    [activeTab?.content]
  )

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
          <div className="flex items-center gap-2 titlebar-no-drag pl-14">
            <button
              type="button"
              title="Toggle Left Sidebar (Mod+B)"
              aria-label="Toggle Left Sidebar"
              data-testid="toggle-left-sidebar-btn"
              onClick={() =>
                handleUpdateSettings({ leftSidebarOpen: !settings.leftSidebarOpen })
              }
              className={`p-1 rounded hover:bg-secondary ${
                settings.leftSidebarOpen ? 'text-accent' : 'text-muted'
              }`}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold tracking-tight text-primary">Klartext</span>
          </div>

          {/* Center Mode Switcher (Source / Inline Rich / Split) & Command Palette Trigger */}
          <div className="flex items-center gap-2 titlebar-no-drag">
            <div
              className="flex items-center bg-secondary p-0.5 rounded-md border border-subtle"
              data-testid="edit-mode-switcher"
            >
              {(
                [
                  { id: 'source', label: 'Source' },
                  { id: 'inline', label: 'Inline Rich' },
                  { id: 'split', label: 'Split' }
                ] as Array<{ id: EditMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`mode-btn-${m.id}`}
                  onClick={() => setEditMode(m.id)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    editMode === m.id
                      ? 'bg-panel text-accent shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="open-command-palette-btn"
              onClick={() => setPaletteMode('commands')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-subtle text-muted hover:text-primary hover:border-accent"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Command Palette</span>
              <kbd className="text-[10px] font-mono opacity-75">⌘K</kbd>
            </button>

            <button
              type="button"
              data-testid="open-quick-switcher-btn"
              onClick={() => setPaletteMode('files')}
              className="px-2 py-1 rounded bg-panel border border-subtle text-muted hover:text-primary"
            >
              Quick Open (⌘P)
            </button>
          </div>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-1.5 titlebar-no-drag">
            <button
              type="button"
              title="Export Standalone HTML"
              aria-label="Export HTML"
              data-testid="export-html-btn"
              onClick={async () => {
                if (!activeTab) return
                const res = await window.klartext.exportHtml({
                  rootId: activeTab.rootId,
                  relativePath: activeTab.relativePath,
                  markdown: activeTab.content,
                  title: activeTab.relativePath
                })
                setExportStatusBanner(`Exported HTML: ${res.outputPath}`)
              }}
              className="px-2 py-1 rounded bg-panel border border-subtle text-primary hover:border-accent flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HTML</span>
            </button>

            <button
              type="button"
              title="Export PDF"
              aria-label="Export PDF"
              data-testid="export-pdf-btn"
              onClick={async () => {
                if (!activeTab) return
                const res = await window.klartext.exportPdf({
                  rootId: activeTab.rootId,
                  relativePath: activeTab.relativePath,
                  markdown: activeTab.content,
                  title: activeTab.relativePath
                })
                setExportStatusBanner(`Exported PDF (${res.sizeBytes} bytes): ${res.outputPath}`)
              }}
              className="px-2 py-1 rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              PDF
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

            <button
              type="button"
              title="Switch Theme (Light / Dark)"
              aria-label="Switch Theme"
              data-testid="toggle-theme-btn"
              onClick={() =>
                handleUpdateSettings({
                  theme: resolvedTheme === 'dark' ? 'light' : 'dark'
                })
              }
              className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              title="Open Settings"
              aria-label="Open Settings"
              data-testid="open-settings-btn"
              onClick={() => setShowSettingsModal(true)}
              className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Toggle Local AI Panel"
              aria-label="Toggle Local AI Panel"
              data-testid="toggle-right-sidebar-btn"
              onClick={() =>
                handleUpdateSettings({ rightSidebarOpen: !settings.rightSidebarOpen })
              }
              className={`flex items-center gap-1 px-2 py-1 rounded border border-subtle ${
                settings.rightSidebarOpen
                  ? 'bg-accent text-white'
                  : 'bg-panel text-primary hover:border-accent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI ({settings.ai.activeModel})</span>
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

      {/* Main Workspace Area: Collapsible Left Sidebar + Editor Canvas + Collapsible Right AI Panel */}
      <div className="flex-1 flex overflow-hidden">
        {!settings.zenMode && settings.leftSidebarOpen && (
          <div
            style={{ width: settings.leftSidebarWidth }}
            className="h-full shrink-0 nordic-panel-transition"
          >
            <MultiRootSidebar
              activeTab={leftSidebarTab}
              onSelectTab={setLeftSidebarTab}
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
        )}

        {/* Center Document Tabs + Editor */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-panel">
          {/* Root-Disambiguated Document Tab Bar */}
          {!settings.zenMode && tabs.length > 0 && (
            <div
              data-testid="document-tab-bar"
              className="flex items-center bg-app border-b border-subtle px-2 pt-1 gap-1 overflow-x-auto text-xs shrink-0"
            >
              {tabs.map((tab) => {
                const isCurrent = tab.key === activeTab?.key
                return (
                  <div
                    key={tab.key}
                    data-testid={`doc-tab-${tab.rootId}-${tab.relativePath}`}
                    onClick={() => setActiveTabKey(tab.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md border-t border-x cursor-pointer ${
                      isCurrent
                        ? 'bg-panel border-subtle text-primary font-medium'
                        : 'bg-secondary/50 border-transparent text-muted hover:text-primary'
                    }`}
                  >
                    <span>
                      {tab.relativePath}
                      {tab.dirty ? ' •' : ''}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-secondary text-[10px] text-accent">
                      {tab.rootName}
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
                        className="text-muted hover:text-danger"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* External Modification Conflict Banner on Dirty Buffer */}
          {activeTab?.externalConflictContent !== undefined && (
            <div
              data-testid="external-disk-conflict-banner"
              className="px-4 py-2 bg-secondary border-b border-warning flex items-center justify-between text-xs"
            >
              <span className="text-warning font-medium">
                This file was modified externally on disk while you have unsaved edits in Klartext.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="keep-local-edits-btn"
                  onClick={() => {
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.key === activeTab.key
                          ? { ...t, externalConflictContent: undefined }
                          : t
                      )
                    )
                  }}
                  className="px-2.5 py-1 rounded bg-panel border border-subtle text-primary"
                >
                  Keep Local Version
                </button>
                <button
                  type="button"
                  data-testid="accept-disk-version-btn"
                  onClick={() => {
                    const diskText = activeTab.externalConflictContent!
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.key === activeTab.key
                          ? {
                              ...t,
                              content: diskText,
                              savedContent: diskText,
                              dirty: false,
                              externalConflictContent: undefined
                            }
                          : t
                      )
                    )
                  }}
                  className="px-2.5 py-1 rounded bg-accent text-white font-medium"
                >
                  Accept Disk Version
                </button>
              </div>
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
              aiEnabled={settings.ai.enabled}
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
              onNavigateWikiLink={(target) => {
                const clean = target.endsWith('.md') ? target : `${target}.md`
                openDocument(activeTab.rootId, clean)
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              Select or create a Markdown document in any root folder.
            </div>
          )}
        </main>

        {/* Right Collapsible Local AI Assistant & Hardware Advisor Panel */}
        {!settings.zenMode && settings.rightSidebarOpen && (
          <div
            style={{ width: settings.rightSidebarWidth }}
            className="h-full shrink-0 nordic-panel-transition"
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
        )}
      </div>

      {/* Collapsible Bottom Status Bar */}
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
            <span>Mode: {editMode}</span>
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
