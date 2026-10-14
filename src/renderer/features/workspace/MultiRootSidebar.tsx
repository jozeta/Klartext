import React, { useState } from 'react'
import {
  FolderPlus,
  FilePlus,
  Trash2,
  GitBranch,
  RefreshCw,
  Check,
  AlertTriangle,
  Search as SearchIcon,
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  FileText
} from 'lucide-react'
import type {
  BacklinkItem,
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
  roots: WorkspaceRoot[]
  treesByRoot: Record<string, FileTreeNode[]>
  gitStatuses: Record<string, GitRepoStatus>
  activeDoc: { rootId: string; relativePath: string } | null
  headings: HeadingItem[]
  backlinks: BacklinkItem[]
  onOpenDocument: (rootId: string, relativePath: string) => void
  onAddRootDialog: () => void
  onAddRootByPath: (folderPath: string, name?: string) => void
  onRemoveRoot: (rootId: string) => void
  onCreateFileInRoot: (rootId: string, relativePath: string) => void
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
  roots,
  treesByRoot,
  gitStatuses,
  activeDoc,
  headings,
  backlinks,
  onOpenDocument,
  onAddRootDialog,
  onAddRootByPath,
  onRemoveRoot,
  onCreateFileInRoot,
  onMoveFileCrossRoot,
  onSyncAllRepos,
  onRefreshGit,
  onCommitRepo,
  onResolveConflictFromGitPanel,
  onAbortMergeRepo
}) => {
  const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({})
  const [newFileRootId, setNewFileRootId] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [customRootPath, setCustomRootPath] = useState('')
  const [showAddPathInput, setShowAddPathInput] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [selectedSearchRoot, setSelectedSearchRoot] = useState<string>('ALL')
  const [searchResults, setSearchResults] = useState<SearchFileResult[]>([])
  const [checkedReplaceFiles, setCheckedReplaceFiles] = useState<Record<string, boolean>>({})
  const [replaceSummary, setReplaceSummary] = useState<string>('')

  // Git commit messages per root
  const [commitMessages, setCommitMessages] = useState<Record<string, string>>({})

  const handleRunSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const res = await window.klartext.searchWorkspace({
      query: searchQuery,
      rootIds: selectedSearchRoot === 'ALL' ? undefined : [selectedSearchRoot]
    })
    setSearchResults(res)
    const initialChecks: Record<string, boolean> = {}
    for (const item of res) {
      initialChecks[`${item.rootId}::${item.relativePath}`] = true
    }
    setCheckedReplaceFiles(initialChecks)
  }

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
    await handleRunSearch()
  }

  const renderTreeNodes = (rootId: string, nodes: FileTreeNode[]) => {
    return nodes.map((node) => {
      if (node.isDirectory) {
        return (
          <div key={`${rootId}/${node.relativePath}`} className="pl-2.5">
            <div className="flex items-center gap-1.5 py-1 text-xs font-medium text-muted">
              <ChevronDown className="w-3 h-3" />
              <span>{node.name}</span>
            </div>
            {node.children && renderTreeNodes(rootId, node.children)}
          </div>
        )
      }

      const isActive =
        activeDoc?.rootId === rootId && activeDoc?.relativePath === node.relativePath
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
          onClick={() => onOpenDocument(rootId, node.relativePath)}
        >
          <div className="flex items-center gap-1.5 truncate">
            <FileText className="w-3.5 h-3.5 shrink-0 text-muted" />
            <span className="truncate">{node.name}</span>
          </div>
          {otherRoots.length > 0 && (
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

  return (
    <aside
      data-testid="left-sidebar"
      className="h-full flex flex-col bg-app border-r border-subtle select-none overflow-hidden"
    >
      {/* Sidebar Mode Switcher Strip */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-subtle bg-panel text-xs">
        {(
          [
            { id: 'explorer', label: 'Files' },
            { id: 'search', label: 'Search' },
            { id: 'outline', label: 'Outline' },
            { id: 'backlinks', label: 'Links' },
            { id: 'git', label: 'Git' }
          ] as Array<{ id: LeftSidebarTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`sidebar-tab-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-secondary text-accent'
                : 'text-muted hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
                title="Add Folder by Path"
                data-testid="toggle-add-root-path-btn"
                onClick={() => setShowAddPathInput((v) => !v)}
                className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[11px] hover:border-accent"
              >
                + Path
              </button>
              <button
                type="button"
                title="Open Folder Dialog"
                data-testid="add-folder-dialog-btn"
                onClick={onAddRootDialog}
                className="p-1 rounded hover:bg-secondary text-primary"
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
                      title="New Markdown File in Root"
                      data-testid={`new-file-btn-${root.id}`}
                      onClick={() => {
                        setNewFileRootId(root.id)
                        setNewFileName('Untitled.md')
                      }}
                      className="p-0.5 rounded hover:bg-panel text-muted hover:text-primary"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
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

                {newFileRootId === root.id && (
                  <div className="p-2 bg-app border-b border-subtle flex items-center gap-1 text-xs">
                    <input
                      type="text"
                      data-testid={`new-file-input-${root.id}`}
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="flex-1 px-2 py-0.5 rounded bg-panel border border-subtle text-primary"
                    />
                    <button
                      type="button"
                      data-testid={`confirm-new-file-btn-${root.id}`}
                      onClick={() => {
                        if (newFileName.trim()) {
                          const rel = newFileName.endsWith('.md')
                            ? newFileName.trim()
                            : `${newFileName.trim()}.md`
                          onCreateFileInRoot(root.id, rel)
                          setNewFileRootId(null)
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-accent text-white"
                    >
                      Create
                    </button>
                  </div>
                )}

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

      {/* TAB 2: MULTI-ROOT SEARCH & REPLACE */}
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
            <div className="flex gap-1">
              <input
                type="text"
                data-testid="global-search-input"
                placeholder="Search across roots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunSearch()}
                className="flex-1 px-2 py-1 rounded bg-panel border border-subtle text-primary"
              />
              <button
                type="button"
                data-testid="global-search-run-btn"
                onClick={handleRunSearch}
                className="px-2.5 py-1 rounded bg-accent text-white font-medium"
              >
                <SearchIcon className="w-3.5 h-3.5" />
              </button>
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
                        onClick={() => onOpenDocument(fileHit.rootId, fileHit.relativePath)}
                      >
                        {fileHit.relativePath}
                      </span>
                    </label>
                    <span className="text-[10px] text-muted">{fileHit.matches.length}</span>
                  </div>
                  {fileHit.matches.slice(0, 3).map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => onOpenDocument(fileHit.rootId, fileHit.relativePath)}
                      className="pl-4 text-[11px] font-mono text-muted truncate cursor-pointer hover:text-primary"
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
              key={h.id}
              style={{ paddingLeft: `${(h.depth - 1) * 10}px` }}
              className="py-1 px-2 rounded hover:bg-secondary cursor-pointer text-primary truncate"
            >
              <span className="text-muted mr-1.5 font-mono text-[10px]">H{h.depth}</span>
              {h.text}
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
                onClick={() => onOpenDocument(bl.sourceRootId, bl.sourceRelativePath)}
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
    </aside>
  )
}
