import React, { useEffect, useRef, useState } from 'react'
import {
  Folder,
  FolderPlus,
  FolderInput,
  FilePlus,
  Trash2,
  GitBranch,
  RefreshCw,
  AlertTriangle,
  Search as SearchIcon,
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Edit3,
  Copy,
  ClipboardPaste,
  Check,
  Code2,
  Eye,
  Columns,
  Command,
  List,
  Link2
} from 'lucide-react'
import type {
  BacklinkItem,
  EditMode,
  FileTreeNode,
  GitRepoStatus,
  SearchFileResult,
  WorkspaceRoot
} from '../../../shared/types'
import type { HeadingItem } from '../../../shared/markdown/pipeline'

export type LeftSidebarTab = 'explorer' | 'search' | 'outline' | 'backlinks' | 'git'

export const MultiRootSidebar: React.FC<{
  activeTab: LeftSidebarTab
  onSelectTab: (tab: LeftSidebarTab) => void
  onCollapseSidebar?: () => void
  showOutlineTab?: boolean
  showBacklinksTab?: boolean
  sidebarControlBarVisible?: boolean
  editMode?: EditMode
  onChangeEditMode?: (mode: EditMode) => void
  onOpenCommandPalette?: () => void
  onOpenQuickSwitcher?: () => void
  roots: WorkspaceRoot[]
  treesByRoot: Record<string, FileTreeNode[]>
  gitStatuses: Record<string, GitRepoStatus>
  activeDoc: { rootId: string; relativePath: string } | null
  headings: HeadingItem[]
  backlinks: BacklinkItem[]
  onOpenDocument: (rootId: string, relativePath: string) => void
  onNavigateToLine: (rootId: string, relativePath: string, lineNumber: number) => void
  onAddRootDialog: () => void
  onAddRootByPath: (folderPath: string, name?: string) => void
  onRemoveRoot: (rootId: string) => void
  onCreateFileInRoot: (rootId: string, relativePath: string) => Promise<void> | void
  onDeleteFileInRoot?: (rootId: string, relativePath: string) => Promise<void> | void
  onRenameFileInRoot?: (
    rootId: string,
    oldRelativePath: string,
    newRelativePath: string
  ) => Promise<void> | void
  onMoveFileCrossRoot: (
    sourceRootId: string,
    sourceRelativePath: string,
    targetRootId: string
  ) => void
  onSyncAllRepos: () => void
  onRefreshGit: () => void
  onCommitRepo: (rootId: string, message: string) => void
  onResolveConflictFromGitPanel: (
    rootId: string,
    relativePath: string,
    resolution: 'current' | 'incoming' | 'both'
  ) => void
  onAbortMergeRepo: (rootId: string) => void
}> = ({
  activeTab,
  onSelectTab,
  showOutlineTab = true,
  showBacklinksTab = true,
  sidebarControlBarVisible = true,
  editMode = 'inline',
  onChangeEditMode,
  onOpenCommandPalette,
  onOpenQuickSwitcher,
  roots,
  treesByRoot,
  gitStatuses,
  activeDoc,
  headings,
  backlinks,
  onOpenDocument,
  onNavigateToLine,
  onAddRootDialog,
  onAddRootByPath,
  onRemoveRoot,
  onCreateFileInRoot,
  onDeleteFileInRoot,
  onRenameFileInRoot,
  onMoveFileCrossRoot,
  onSyncAllRepos,
  onRefreshGit,
  onCommitRepo,
  onResolveConflictFromGitPanel,
  onAbortMergeRepo
}) => {
  const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({})
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({})
  const [customRootPath, setCustomRootPath] = useState('')
  const [showAddPathInput, setShowAddPathInput] = useState(false)

  // Inline file rename state (triggered immediately when creating Untitled.md or double-clicking)
  const [renamingItem, setRenamingItem] = useState<{
    rootId: string
    relativePath: string
    draftName: string
  } | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  // File Explorer Right-Click Context Menu & Copy/Paste Clipboard
  const [fileContextMenu, setFileContextMenu] = useState<{
    x: number
    y: number
    rootId: string
    relativePath: string
    name: string
    isDirectory: boolean
  } | null>(null)

  const [copiedFileClipboard, setCopiedFileClipboard] = useState<{
    rootId: string
    relativePath: string
    name: string
  } | null>(null)

  // Search state (Instant search-as-you-type)
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [selectedSearchRoot, setSelectedSearchRoot] = useState<string>('ALL')
  const [searchResults, setSearchResults] = useState<SearchFileResult[]>([])
  const [checkedReplaceFiles, setCheckedReplaceFiles] = useState<Record<string, boolean>>({})
  const [replaceSummary, setReplaceSummary] = useState<string>('')

  // Git commit messages per root
  const [commitMessages, setCommitMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    const closeMenu = () => setFileContextMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  useEffect(() => {
    if (renamingItem && renameInputRef.current) {
      renameInputRef.current.focus()
      const dotIdx = renamingItem.draftName.lastIndexOf('.')
      if (dotIdx > 0) {
        renameInputRef.current.setSelectionRange(0, dotIdx)
      } else {
        renameInputRef.current.select()
      }
    }
  }, [renamingItem?.rootId, renamingItem?.relativePath])

  const runSearchQuery = async (q: string, rootScope: string) => {
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    const res = await window.klartext.searchWorkspace({
      query: q,
      rootIds: rootScope === 'ALL' ? undefined : [rootScope]
    })
    setSearchResults(res)
    const initialChecks: Record<string, boolean> = {}
    for (const item of res) {
      initialChecks[`${item.rootId}::${item.relativePath}`] = true
    }
    setCheckedReplaceFiles(initialChecks)
  }

  // Live instant search-as-you-type whenever searchQuery or selectedSearchRoot changes
  useEffect(() => {
    const timer = setTimeout(() => {
      runSearchQuery(searchQuery, selectedSearchRoot)
    }, 60)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedSearchRoot])

  const handleExecuteReplace = async () => {
    const confirmedFiles = searchResults
      .filter((r) => checkedReplaceFiles[`${r.rootId}::${r.relativePath}`])
      .map((r) => ({ rootId: r.rootId, relativePath: r.relativePath }))
    if (confirmedFiles.length === 0) return

    const res = await window.klartext.replaceInWorkspace({
      search: {
        query: searchQuery,
        rootIds: selectedSearchRoot === 'ALL' ? undefined : [selectedSearchRoot]
      },
      replacement: replaceText,
      confirmedFiles
    })
    setReplaceSummary(
      `Replaced ${res.totalReplacements} occurrence(s) across ${res.replacedFilesCount} file(s).`
    )
    await runSearchQuery(searchQuery, selectedSearchRoot)
  }

  const commitInlineRename = async () => {
    if (!renamingItem) return
    const { rootId, relativePath, draftName } = renamingItem
    setRenamingItem(null)
    const cleanDraft = draftName.trim()
    if (!cleanDraft) return
    const finalFileName = cleanDraft.includes('.') ? cleanDraft : `${cleanDraft}.md`
    const dirParts = relativePath.split('/')
    dirParts.pop()
    const newRelPath = dirParts.length > 0 ? `${dirParts.join('/')}/${finalFileName}` : finalFileName
    if (newRelPath === relativePath) {
      onOpenDocument(rootId, relativePath)
      return
    }
    if (onRenameFileInRoot) {
      await onRenameFileInRoot(rootId, relativePath, newRelPath)
    }
  }

  const handleCreateUntitledFile = async (rootId: string, parentDir = '') => {
    const existingNodes = treesByRoot[rootId] || []
    const existingNames = new Set(existingNodes.map((n) => n.name.toLowerCase()))
    let candidateName = 'Untitled.md'
    let counter = 1
    while (existingNames.has(candidateName.toLowerCase())) {
      candidateName = `Untitled-${counter}.md`
      counter++
    }
    const candidateRel = parentDir ? `${parentDir}/${candidateName}` : candidateName
    await onCreateFileInRoot(rootId, candidateRel)
    setCollapsedRoots((p) => ({ ...p, [rootId]: false }))
    setRenamingItem({
      rootId,
      relativePath: candidateRel,
      draftName: candidateName
    })
  }

  const handleCreateNewSubfolder = async (rootId: string) => {
    const existingNodes = treesByRoot[rootId] || []
    const existingNames = new Set(existingNodes.map((n) => n.name.toLowerCase()))
    let folderName = 'New-Folder'
    let counter = 1
    while (existingNames.has(folderName.toLowerCase())) {
      folderName = `New-Folder-${counter}`
      counter++
    }
    const newDocRel = `${folderName}/Untitled.md`
    await onCreateFileInRoot(rootId, newDocRel)
    setCollapsedRoots((p) => ({ ...p, [rootId]: false }))
    setRenamingItem({
      rootId,
      relativePath: newDocRel,
      draftName: 'Untitled.md'
    })
  }

  const handlePasteCopiedFile = async (targetRootId: string, targetDir = '') => {
    if (!copiedFileClipboard) return
    try {
      const sourceDoc = await window.klartext.readDocument(
        copiedFileClipboard.rootId,
        copiedFileClipboard.relativePath
      )
      const dotIdx = copiedFileClipboard.name.lastIndexOf('.')
      const base =
        dotIdx > 0 ? copiedFileClipboard.name.slice(0, dotIdx) : copiedFileClipboard.name
      const ext = dotIdx > 0 ? copiedFileClipboard.name.slice(dotIdx) : '.md'
      const pastedName = `${base}-copy${ext}`
      const pastedRelPath = targetDir ? `${targetDir}/${pastedName}` : pastedName
      await onCreateFileInRoot(targetRootId, pastedRelPath)
      await window.klartext.writeDocument(targetRootId, pastedRelPath, sourceDoc.content)
      onOpenDocument(targetRootId, pastedRelPath)
    } catch {
      // Ignore if binary or unreadable
    }
  }

  const handleDeleteTreeFile = async (rootId: string, relativePath: string) => {
    if (onDeleteFileInRoot) {
      await onDeleteFileInRoot(rootId, relativePath)
    } else {
      await window.klartext.deleteDocument(rootId, relativePath)
    }
  }

  const renderTreeNodes = (rootId: string, nodes: FileTreeNode[]) => {
    return nodes.map((node) => {
      if (node.isDirectory) {
        const dirKey = `${rootId}/${node.relativePath}`
        const isDirCollapsed = Boolean(collapsedDirs[dirKey])
        return (
          <div key={dirKey} className="pl-2.5">
            <div
              onClick={() => setCollapsedDirs((p) => ({ ...p, [dirKey]: !p[dirKey] }))}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFileContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  rootId,
                  relativePath: node.relativePath,
                  name: node.name,
                  isDirectory: true
                })
              }}
              className="flex items-center gap-1.5 py-1 text-xs font-medium text-muted hover:text-primary cursor-pointer"
            >
              {isDirCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span>{node.name}</span>
            </div>
            {!isDirCollapsed && node.children && renderTreeNodes(rootId, node.children)}
          </div>
        )
      }

      const isActive =
        activeDoc?.rootId === rootId && activeDoc?.relativePath === node.relativePath
      const isRenaming =
        renamingItem?.rootId === rootId && renamingItem?.relativePath === node.relativePath
      const otherRoots = roots.filter((r) => r.id !== rootId)

      return (
        <div
          key={`${rootId}/${node.relativePath}`}
          data-testid={`tree-file-${rootId}-${node.relativePath}`}
          className={`group flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer ${
            isActive
              ? 'bg-secondary text-accent font-medium'
              : 'text-primary hover:bg-secondary/60'
          }`}
          onClick={() => {
            if (!isRenaming) onOpenDocument(rootId, node.relativePath)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setRenamingItem({
              rootId,
              relativePath: node.relativePath,
              draftName: node.name
            })
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setFileContextMenu({
              x: e.clientX,
              y: e.clientY,
              rootId,
              relativePath: node.relativePath,
              name: node.name,
              isDirectory: false
            })
          }}
        >
          <div className="flex items-center gap-1.5 truncate flex-1">
            <FileText className="w-3.5 h-3.5 shrink-0 text-muted" />
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                data-testid={`inline-rename-input-${rootId}`}
                value={renamingItem.draftName}
                onChange={(e) =>
                  setRenamingItem((prev) =>
                    prev ? { ...prev, draftName: e.target.value } : null
                  )
                }
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitInlineRename()
                  } else if (e.key === 'Escape') {
                    setRenamingItem(null)
                  }
                }}
                onBlur={() => commitInlineRename()}
                className="flex-1 px-1.5 py-0.5 rounded bg-panel border border-accent text-primary text-xs focus:outline-none"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>
          {!isRenaming && otherRoots.length > 0 && (
            <button
              type="button"
              title={`Move ${node.name} to ${otherRoots[0].name} (with assets)`}
              data-testid={`move-cross-root-${rootId}-${node.relativePath}`}
              onClick={(e) => {
                e.stopPropagation()
                onMoveFileCrossRoot(rootId, node.relativePath, otherRoots[0].id)
              }}
              className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded bg-panel border border-subtle text-[10px] text-muted hover:text-primary"
            >
              <ArrowRightLeft className="w-3 h-3 inline mr-0.5" />
              Move
            </button>
          )}
        </div>
      )
    })
  }

  const visibleTabs = (
    [
      {
        id: 'explorer',
        label: 'Files',
        icon: <Folder className="w-3.5 h-3.5" />,
        visible: true
      },
      {
        id: 'search',
        label: 'Search',
        icon: <SearchIcon className="w-3.5 h-3.5" />,
        visible: true
      },
      {
        id: 'outline',
        label: 'Outline',
        icon: <List className="w-3.5 h-3.5" />,
        visible: showOutlineTab
      },
      {
        id: 'backlinks',
        label: 'Links',
        icon: <Link2 className="w-3.5 h-3.5" />,
        visible: showBacklinksTab
      },
      {
        id: 'git',
        label: 'Git',
        icon: <GitBranch className="w-3.5 h-3.5" />,
        visible: true
      }
    ] as Array<{
      id: LeftSidebarTab
      label: string
      icon: React.ReactNode
      visible: boolean
    }>
  ).filter((t) => t.visible)

  return (
    <aside
      data-testid="left-sidebar"
      className="h-full flex flex-col bg-app border-r border-subtle select-none overflow-hidden relative"
    >
      {/* TAB 1: MULTI-ROOT FILE EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-2 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Workspace Roots ({roots.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Mount Root Folder by Path"
                data-testid="toggle-add-root-path-btn"
                onClick={() => setShowAddPathInput((v) => !v)}
                className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Open Folder Dialog"
                data-testid="add-folder-dialog-btn"
                onClick={onAddRootDialog}
                className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showAddPathInput && (
            <div className="p-2 rounded bg-panel border border-subtle space-y-1.5 text-xs">
              <input
                type="text"
                data-testid="add-root-path-input"
                placeholder="/absolute/path/to/folder"
                value={customRootPath}
                onChange={(e) => setCustomRootPath(e.target.value)}
                className="w-full px-2 py-1 rounded bg-app border border-subtle text-primary"
              />
              <button
                type="button"
                data-testid="confirm-add-root-path-btn"
                onClick={() => {
                  if (customRootPath.trim()) {
                    onAddRootByPath(customRootPath.trim())
                    setCustomRootPath('')
                    setShowAddPathInput(false)
                  }
                }}
                className="w-full py-1 rounded bg-accent text-white font-medium"
              >
                Mount Root Folder
              </button>
            </div>
          )}

          {roots.map((root) => {
            const isCollapsed = Boolean(collapsedRoots[root.id])
            const gitStatus = gitStatuses[root.id]
            const nodes = treesByRoot[root.id] || []

            return (
              <div
                key={root.id}
                data-testid={`workspace-root-section-${root.id}`}
                className="rounded-md border border-subtle bg-panel overflow-hidden"
              >
                <div className="flex items-center justify-between px-2 py-1.5 bg-secondary/60 border-b border-subtle text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedRoots((p) => ({ ...p, [root.id]: !p[root.id] }))
                    }
                    className="flex items-center gap-1 font-semibold text-primary truncate"
                    title={root.path}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{root.name}</span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      data-testid={`root-git-badge-${root.id}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded border border-subtle ${
                        gitStatus?.state === 'Merge Conflict'
                          ? 'text-danger font-semibold'
                          : 'text-muted'
                      }`}
                    >
                      {gitStatus?.isGitRepo
                        ? `${gitStatus.branch} · ${gitStatus.state}`
                        : 'Local'}
                    </span>
                    <button
                      type="button"
                      title="Create New File (Untitled.md)"
                      data-testid={`new-file-btn-${root.id}`}
                      onClick={() => handleCreateUntitledFile(root.id)}
                      className="p-0.5 rounded hover:bg-panel text-muted hover:text-primary"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Create New Subfolder"
                      data-testid={`new-folder-btn-${root.id}`}
                      onClick={() => handleCreateNewSubfolder(root.id)}
                      className="p-0.5 rounded hover:bg-panel text-muted hover:text-primary"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    {roots.length > 1 && (
                      <button
                        type="button"
                        title="Remove Root from Workspace"
                        data-testid={`remove-root-btn-${root.id}`}
                        onClick={() => onRemoveRoot(root.id)}
                        className="p-0.5 rounded hover:bg-panel text-muted hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-1.5 space-y-0.5">
                    {nodes.length === 0 ? (
                      <div className="text-xs text-muted px-2 py-1">Empty folder</div>
                    ) : (
                      renderTreeNodes(root.id, nodes)
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Right-Click File Context Menu (Rename, Copy, Paste, Delete) */}
      {fileContextMenu && (
        <div
          data-testid="file-tree-context-menu"
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 180, fileContextMenu.x)}px`,
            top: `${Math.min(window.innerHeight - 160, fileContextMenu.y)}px`
          }}
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-44 rounded-md bg-panel border border-subtle shadow-xl py-1 text-xs"
        >
          <div className="px-2.5 py-1 border-b border-subtle text-[10px] font-mono text-muted truncate">
            {fileContextMenu.name}
          </div>
          {!fileContextMenu.isDirectory && (
            <button
              type="button"
              data-testid="context-menu-rename"
              onClick={() => {
                setRenamingItem({
                  rootId: fileContextMenu.rootId,
                  relativePath: fileContextMenu.relativePath,
                  draftName: fileContextMenu.name
                })
                setFileContextMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5 text-muted" />
              <span>Rename</span>
            </button>
          )}
          {!fileContextMenu.isDirectory && (
            <button
              type="button"
              data-testid="context-menu-copy"
              onClick={() => {
                setCopiedFileClipboard({
                  rootId: fileContextMenu.rootId,
                  relativePath: fileContextMenu.relativePath,
                  name: fileContextMenu.name
                })
                setFileContextMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5 text-muted" />
              <span>Copy</span>
            </button>
          )}
          <button
            type="button"
            data-testid="context-menu-paste"
            disabled={!copiedFileClipboard}
            onClick={() => {
              const targetDir = fileContextMenu.isDirectory
                ? fileContextMenu.relativePath
                : fileContextMenu.relativePath.includes('/')
                  ? fileContextMenu.relativePath.slice(
                      0,
                      fileContextMenu.relativePath.lastIndexOf('/')
                    )
                  : ''
              handlePasteCopiedFile(fileContextMenu.rootId, targetDir)
              setFileContextMenu(null)
            }}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 ${
              copiedFileClipboard
                ? 'hover:bg-secondary text-primary'
                : 'text-muted/50 cursor-not-allowed'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-muted" />
            <span>
              Paste{copiedFileClipboard ? ` (${copiedFileClipboard.name})` : ''}
            </span>
          </button>
          {!fileContextMenu.isDirectory && (
            <>
              <div className="my-1 border-t border-subtle" />
              <button
                type="button"
                data-testid="context-menu-delete"
                onClick={() => {
                  handleDeleteTreeFile(
                    fileContextMenu.rootId,
                    fileContextMenu.relativePath
                  )
                  setFileContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5 text-muted" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* TAB 2: MULTI-ROOT INSTANT SEARCH & REPLACE (Search-As-You-Type, no manual search button) */}
      {activeTab === 'search' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-2.5 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-muted uppercase text-[10px]">
              Scope Root Filter
            </label>
            <select
              data-testid="search-root-filter"
              value={selectedSearchRoot}
              onChange={(e) => setSelectedSearchRoot(e.target.value)}
              className="w-full px-2 py-1 rounded bg-panel border border-subtle text-primary"
            >
              <option value="ALL">All Mounted Roots ({roots.length})</option>
              {roots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="relative flex items-center">
              <SearchIcon className="w-3.5 h-3.5 text-muted absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                data-testid="global-search-input"
                placeholder="Type to search instantly across roots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-1">
              <input
                type="text"
                data-testid="global-replace-input"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="flex-1 px-2 py-1 rounded bg-panel border border-subtle text-primary"
              />
              <button
                type="button"
                data-testid="global-replace-confirm-btn"
                onClick={handleExecuteReplace}
                className="px-2 py-1 rounded bg-secondary border border-subtle hover:border-accent text-primary font-medium"
              >
                Replace Checked
              </button>
            </div>
          </div>

          {replaceSummary && (
            <div
              data-testid="search-replace-summary"
              className="p-2 rounded bg-secondary border border-subtle text-success font-medium"
            >
              {replaceSummary}
            </div>
          )}

          <div className="space-y-2 pt-1">
            {searchResults.map((fileHit) => {
              const key = `${fileHit.rootId}::${fileHit.relativePath}`
              return (
                <div
                  key={key}
                  data-testid={`search-result-card-${fileHit.rootId}-${fileHit.relativePath}`}
                  className="p-2 rounded bg-panel border border-subtle space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 font-semibold text-primary truncate">
                      <input
                        type="checkbox"
                        checked={Boolean(checkedReplaceFiles[key])}
                        onChange={(e) =>
                          setCheckedReplaceFiles((p) => ({
                            ...p,
                            [key]: e.target.checked
                          }))
                        }
                      />
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-accent">
                        {fileHit.rootName}
                      </span>
                      <span
                        className="truncate cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.preventDefault()
                          onNavigateToLine(
                            fileHit.rootId,
                            fileHit.relativePath,
                            fileHit.matches[0]?.lineNumber || 1
                          )
                        }}
                      >
                        {fileHit.relativePath}
                      </span>
                    </label>
                    <span className="text-[10px] text-muted">{fileHit.matches.length}</span>
                  </div>
                  {fileHit.matches.slice(0, 6).map((m, idx) => (
                    <div
                      key={idx}
                      data-testid={`search-match-line-${fileHit.rootId}-${fileHit.relativePath}-${m.lineNumber}`}
                      onClick={() =>
                        onNavigateToLine(fileHit.rootId, fileHit.relativePath, m.lineNumber)
                      }
                      className="pl-4 py-0.5 rounded text-[11px] font-mono text-muted truncate cursor-pointer hover:bg-secondary hover:text-primary"
                    >
                      L{m.lineNumber}: {m.lineText}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: OUTLINE PANEL */}
      {activeTab === 'outline' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs" data-testid="outline-panel">
          <div className="text-[10px] font-semibold uppercase text-muted mb-2">
            Document Outline ({headings.length})
          </div>
          {headings.map((h) => (
            <div
              key={`${h.id}-${h.line}`}
              data-testid={`outline-heading-line-${h.line}`}
              onClick={() => {
                if (activeDoc) {
                  onNavigateToLine(activeDoc.rootId, activeDoc.relativePath, h.line)
                }
              }}
              style={{ paddingLeft: `${(h.depth - 1) * 10}px` }}
              className="py-1 px-2 rounded hover:bg-secondary cursor-pointer text-primary truncate flex items-center justify-between"
            >
              <div className="truncate">
                <span className="text-muted mr-1.5 font-mono text-[10px]">H{h.depth}</span>
                <span>{h.text}</span>
              </div>
              <span className="text-[10px] font-mono text-muted ml-2">L{h.line}</span>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: BACKLINKS PANEL */}
      {activeTab === 'backlinks' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs" data-testid="backlinks-panel">
          <div className="text-[10px] font-semibold uppercase text-muted">
            Incoming WikiLinks ({backlinks.length})
          </div>
          {backlinks.length === 0 ? (
            <div className="text-muted">No documents link to this file yet.</div>
          ) : (
            backlinks.map((bl, idx) => (
              <div
                key={idx}
                onClick={() =>
                  onNavigateToLine(bl.sourceRootId, bl.sourceRelativePath, bl.lineNumber)
                }
                className="p-2 rounded bg-panel border border-subtle cursor-pointer hover:border-accent space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{bl.sourceRelativePath}</span>
                  <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-accent">
                    {bl.sourceRootName}
                  </span>
                </div>
                {bl.isCrossRoot && (
                  <div className="text-[10px] text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Cross-repository link
                  </div>
                )}
                <div className="text-[11px] font-mono text-muted truncate">
                  L{bl.lineNumber}: {bl.excerpt}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: MULTI-REPOSITORY GIT SOURCE CONTROL */}
      {activeTab === 'git' && (
        <div
          className="flex-1 overflow-y-auto p-3 space-y-3 text-xs"
          data-testid="multi-repo-git-panel"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase text-[10px] text-muted">
              Multi-Repo Source Control
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Refresh All Statuses"
                onClick={onRefreshGit}
                className="p-1 rounded bg-panel border border-subtle hover:border-accent"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                type="button"
                data-testid="sync-all-repos-btn"
                onClick={onSyncAllRepos}
                className="px-2 py-1 rounded bg-accent text-white font-medium flex items-center gap-1"
              >
                <GitBranch className="w-3 h-3" />
                <span>Sync All Repos</span>
              </button>
            </div>
          </div>

          {roots.map((root) => {
            const st = gitStatuses[root.id]
            if (!st) return null

            return (
              <div
                key={root.id}
                data-testid={`git-repo-card-${root.id}`}
                className="p-2.5 rounded-md bg-panel border border-subtle space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{root.name}</span>
                  <span
                    data-testid={`git-repo-state-${root.id}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      st.state === 'Merge Conflict'
                        ? 'bg-danger/15 text-danger'
                        : st.state === 'Synced'
                          ? 'bg-success/15 text-success'
                          : 'bg-secondary text-primary'
                    }`}
                  >
                    {st.state}
                  </span>
                </div>

                {st.isGitRepo && (
                  <>
                    <div className="text-[11px] text-muted flex items-center justify-between">
                      <span>Branch: {st.branch}</span>
                      <span>
                        ↑{st.ahead} ↓{st.behind}
                      </span>
                    </div>

                    {/* Pinned Conflicted Files Group */}
                    {st.conflictedFiles.length > 0 && (
                      <div
                        data-testid={`git-conflicted-group-${root.id}`}
                        className="p-2 rounded bg-secondary border border-danger/40 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-danger font-semibold">
                          <span>Conflicted Files ({st.conflictedFiles.length})</span>
                          <button
                            type="button"
                            data-testid={`git-abort-merge-${root.id}`}
                            onClick={() => onAbortMergeRepo(root.id)}
                            className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary text-[10px]"
                          >
                            Abort Merge
                          </button>
                        </div>
                        {st.conflictedFiles.map((cf) => (
                          <div key={cf} className="space-y-1 pt-1 border-t border-subtle">
                            <div
                              onClick={() => onOpenDocument(root.id, cf)}
                              className="font-mono text-[11px] text-primary cursor-pointer hover:underline"
                            >
                              {cf}
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                data-testid={`git-resolve-current-${root.id}-${cf}`}
                                onClick={() =>
                                  onResolveConflictFromGitPanel(root.id, cf, 'current')
                                }
                                className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px]"
                              >
                                Accept Current
                              </button>
                              <button
                                type="button"
                                data-testid={`git-resolve-incoming-${root.id}-${cf}`}
                                onClick={() =>
                                  onResolveConflictFromGitPanel(root.id, cf, 'incoming')
                                }
                                className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px]"
                              >
                                Accept Incoming
                              </button>
                              <button
                                type="button"
                                data-testid={`git-resolve-both-${root.id}-${cf}`}
                                onClick={() => onResolveConflictFromGitPanel(root.id, cf, 'both')}
                                className="px-1.5 py-0.5 rounded bg-accent text-white text-[10px]"
                              >
                                Accept Both
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Commit Box */}
                    <div className="flex gap-1">
                      <input
                        type="text"
                        data-testid={`git-commit-input-${root.id}`}
                        placeholder={`Commit message (${root.name})...`}
                        value={commitMessages[root.id] || ''}
                        onChange={(e) =>
                          setCommitMessages((p) => ({ ...p, [root.id]: e.target.value }))
                        }
                        className="flex-1 px-2 py-1 rounded bg-app border border-subtle text-primary"
                      />
                      <button
                        type="button"
                        data-testid={`git-commit-btn-${root.id}`}
                        disabled={st.conflictedFiles.length > 0}
                        onClick={() => {
                          const msg = commitMessages[root.id]?.trim()
                          if (msg) {
                            onCommitRepo(root.id, msg)
                            setCommitMessages((p) => ({ ...p, [root.id]: '' }))
                          }
                        }}
                        className="px-2 py-1 rounded bg-accent text-white disabled:opacity-40"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom Left-Window Control Strip (Sidebar Tab Icons on the left + Source, Inline Rich, Split, Command Palette, Quick Open on the right — positioned directly above Root: and Local Workspace) */}
      {sidebarControlBarVisible !== false && (
        <div
          data-testid="left-sidebar-bottom-controls"
          className="px-1.5 py-1.5 bg-panel border-t border-subtle flex items-center justify-between gap-1 shrink-0"
        >
          {/* Left side: Sidebar Tab Icons (Files, Search, Outline, Links, Git) */}
          <div
            className="flex items-center bg-secondary p-0.5 rounded border border-subtle gap-0.5"
            data-testid="sidebar-tab-switcher"
          >
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-tooltip={tab.label}
                data-tooltip-pos="top"
                aria-label={tab.label}
                data-testid={`sidebar-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`p-1 rounded transition-colors ${
                  activeTab === tab.id
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tab.icon}
              </button>
            ))}
          </div>

          {/* Right side: Edit Mode Switcher (Code, Inline Rich, Split) + Command Palette & Quick Open */}
          <div className="flex items-center gap-1">
            <div
              className="flex items-center bg-secondary p-0.5 rounded border border-subtle gap-0.5"
              data-testid="edit-mode-switcher"
            >
              <button
                type="button"
                data-tooltip="Source Mode (⌘1)"
                data-tooltip-pos="top"
                aria-label="Source Mode"
                data-testid="mode-btn-source"
                onClick={() => onChangeEditMode?.('source')}
                className={`p-1 rounded transition-colors ${
                  editMode === 'source'
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Inline Rich Mode (⌘2)"
                data-tooltip-pos="top"
                aria-label="Inline Rich Mode"
                data-testid="mode-btn-inline"
                onClick={() => onChangeEditMode?.('inline')}
                className={`p-1 rounded transition-colors ${
                  editMode === 'inline'
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-tooltip="Split View Mode (⌘3)"
                data-tooltip-pos="top"
                aria-label="Split View Mode"
                data-testid="mode-btn-split"
                onClick={() => onChangeEditMode?.('split')}
                className={`p-1 rounded transition-colors ${
                  editMode === 'split'
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              data-tooltip="Command Palette (⌘K)"
              data-tooltip-pos="top"
              aria-label="Command Palette"
              data-testid="open-command-palette-btn"
              onClick={() => onOpenCommandPalette?.()}
              className="p-1 rounded bg-app border border-subtle text-muted hover:text-primary hover:border-accent"
            >
              <Command className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              data-tooltip="Quick Open File (⌘P)"
              data-tooltip-pos="top"
              aria-label="Quick Open"
              data-testid="open-quick-switcher-btn"
              onClick={() => onOpenQuickSwitcher?.()}
              className="p-1 rounded bg-app border border-subtle text-muted hover:text-primary hover:border-accent"
            >
              <SearchIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
