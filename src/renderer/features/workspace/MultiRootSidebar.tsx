import React, { useEffect, useRef, useState } from 'react'
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FileCode2,
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
  Link2,
  Star,
  Bookmark,
  Terminal,
  BookOpen,
  Archive,
  Layers,
  Cpu,
  Globe,
  Lock,
  Shield,
  Calendar,
  Sparkles,
  Compass,
  Zap,
  Feather,
  Box,
  Database,
  Briefcase,
  Tag,
   type LucideIcon
} from '../../components/icons/untitled-icons'
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

export interface NordicFolderIconOption {
  id: string
  label: string
  Icon: LucideIcon
  legacyAliases?: string[]
}

export const NORDIC_FOLDER_ICONS: NordicFolderIconOption[] = [
  { id: 'folder', label: 'Standard Folder', Icon: Folder, legacyAliases: ['📁', 'default'] },
  { id: 'folder-open', label: 'Open Folder', Icon: FolderOpen, legacyAliases: ['📂'] },
  { id: 'star', label: 'Star', Icon: Star, legacyAliases: ['⭐'] },
  { id: 'bookmark', label: 'Bookmark', Icon: Bookmark, legacyAliases: ['📌'] },
  { id: 'file-text', label: 'Notes', Icon: FileText, legacyAliases: ['📝'] },
  { id: 'book', label: 'Knowledge Base', Icon: BookOpen, legacyAliases: ['📚'] },
  { id: 'code', label: 'Code & Specs', Icon: Code2, legacyAliases: ['🔧'] },
  { id: 'terminal', label: 'Terminal & Scripts', Icon: Terminal, legacyAliases: ['🧪'] },
  { id: 'layers', label: 'Architecture', Icon: Layers, legacyAliases: ['🗂️'] },
  { id: 'archive', label: 'Archive', Icon: Archive, legacyAliases: ['📦'] },
  { id: 'calendar', label: 'Journal & Calendar', Icon: Calendar, legacyAliases: ['📅'] },
  { id: 'sparkles', label: 'Ideas & AI', Icon: Sparkles, legacyAliases: ['💡', '🧠'] },
  { id: 'zap', label: 'Sprint & Fast', Icon: Zap, legacyAliases: ['🚀', '🔥'] },
  { id: 'shield', label: 'Security', Icon: Shield, legacyAliases: ['🛡️'] },
  { id: 'lock', label: 'Private Vault', Icon: Lock },
  { id: 'globe', label: 'Web & Public', Icon: Globe, legacyAliases: ['🌐'] },
  { id: 'database', label: 'Data & Storage', Icon: Database, legacyAliases: ['📊'] },
  { id: 'cpu', label: 'Systems & Hardware', Icon: Cpu },
  { id: 'compass', label: 'Roadmap & Strategy', Icon: Compass },
  { id: 'feather', label: 'Writing & Drafts', Icon: Feather, legacyAliases: ['🎨'] },
  { id: 'briefcase', label: 'Projects & Work', Icon: Briefcase },
  { id: 'box', label: 'Packages & Assets', Icon: Box },
  { id: 'tag', label: 'Tags & Taxonomy', Icon: Tag },
  { id: 'check', label: 'Completed', Icon: Check, legacyAliases: ['✅'] }
]

function resolveNordicFolderIcon(iconKey?: string): NordicFolderIconOption {
  if (!iconKey) return NORDIC_FOLDER_ICONS[0]
  const found = NORDIC_FOLDER_ICONS.find(
    (item) => item.id === iconKey || item.legacyAliases?.includes(iconKey)
  )
  return found || NORDIC_FOLDER_ICONS[0]
}

const FOLDER_COLOR_PALETTE: Array<{ label: string; value: string }> = [
  { label: 'Default', value: '' },
  { label: 'Nordic Slate', value: 'rgba(66, 107, 121, 0.22)' },
  { label: 'Sage Green', value: 'rgba(59, 122, 87, 0.22)' },
  { label: 'Amber Gold', value: 'rgba(217, 119, 6, 0.22)' },
  { label: 'Soft Coral', value: 'rgba(225, 77, 77, 0.20)' },
  { label: 'Lavender', value: 'rgba(139, 92, 246, 0.22)' },
  { label: 'Sky Blue', value: 'rgba(2, 132, 199, 0.22)' },
  { label: 'Teal Mint', value: 'rgba(13, 148, 136, 0.22)' },
  { label: 'Rose Pink', value: 'rgba(219, 39, 119, 0.20)' }
]

function findNodesInDir(nodes: FileTreeNode[], dirRelPath: string): FileTreeNode[] {
  if (!dirRelPath) return nodes
  for (const n of nodes) {
    if (n.isDirectory) {
      if (n.relativePath === dirRelPath) return n.children || []
      if (dirRelPath.startsWith(`${n.relativePath}/`) && n.children) {
        return findNodesInDir(n.children, dirRelPath)
      }
    }
  }
  return []
}

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
  selectedFolder?: { rootId: string; relativePath: string } | null
  onSelectFolder?: (folder: { rootId: string; relativePath: string } | null) => void
  collapsedRoots?: Record<string, boolean>
  collapsedDirs?: Record<string, boolean>
  onUpdateCollapsedRoots?: (next: Record<string, boolean>) => void
  onUpdateCollapsedDirs?: (next: Record<string, boolean>) => void
  folderIcons?: Record<string, string>
  folderColors?: Record<string, string>
  onUpdateFolderIcon?: (folderKey: string, icon: string) => void
  onUpdateFolderColor?: (folderKey: string, color: string) => void
  availableTemplates?: Array<{ id: string; name: string; content: string }>
  onCreateNoteFromTemplateInFolder?: (
    rootId: string,
    folderRelativePath: string,
    templateName: string,
    templateContent: string
  ) => Promise<void> | void
  headings: HeadingItem[]
  backlinks: BacklinkItem[]
  onOpenDocument: (rootId: string, relativePath: string) => void
  onNavigateToLine: (rootId: string, relativePath: string, lineNumber: number) => void
  onAddRootDialog: () => void
  onAddRootByPath: (folderPath: string, name?: string) => void
  onRemoveRoot: (rootId: string) => void
  onCreateFileInRoot: (rootId: string, relativePath: string) => Promise<void> | void
  onCreateFolderInRoot?: (rootId: string, relativePath: string) => Promise<void> | void
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
  selectedFolder: externalSelectedFolder,
  onSelectFolder,
  collapsedRoots: externalCollapsedRoots,
  collapsedDirs: externalCollapsedDirs,
  onUpdateCollapsedRoots,
  onUpdateCollapsedDirs,
  folderIcons = {},
  folderColors = {},
  onUpdateFolderIcon,
  onUpdateFolderColor,
  availableTemplates = [],
  onCreateNoteFromTemplateInFolder,
  headings,
  backlinks,
  onOpenDocument,
  onNavigateToLine,
  onAddRootDialog,
  onRemoveRoot,
  onCreateFileInRoot,
  onCreateFolderInRoot,
  onDeleteFileInRoot,
  onRenameFileInRoot,
  onMoveFileCrossRoot,
  onSyncAllRepos,
  onRefreshGit,
  onCommitRepo,
  onResolveConflictFromGitPanel,
  onAbortMergeRepo
}) => {
  const [internalCollapsedRoots, setInternalCollapsedRoots] = useState<Record<string, boolean>>({})
  const [internalCollapsedDirs, setInternalCollapsedDirs] = useState<Record<string, boolean>>({})
  const [internalSelectedFolder, setInternalSelectedFolder] = useState<{
    rootId: string
    relativePath: string
  } | null>(null)

  const collapsedRoots =
    externalCollapsedRoots !== undefined ? externalCollapsedRoots : internalCollapsedRoots
  const setCollapsedRoots = (
    updater:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    const next = typeof updater === 'function' ? updater(collapsedRoots) : updater
    setInternalCollapsedRoots(next)
    onUpdateCollapsedRoots?.(next)
  }

  const collapsedDirs =
    externalCollapsedDirs !== undefined ? externalCollapsedDirs : internalCollapsedDirs
  const setCollapsedDirs = (
    updater:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    const next = typeof updater === 'function' ? updater(collapsedDirs) : updater
    setInternalCollapsedDirs(next)
    onUpdateCollapsedDirs?.(next)
  }

  const selectedFolder =
    externalSelectedFolder !== undefined ? externalSelectedFolder : internalSelectedFolder
  const setSelectedFolder = (next: { rootId: string; relativePath: string } | null) => {
    setInternalSelectedFolder(next)
    onSelectFolder?.(next)
  }

  const [hoveredRootBadge, setHoveredRootBadge] = useState<{
    rootId: string
    path: string
    x: number
    y: number
  } | null>(null)

  // Inline file or folder rename state (triggered immediately when creating Untitled.md / New-Folder or double-clicking / right-click Rename)
  const [renamingItem, setRenamingItem] = useState<{
    rootId: string
    relativePath: string
    draftName: string
    isDirectory?: boolean
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
  const [showContextTemplatesSubmenu, setShowContextTemplatesSubmenu] = useState(false)
  const [showContextFolderIconsSubmenu, setShowContextFolderIconsSubmenu] = useState(false)

  // Drag-and-drop state for moving folders and their contents (and files) within workspace
  const [draggedTreeItem, setDraggedTreeItem] = useState<{
    rootId: string
    relativePath: string
    name: string
    isDirectory: boolean
  } | null>(null)
  const [dragOverTargetKey, setDragOverTargetKey] = useState<string | null>(null)

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
    const closeMenu = () => {
      setFileContextMenu(null)
      setShowContextTemplatesSubmenu(false)
      setShowContextFolderIconsSubmenu(false)
    }
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  // Auto-disappear search & replace summary alert after 10 seconds
  useEffect(() => {
    if (!replaceSummary) return
    const timer = setTimeout(() => {
      setReplaceSummary('')
    }, 10000)
    return () => clearTimeout(timer)
  }, [replaceSummary])

  useEffect(() => {
    if (renamingItem && renameInputRef.current) {
      renameInputRef.current.focus()
      if (!renamingItem.isDirectory) {
        const dotIdx = renamingItem.draftName.lastIndexOf('.')
        if (dotIdx > 0) {
          renameInputRef.current.setSelectionRange(0, dotIdx)
          return
        }
      }
      renameInputRef.current.select()
    }
  }, [renamingItem?.rootId, renamingItem?.relativePath, renamingItem?.isDirectory])

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
    const { rootId, relativePath, draftName, isDirectory } = renamingItem
    setRenamingItem(null)
    const cleanDraft = draftName.trim()
    if (!cleanDraft) return

    if (isDirectory) {
      const sanitizedFolder = cleanDraft.replace(/[\\/]+/g, '-')
      const dirParts = relativePath.split('/')
      dirParts.pop()
      const newRelPath =
        dirParts.length > 0 ? `${dirParts.join('/')}/${sanitizedFolder}` : sanitizedFolder
      if (newRelPath === relativePath) return
      if (onRenameFileInRoot) {
        await onRenameFileInRoot(rootId, relativePath, newRelPath)
      }
      if (selectedFolder?.rootId === rootId && selectedFolder.relativePath === relativePath) {
        setSelectedFolder({ rootId, relativePath: newRelPath })
      }
      return
    }

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

  const handleCreateUntitledFile = async (rootId: string, explicitParentDir?: string) => {
    const parentDir =
      explicitParentDir !== undefined
        ? explicitParentDir
        : selectedFolder?.rootId === rootId
          ? selectedFolder.relativePath
          : ''
    const rootNodes = treesByRoot[rootId] || []
    const dirNodes = findNodesInDir(rootNodes, parentDir)
    const existingNames = new Set(dirNodes.map((n) => n.name.toLowerCase()))
    let candidateName = 'Untitled.md'
    let counter = 1
    while (existingNames.has(candidateName.toLowerCase())) {
      candidateName = `Untitled-${counter}.md`
      counter++
    }
    const candidateRel = parentDir ? `${parentDir}/${candidateName}` : candidateName
    await onCreateFileInRoot(rootId, candidateRel)
    setCollapsedRoots((p) => ({ ...p, [rootId]: false }))
    if (parentDir) {
      setCollapsedDirs((p) => ({ ...p, [`${rootId}/${parentDir}`]: false }))
    }
    setRenamingItem({
      rootId,
      relativePath: candidateRel,
      draftName: candidateName,
      isDirectory: false
    })
  }

  const handleCreateNewSubfolder = async (rootId: string, explicitParentDir?: string) => {
    const parentDir =
      explicitParentDir !== undefined
        ? explicitParentDir
        : selectedFolder?.rootId === rootId
          ? selectedFolder.relativePath
          : ''
    const rootNodes = treesByRoot[rootId] || []
    const dirNodes = findNodesInDir(rootNodes, parentDir)
    const existingNames = new Set(dirNodes.map((n) => n.name.toLowerCase()))
    let folderName = 'New-Folder'
    let counter = 1
    while (existingNames.has(folderName.toLowerCase())) {
      folderName = `New-Folder-${counter}`
      counter++
    }
    const newFolderRel = parentDir ? `${parentDir}/${folderName}` : folderName
    if (onCreateFolderInRoot) {
      await onCreateFolderInRoot(rootId, newFolderRel)
    } else {
      await window.klartext.createDirectory(rootId, newFolderRel)
    }
    setCollapsedRoots((p) => ({ ...p, [rootId]: false }))
    if (parentDir) {
      setCollapsedDirs((p) => ({ ...p, [`${rootId}/${parentDir}`]: false }))
    }
    setSelectedFolder({ rootId, relativePath: newFolderRel })
    setRenamingItem({
      rootId,
      relativePath: newFolderRel,
      draftName: folderName,
      isDirectory: true
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
    if (
      selectedFolder?.rootId === rootId &&
      (selectedFolder.relativePath === relativePath ||
        selectedFolder.relativePath.startsWith(`${relativePath}/`))
    ) {
      setSelectedFolder({ rootId, relativePath: '' })
    }
  }

  const resolveDraggedItem = (
    e: React.DragEvent
  ): { rootId: string; relativePath: string; name: string; isDirectory: boolean } | null => {
    if (draggedTreeItem) return draggedTreeItem
    try {
      const raw =
        e.dataTransfer?.getData('application/x-klartext-tree-item') ||
        e.dataTransfer?.getData('text/plain')
      if (raw) {
        return JSON.parse(raw)
      }
    } catch {
      // Ignore parse error
    }
    return null
  }

  const canDropTreeItemIntoFolder = (
    source: { rootId: string; relativePath: string; name: string; isDirectory: boolean } | null,
    targetRootId: string,
    targetFolderRelPath: string
  ): boolean => {
    if (!source) return false
    if (source.rootId !== targetRootId) return false
    if (source.relativePath === targetFolderRelPath) return false
    if (source.isDirectory && targetFolderRelPath.startsWith(`${source.relativePath}/`)) {
      return false
    }
    const nextRelPath = targetFolderRelPath
      ? `${targetFolderRelPath}/${source.name}`
      : source.name
    return nextRelPath !== source.relativePath
  }

  const handleDropIntoTarget = (
    targetRootId: string,
    targetFolderRelPath: string,
    e: React.DragEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const source = resolveDraggedItem(e)
    setDragOverTargetKey(null)
    setDraggedTreeItem(null)
    if (!canDropTreeItemIntoFolder(source, targetRootId, targetFolderRelPath) || !source) {
      return
    }
    const nextRelPath = targetFolderRelPath
      ? `${targetFolderRelPath}/${source.name}`
      : source.name
    setCollapsedRoots((p) => ({ ...p, [targetRootId]: false }))
    if (targetFolderRelPath) {
      setCollapsedDirs((p) => ({
        ...p,
        [`${targetRootId}/${targetFolderRelPath}`]: false
      }))
    }
    void onRenameFileInRoot?.(targetRootId, source.relativePath, nextRelPath)
  }

  const renderTreeNodes = (rootId: string, nodes: FileTreeNode[]) => {
    return nodes.map((node) => {
      if (node.isDirectory) {
        const dirKey = `${rootId}/${node.relativePath}`
        const isDirCollapsed = Boolean(collapsedDirs[dirKey])
        const isFolderSelected =
          selectedFolder?.rootId === rootId && selectedFolder?.relativePath === node.relativePath
        const isRenamingFolder =
          renamingItem?.rootId === rootId &&
          renamingItem?.relativePath === node.relativePath &&
          renamingItem?.isDirectory
        const customIconKey =
          folderIcons[dirKey] || folderIcons[`${rootId}::${node.relativePath}`]
        const resolvedIconOption = resolveNordicFolderIcon(customIconKey)
        const FolderIconComponent = resolvedIconOption.Icon
        const customBgColor =
          folderColors[dirKey] || folderColors[`${rootId}::${node.relativePath}`]
        const isDragOverFolder = dragOverTargetKey === dirKey

        return (
          <div key={dirKey} className="pl-2">
            <div
              data-testid={`tree-folder-${rootId}-${node.relativePath}`}
              draggable={!isRenamingFolder}
              onDragStart={(e) => {
                e.stopPropagation()
                const item = {
                  rootId,
                  relativePath: node.relativePath,
                  name: node.name,
                  isDirectory: true
                }
                setDraggedTreeItem(item)
                try {
                  const payload = JSON.stringify(item)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('application/x-klartext-tree-item', payload)
                  e.dataTransfer.setData('text/plain', payload)
                } catch {
                  // Ignore in synthetic drag events
                }
              }}
              onDragEnd={() => {
                setDraggedTreeItem(null)
                setDragOverTargetKey(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const src = resolveDraggedItem(e)
                if (canDropTreeItemIntoFolder(src, rootId, node.relativePath)) {
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverTargetKey !== dirKey) {
                    setDragOverTargetKey(dirKey)
                  }
                }
              }}
              onDragLeave={(e) => {
                e.stopPropagation()
                if (dragOverTargetKey === dirKey) {
                  setDragOverTargetKey(null)
                }
              }}
              onDrop={(e) => handleDropIntoTarget(rootId, node.relativePath, e)}
              style={
                {
                  ...(customBgColor ? { backgroundColor: customBgColor } : {}),
                  WebkitUserDrag: isRenamingFolder ? 'none' : 'element'
                } as React.CSSProperties
              }
              onClick={(e) => {
                e.stopPropagation()
                setSelectedFolder({ rootId, relativePath: node.relativePath })
                if (!isRenamingFolder) {
                  setCollapsedDirs((p) => ({ ...p, [dirKey]: !p[dirKey] }))
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setRenamingItem({
                  rootId,
                  relativePath: node.relativePath,
                  draftName: node.name,
                  isDirectory: true
                })
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSelectedFolder({ rootId, relativePath: node.relativePath })
                setShowContextTemplatesSubmenu(false)
                setShowContextFolderIconsSubmenu(false)
                setFileContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  rootId,
                  relativePath: node.relativePath,
                  name: node.name,
                  isDirectory: true
                })
              }}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                isDragOverFolder
                  ? 'ring-2 ring-accent bg-accent/20 text-primary'
                  : isFolderSelected
                    ? 'ring-1 ring-accent/70 text-primary bg-secondary/80'
                    : 'text-muted hover:text-primary hover:bg-secondary/40'
              }`}
            >
              {isDirCollapsed ? (
                <ChevronRight className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 shrink-0" />
              )}
              <span
                className="inline-flex items-center justify-center shrink-0"
                data-testid={`folder-icon-${dirKey}`}
                data-icon-id={resolvedIconOption.id}
              >
                <FolderIconComponent
                  className="w-3.5 h-3.5 shrink-0 text-white stroke-[1.75]"
                  style={{ filter: 'drop-shadow(0 0 1px rgba(15, 23, 42, 0.75))' }}
                />
              </span>
              {isRenamingFolder ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  data-testid={`inline-rename-folder-input-${rootId}`}
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
            {!isDirCollapsed && node.children && renderTreeNodes(rootId, node.children)}
          </div>
        )
      }

      const isActive =
        activeDoc?.rootId === rootId && activeDoc?.relativePath === node.relativePath
      const isRenaming =
        renamingItem?.rootId === rootId &&
        renamingItem?.relativePath === node.relativePath &&
        !renamingItem?.isDirectory
      const otherRoots = roots.filter((r) => r.id !== rootId)

      return (
        <div
          key={`${rootId}/${node.relativePath}`}
          data-testid={`tree-file-${rootId}-${node.relativePath}`}
          draggable={!isRenaming}
          onDragStart={(e) => {
            e.stopPropagation()
            const item = {
              rootId,
              relativePath: node.relativePath,
              name: node.name,
              isDirectory: false
            }
            setDraggedTreeItem(item)
            try {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData(
                'application/x-klartext-tree-item',
                JSON.stringify(item)
              )
            } catch {
              // Ignore synthetic drag events
            }
          }}
          onDragEnd={() => {
            setDraggedTreeItem(null)
            setDragOverTargetKey(null)
          }}
          className={`group flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer ${
            isActive
              ? 'bg-secondary text-accent font-medium'
              : 'text-primary hover:bg-secondary/60'
          }`}
          onClick={() => {
            const parentFolder = node.relativePath.includes('/')
              ? node.relativePath.slice(0, node.relativePath.lastIndexOf('/'))
              : ''
            setSelectedFolder({ rootId, relativePath: parentFolder })
            if (!isRenaming) onOpenDocument(rootId, node.relativePath)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setRenamingItem({
              rootId,
              relativePath: node.relativePath,
              draftName: node.name,
              isDirectory: false
            })
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowContextTemplatesSubmenu(false)
            setShowContextFolderIconsSubmenu(false)
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
                title="Open new workspace"
                aria-label="Open new workspace"
                data-testid="add-folder-dialog-btn"
                onClick={onAddRootDialog}
                className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {roots.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted rounded-md border border-dashed border-subtle bg-panel/50">
              No folders mounted yet. Click <span className="font-medium text-primary">Open new workspace</span> above or <span className="font-medium text-primary">File → Open Folder…</span> to add a workspace folder.
            </div>
          )}

          {roots.map((root) => {
            const isCollapsed = Boolean(collapsedRoots[root.id])
            const gitStatus = gitStatuses[root.id]
            const nodes = treesByRoot[root.id] || []
            const activeSubfolderForRoot =
              selectedFolder?.rootId === root.id && selectedFolder.relativePath
                ? selectedFolder.relativePath
                : ''
            const rootDropKey = `${root.id}/__root__`
            const isDragOverRoot = dragOverTargetKey === rootDropKey

            return (
              <div
                key={root.id}
                data-testid={`workspace-root-section-${root.id}`}
                className={`rounded-md border bg-panel overflow-hidden transition-colors ${
                  isDragOverRoot ? 'border-accent ring-1 ring-accent' : 'border-subtle'
                }`}
              >
                <div
                  data-testid={`workspace-root-header-${root.id}`}
                  onClick={() => setSelectedFolder({ rootId: root.id, relativePath: '' })}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const src = resolveDraggedItem(e)
                    if (canDropTreeItemIntoFolder(src, root.id, '')) {
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverTargetKey !== rootDropKey) {
                        setDragOverTargetKey(rootDropKey)
                      }
                    }
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation()
                    if (dragOverTargetKey === rootDropKey) {
                      setDragOverTargetKey(null)
                    }
                  }}
                  onDrop={(e) => handleDropIntoTarget(root.id, '', e)}
                  className="flex items-center justify-between px-2 py-1.5 bg-secondary/60 border-b border-subtle text-xs cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFolder({ rootId: root.id, relativePath: '' })
                      setCollapsedRoots((p) => ({ ...p, [root.id]: !p[root.id] }))
                    }}
                    className="flex items-center gap-1 font-semibold text-primary truncate"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{root.name}</span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span
                      data-testid={`root-git-badge-${root.id}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        void window.klartext?.openRootInFinder?.(root.id)
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredRootBadge({
                          rootId: root.id,
                          path: root.path,
                          x: rect.left,
                          y: rect.bottom + 6
                        })
                      }}
                      onMouseLeave={() =>
                        setHoveredRootBadge((prev) =>
                          prev?.rootId === root.id ? null : prev
                        )
                      }
                      className={`text-[10px] px-1.5 py-0.5 rounded border border-subtle cursor-pointer select-none ${
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
                      title={
                        activeSubfolderForRoot
                          ? `Create New Note in "${activeSubfolderForRoot}"`
                          : 'Create New File (Untitled.md)'
                      }
                      data-testid={`new-file-btn-${root.id}`}
                      onClick={() => handleCreateUntitledFile(root.id)}
                      className="p-0.5 rounded hover:bg-panel text-muted hover:text-primary"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title={
                        activeSubfolderForRoot
                          ? `Create New Subfolder in "${activeSubfolderForRoot}"`
                          : 'Create New Subfolder'
                      }
                      data-testid={`new-folder-btn-${root.id}`}
                      onClick={() => handleCreateNewSubfolder(root.id)}
                      className="p-0.5 rounded hover:bg-panel text-muted hover:text-primary"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove Root from Workspace"
                      data-testid={`remove-root-btn-${root.id}`}
                      onClick={() => onRemoveRoot(root.id)}
                      className="p-0.5 rounded hover:bg-panel text-muted hover:text-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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

      {hoveredRootBadge && (
        <div
          data-testid="root-path-tooltip"
          style={{
            position: 'fixed',
            left: `${Math.max(8, Math.min(window.innerWidth - 340, hoveredRootBadge.x))}px`,
            top: `${hoveredRootBadge.y}px`,
            zIndex: 120
          }}
          className="pointer-events-none px-2 py-1 rounded bg-app border border-subtle shadow-lg text-[11px] font-mono text-primary whitespace-nowrap"
        >
          {hoveredRootBadge.path}
        </div>
      )}

      {/* Right-Click File & Folder Context Menu */}
      {fileContextMenu && (
        <div
          data-testid="file-tree-context-menu"
          style={{
            position: 'fixed',
            left: `${Math.max(8, Math.min(window.innerWidth - 240, fileContextMenu.x))}px`,
            top: `${Math.max(8, Math.min(window.innerHeight - 360, fileContextMenu.y))}px`
          }}
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-56 rounded-md bg-panel border border-subtle shadow-xl py-1.5 text-xs"
        >
          <div className="px-3 py-1 border-b border-subtle text-[10px] font-mono text-muted truncate flex items-center justify-between">
            <span className="truncate">{fileContextMenu.name}</span>
            <span className="uppercase text-[9px]">
              {fileContextMenu.isDirectory ? 'Folder' : 'File'}
            </span>
          </div>

          {fileContextMenu.isDirectory && (
            <>
              <button
                type="button"
                data-testid="context-menu-add-note"
                onMouseEnter={() => {
                  setShowContextTemplatesSubmenu(false)
                  setShowContextFolderIconsSubmenu(false)
                }}
                onClick={() => {
                  const { rootId, relativePath } = fileContextMenu
                  setFileContextMenu(null)
                  setShowContextTemplatesSubmenu(false)
                  setShowContextFolderIconsSubmenu(false)
                  void handleCreateUntitledFile(rootId, relativePath)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2 font-medium"
              >
                <FilePlus className="w-3.5 h-3.5 text-accent" />
                <span>Add New Note</span>
              </button>
              <button
                type="button"
                data-testid="context-menu-add-subfolder"
                onMouseEnter={() => {
                  setShowContextTemplatesSubmenu(false)
                  setShowContextFolderIconsSubmenu(false)
                }}
                onClick={() => {
                  const { rootId, relativePath } = fileContextMenu
                  setFileContextMenu(null)
                  setShowContextTemplatesSubmenu(false)
                  setShowContextFolderIconsSubmenu(false)
                  void handleCreateNewSubfolder(rootId, relativePath)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5 text-muted" />
                <span>New Subfolder</span>
              </button>

              {/* Templates Expanding Submenu */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setShowContextTemplatesSubmenu(true)
                  setShowContextFolderIconsSubmenu(false)
                }}
              >
                <button
                  type="button"
                  data-testid="context-menu-templates-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowContextTemplatesSubmenu((v) => !v)
                    setShowContextFolderIconsSubmenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between gap-2 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <FileCode2 className="w-3.5 h-3.5 text-accent" />
                    <span>Templates</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted" />
                </button>

                {showContextTemplatesSubmenu && (
                  <div
                    data-testid="context-menu-templates-submenu"
                    className="absolute left-full top-0 ml-0.5 z-50 w-56 max-h-64 overflow-y-auto rounded-md bg-panel border border-subtle shadow-xl py-1 text-xs"
                  >
                    {availableTemplates.length === 0 ? (
                      <div className="px-3 py-1.5 text-muted">No templates available</div>
                    ) : (
                      availableTemplates.map((tpl) => {
                        const cleanTplLabel = tpl.name.replace(/\.md$/i, '')
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            data-testid={`context-menu-add-template-${tpl.id}`}
                            onClick={() => {
                              const { rootId, relativePath } = fileContextMenu
                              setFileContextMenu(null)
                              setShowContextTemplatesSubmenu(false)
                              setCollapsedRoots((p) => ({ ...p, [rootId]: false }))
                              if (relativePath) {
                                setCollapsedDirs((p) => ({
                                  ...p,
                                  [`${rootId}/${relativePath}`]: false
                                }))
                              }
                              setSelectedFolder({ rootId, relativePath })
                              void onCreateNoteFromTemplateInFolder?.(
                                rootId,
                                relativePath,
                                cleanTplLabel,
                                tpl.content
                              )
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2 truncate"
                          >
                            <FilePlus className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span className="truncate">Add {cleanTplLabel}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-subtle" />
            </>
          )}

          <button
            type="button"
            data-testid="context-menu-rename"
            onMouseEnter={() => {
              setShowContextTemplatesSubmenu(false)
              setShowContextFolderIconsSubmenu(false)
            }}
            onClick={() => {
              setRenamingItem({
                rootId: fileContextMenu.rootId,
                relativePath: fileContextMenu.relativePath,
                draftName: fileContextMenu.name,
                isDirectory: fileContextMenu.isDirectory
              })
              setFileContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center gap-2"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted" />
            <span>{fileContextMenu.isDirectory ? 'Rename Folder' : 'Rename'}</span>
          </button>

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
            onMouseEnter={() => {
              setShowContextTemplatesSubmenu(false)
              setShowContextFolderIconsSubmenu(false)
            }}
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

          {fileContextMenu.isDirectory && (
            <>
              <div className="my-1 border-t border-subtle" />

              {/* Folder Icons Expanding Submenu (Nordic Clean Outline White Icons + Standard Folder Icon) */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setShowContextFolderIconsSubmenu(true)
                  setShowContextTemplatesSubmenu(false)
                }}
              >
                <button
                  type="button"
                  data-testid="context-menu-folder-icons-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowContextFolderIconsSubmenu((v) => !v)
                    setShowContextTemplatesSubmenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-secondary text-primary flex items-center justify-between gap-2 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Folder
                      className="w-3.5 h-3.5 text-white stroke-[1.75]"
                      style={{ filter: 'drop-shadow(0 0 1px rgba(15, 23, 42, 0.75))' }}
                    />
                    <span>Folder Icon</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted" />
                </button>

                {showContextFolderIconsSubmenu && (
                  <div
                    data-testid="context-menu-folder-icons"
                    className="absolute left-full top-0 ml-0.5 z-50 w-56 max-h-72 overflow-y-auto rounded-md bg-panel border border-subtle shadow-xl p-1.5 text-xs space-y-1"
                  >
                    <div className="px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted flex items-center justify-between">
                      <span>Nordic Outline Icons</span>
                      {folderIcons[`${fileContextMenu.rootId}/${fileContextMenu.relativePath}`] && (
                        <button
                          type="button"
                          data-testid="context-menu-clear-folder-icon"
                          onClick={() => {
                            onUpdateFolderIcon?.(
                              `${fileContextMenu.rootId}/${fileContextMenu.relativePath}`,
                              ''
                            )
                            setFileContextMenu(null)
                            setShowContextFolderIconsSubmenu(false)
                          }}
                          className="text-[10px] text-accent hover:underline font-normal normal-case"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {NORDIC_FOLDER_ICONS.map((iconOpt) => {
                        const folderKey = `${fileContextMenu.rootId}/${fileContextMenu.relativePath}`
                        const currentKey = folderIcons[folderKey] || 'folder'
                        const isSelected =
                          currentKey === iconOpt.id ||
                          Boolean(iconOpt.legacyAliases?.includes(currentKey))
                        const IconComp = iconOpt.Icon
                        return (
                          <button
                            key={iconOpt.id}
                            type="button"
                            title={iconOpt.label}
                            data-testid={`folder-icon-option-${iconOpt.id}`}
                            onClick={() => {
                              onUpdateFolderIcon?.(
                                folderKey,
                                iconOpt.id === 'folder' ? '' : iconOpt.id
                              )
                              setFileContextMenu(null)
                              setShowContextFolderIconsSubmenu(false)
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between gap-2 hover:bg-secondary ${
                              isSelected ? 'bg-secondary ring-1 ring-accent text-primary' : 'text-primary'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <IconComp
                                className="w-3.5 h-3.5 shrink-0 text-white stroke-[1.75]"
                                style={{ filter: 'drop-shadow(0 0 1px rgba(15, 23, 42, 0.75))' }}
                              />
                              <span className="truncate">{iconOpt.label}</span>
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-accent shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-subtle" />
              <div
                className="px-3 py-1 space-y-1"
                onMouseEnter={() => {
                  setShowContextTemplatesSubmenu(false)
                  setShowContextFolderIconsSubmenu(false)
                }}
              >
                <div className="text-[10px] font-semibold uppercase text-muted">
                  Folder Background Color
                </div>
                <div
                  data-testid="context-menu-folder-colors"
                  className="flex flex-wrap items-center gap-1.5 pt-0.5"
                >
                  {FOLDER_COLOR_PALETTE.map((swatch) => {
                    const folderKey = `${fileContextMenu.rootId}/${fileContextMenu.relativePath}`
                    const current = folderColors[folderKey] || ''
                    const isSelected = current === swatch.value
                    return (
                      <button
                        key={swatch.label}
                        type="button"
                        title={swatch.label}
                        data-testid={`folder-color-option-${swatch.label}`}
                        onClick={() => {
                          onUpdateFolderColor?.(folderKey, swatch.value)
                          setFileContextMenu(null)
                        }}
                        style={{
                          backgroundColor: swatch.value || 'transparent'
                        }}
                        className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
                          isSelected
                            ? 'border-accent ring-1 ring-accent'
                            : 'border-subtle'
                        }`}
                      >
                        {!swatch.value && <span className="text-[8px] text-muted">✕</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

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
            className="w-full text-left px-3 py-1.5 hover:bg-secondary text-danger flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 text-danger" />
            <span>{fileContextMenu.isDirectory ? 'Delete Folder' : 'Delete'}</span>
          </button>
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
