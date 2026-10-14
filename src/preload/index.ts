import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type {
  AIStreamChunkEvent,
  AppSettings,
  BacklinkItem,
  FileTreeNode,
  GitCommitLogEntry,
  GitPullStrategy,
  GitRepoStatus,
  HardwareTierAdvice,
  LocalAIModelInfo,
  RecoverySnapshot,
  SearchFileResult,
  WatcherChangeEvent,
  WorkspaceManifest,
  WorkspaceRoot
} from '../shared/types'

export const klartextApi = {
  // Workspace & Multi-Root
  getWorkspaceState: (): Promise<{ name: string; roots: WorkspaceRoot[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_STATE),
  addRoot: (input: {
    id?: string
    name?: string
    path: string
    assetDir?: string
  }): Promise<WorkspaceRoot> => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ADD_ROOT, input),
  openFolderDialog: (): Promise<WorkspaceRoot | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_DIALOG),
  removeRoot: (rootId: string): Promise<{ name: string; roots: WorkspaceRoot[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REMOVE_ROOT, { rootId }),
  reorderRoots: (orderedIds: string[]): Promise<WorkspaceRoot[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REORDER_ROOTS, { orderedIds }),
  renameRoot: (rootId: string, newName: string): Promise<WorkspaceRoot> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RENAME_ROOT, { rootId, newName }),
  saveWorkspaceManifest: (filePath: string, name?: string): Promise<WorkspaceManifest> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SAVE_MANIFEST, { filePath, name }),
  loadWorkspaceManifest: (filePath: string, trusted?: boolean): Promise<WorkspaceManifest> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_MANIFEST, { filePath, trusted }),
  listFilesForRoot: (rootId: string, dirRelPath?: string): Promise<FileTreeNode[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LIST_FILES, { rootId, dirRelPath }),

  // Document I/O
  readDocument: (
    rootId: string,
    relativePath: string
  ): Promise<{ content: string; updatedAt: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.DOC_READ, { rootId, relativePath }),
  writeDocument: (
    rootId: string,
    relativePath: string,
    content: string
  ): Promise<{ ok: boolean; updatedAt: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.DOC_WRITE, { rootId, relativePath, content }),
  createDocument: (
    rootId: string,
    relativePath: string,
    content: string
  ): Promise<{ ok: boolean; relativePath: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.DOC_CREATE, { rootId, relativePath, content }),
  deleteDocument: (rootId: string, relativePath: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.DOC_DELETE, { rootId, relativePath }),
  renameDocument: (
    rootId: string,
    oldRelativePath: string,
    newRelativePath: string
  ): Promise<{ ok: boolean; newRelativePath: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.DOC_RENAME, { rootId, oldRelativePath, newRelativePath }),
  checkCrossRootAssets: (sourceRootId: string, sourceRelativePath: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DOC_CHECK_CROSS_ROOT_ASSETS, {
      rootId: sourceRootId,
      relativePath: sourceRelativePath
    }),
  moveDocumentCrossRoot: (params: {
    sourceRootId: string
    sourceRelativePath: string
    targetRootId: string
    targetRelativePath: string
    migrateAssets: boolean
  }): Promise<{
    movedFileRelativePath: string
    migratedAssets: string[]
    updatedMarkdown: string
  }> => ipcRenderer.invoke(IPC_CHANNELS.DOC_MOVE_CROSS_ROOT, params),

  // Assets & Diagrams
  saveAsset: (params: {
    rootId: string
    documentRelativePath?: string
    fileName: string
    mimeType: string
    base64Data: string
    category?: 'images' | 'attachments' | 'drawings'
  }): Promise<{ relativeAssetPath: string; markdownLink: string; absolutePath: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASSET_SAVE, params),
  listOrphanAssets: (rootId: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASSET_LIST_ORPHANS, { rootId }),
  saveExcalidrawSvg: (params: {
    rootId: string
    relativePath: string
    sceneJson: string
    svgString: string
  }): Promise<{ relativePath: string; svgContent: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXCALIDRAW_SAVE_SVG, params),
  loadExcalidrawSvg: (
    rootId: string,
    relativePath: string
  ): Promise<{ scene: any; rawSvg: string; corrupted: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXCALIDRAW_LOAD_SVG, { rootId, relativePath }),

  // Recovery
  saveRecoverySnapshot: (
    rootId: string,
    relativePath: string,
    content: string
  ): Promise<RecoverySnapshot> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_SAVE_SNAPSHOT, { rootId, relativePath, content }),
  listRecoverySnapshots: (): Promise<RecoverySnapshot[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_LIST_SNAPSHOTS),
  clearRecoverySnapshot: (rootId: string, relativePath: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_CLEAR_SNAPSHOT, { rootId, relativePath }),

  // Search & Backlinks
  searchWorkspace: (params: {
    query: string
    rootIds?: string[]
    caseSensitive?: boolean
    wholeWord?: boolean
    isRegex?: boolean
    includeGlob?: string
    excludeGlob?: string
  }): Promise<SearchFileResult[]> => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_QUERY, params),
  replaceInWorkspace: (params: {
    search: {
      query: string
      rootIds?: string[]
      caseSensitive?: boolean
      wholeWord?: boolean
      isRegex?: boolean
    }
    replacement: string
    confirmedFiles: Array<{ rootId: string; relativePath: string }>
  }): Promise<{ replacedFilesCount: number; totalReplacements: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_REPLACE, params),
  findBacklinks: (rootId: string, relativePath: string): Promise<BacklinkItem[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_BACKLINKS, { rootId, relativePath }),

  // Multi-Repo Git
  getAllGitStatus: (): Promise<GitRepoStatus[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_ALL_STATUS),
  getRepoGitStatus: (rootId: string): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_REPO_STATUS, { rootId }),
  gitInit: (rootId: string): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, { rootId }),
  gitClone: (params: {
    remoteUrl: string
    targetParentDir: string
    folderName: string
    alias?: string
  }): Promise<{ rootId: string; status: GitRepoStatus }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_CLONE, params),
  gitStage: (rootId: string, files?: string[]): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, { rootId, files }),
  gitUnstage: (rootId: string, files?: string[]): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, { rootId, files }),
  gitDiff: (rootId: string, relativePath?: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, { rootId, relativePath }),
  gitCommit: (rootId: string, message: string, files?: string[]): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { rootId, message, files }),
  gitFetch: (rootId: string): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_FETCH, { rootId }),
  gitPull: (rootId: string, strategy?: GitPullStrategy): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, { rootId, strategy }),
  gitPush: (rootId: string): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { rootId }),
  gitSyncAll: (): Promise<GitRepoStatus[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_SYNC_ALL),
  gitBranches: (rootId: string): Promise<{ current: string; all: string[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCHES, { rootId }),
  gitCheckout: (rootId: string, branch: string, createBranch?: boolean): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, { rootId, branch, createBranch }),
  gitLog: (rootId?: string): Promise<GitCommitLogEntry[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_LOG, { rootId }),
  gitResolveConflict: (params: {
    rootId: string
    relativePath: string
    hunkIndex?: number
    resolution: 'current' | 'incoming' | 'both' | 'custom'
    customContent?: string
  }): Promise<{ updatedContent: string; remainingConflicts: number; status: GitRepoStatus }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_RESOLVE_CONFLICT, params),
  gitAbortMerge: (rootId: string): Promise<GitRepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_ABORT_MERGE, { rootId }),

  // Settings & Credentials
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, partial),
  setCredential: (key: string, value: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREDS_SET, { key, value }),
  hasCredential: (key: string): Promise<{ exists: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREDS_HAS, { key }),
  deleteCredential: (key: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREDS_DELETE, { key }),

  // Local AI & Hardware Advisor
  getHardwareAdvice: (): Promise<HardwareTierAdvice> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_GET_HARDWARE_ADVICE),
  testAIConnection: (): Promise<{
    ok: boolean
    latencyMs: number
    provider: string
    models: LocalAIModelInfo[]
    error?: string
  }> => ipcRenderer.invoke(IPC_CHANNELS.AI_TEST_CONNECTION),
  listAIModels: (): Promise<LocalAIModelInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_MODELS),
  pullAIModel: (modelTag: string): Promise<{ ok: boolean; status: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_PULL_MODEL, { modelTag }),
  startAIStream: (params: {
    requestId: string
    action: string
    prompt?: string
    selectedText?: string
    tone?: string
    modelOverride?: string
  }): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.AI_STREAM_START, params),
  cancelAIStream: (requestId: string): Promise<{ cancelled: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_STREAM_CANCEL, { requestId }),
  queryWorkspaceRAG: (params: {
    question: string
    rootIds?: string[]
    modelOverride?: string
  }): Promise<{
    answer: string
    citations: Array<{ rootId: string; rootName: string; relativePath: string; excerpt: string }>
  }> => ipcRenderer.invoke(IPC_CHANNELS.AI_RAG_QUERY, params),

  // Export
  exportHtml: (params: {
    rootId: string
    relativePath: string
    markdown: string
    title?: string
    inlineAssets?: boolean
    targetFilePath?: string
  }): Promise<{ outputPath: string; html: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_HTML, params),
  exportPdf: (params: {
    rootId: string
    relativePath: string
    markdown: string
    title?: string
    inlineAssets?: boolean
    targetFilePath?: string
  }): Promise<{ outputPath: string; sizeBytes: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF, params),

  // Window & External Links
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  openExternalUrl: (url: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, { url }),

  // Event Subscriptions
  onWatcherChange: (callback: (ev: WatcherChangeEvent) => void): (() => void) => {
    const listener = (_e: unknown, ev: WatcherChangeEvent) => callback(ev)
    ipcRenderer.on(IPC_CHANNELS.EVENT_WATCHER_CHANGE, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WATCHER_CHANGE, listener)
  },
  onAIStreamChunk: (callback: (ev: AIStreamChunkEvent) => void): (() => void) => {
    const listener = (_e: unknown, ev: AIStreamChunkEvent) => callback(ev)
    ipcRenderer.on(IPC_CHANNELS.EVENT_AI_STREAM_CHUNK, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_AI_STREAM_CHUNK, listener)
  },
  onMenuAction: (callback: (action: string) => void): (() => void) => {
    const listener = (_e: unknown, action: string) => callback(action)
    ipcRenderer.on(IPC_CHANNELS.EVENT_MENU_ACTION, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_MENU_ACTION, listener)
  }
}

export type KlartextBridgeAPI = typeof klartextApi

contextBridge.exposeInMainWorld('klartext', klartextApi)
