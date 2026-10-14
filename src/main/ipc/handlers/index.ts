import fs from 'fs'
import path from 'path'
import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../../shared/constants'
import {
  AIStreamRequestSchema,
  AIRagQueryRequestSchema,
  AssetSaveRequestSchema,
  CrossRootMoveRequestSchema,
  DocRenameRequestSchema,
  DocWriteRequestSchema,
  ExcalidrawSaveRequestSchema,
  ExportRequestSchema,
  GitActionRequestSchema,
  GitConflictResolveRequestSchema,
  RootScopedPathSchema,
  SearchQueryRequestSchema,
  SearchReplaceRequestSchema
} from '../../../shared/schemas'
import { isSafeUrl } from '../../../shared/markdown/pipeline'
import { MultiRootRegistry, atomicWriteFile } from '../../workspace/multi-root-registry'
import { AssetAndDocumentService } from '../../assets/asset-service'
import { RecoveryService } from '../../recovery/recovery-service'
import { MultiRootWatcher } from '../../watcher/multi-root-watcher'
import { MultiRootSearchService } from '../../search/search-service'
import { MultiRepoManager } from '../../git/multi-repo-manager'
import { LocalAIOrchestrator } from '../../ai/orchestrator'
import { SettingsAndCredentialService } from '../../settings/settings-service'
import { ExportService } from '../../export/export-service'

export interface MainServices {
  registry: MultiRootRegistry
  assetService: AssetAndDocumentService
  recoveryService: RecoveryService
  watcher: MultiRootWatcher
  searchService: MultiRootSearchService
  gitManager: MultiRepoManager
  aiOrchestrator: LocalAIOrchestrator
  settingsService: SettingsAndCredentialService
  exportService: ExportService
}

export function registerAllIpcHandlers(
  services: MainServices,
  getMainWindow: () => BrowserWindow | null
): void {
  const {
    registry,
    assetService,
    recoveryService,
    watcher,
    searchService,
    gitManager,
    aiOrchestrator,
    settingsService,
    exportService
  } = services

  // Wire watcher events to renderer
  watcher.setChangeHandler((ev) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.EVENT_WATCHER_CHANGE, ev)
    }
  })

  // Start watching existing roots
  for (const r of registry.getState().roots) {
    watcher.watchRoot(r.id, r.path)
  }

  // Workspace & Multi-Root
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_STATE, async () => {
    return registry.getState()
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ADD_ROOT, async (_e, rawInput) => {
    const schema = z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      path: z.string().min(1),
      assetDir: z.string().optional()
    })
    const input = schema.parse(rawInput)
    const added = registry.addRoot(input)
    watcher.watchRoot(added.id, added.path)
    gitManager.syncInstancesWithRegistry()
    return added
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_DIALOG, async () => {
    const win = getMainWindow()
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const added = registry.addRoot({ path: res.filePaths[0] })
    watcher.watchRoot(added.id, added.path)
    gitManager.syncInstancesWithRegistry()
    return added
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE_ROOT, async (_e, rawInput) => {
    const { rootId } = z.object({ rootId: z.string().min(1) }).parse(rawInput)
    await watcher.unwatchRoot(rootId)
    registry.removeRoot(rootId)
    gitManager.syncInstancesWithRegistry()
    return registry.getState()
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REORDER_ROOTS, async (_e, rawInput) => {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string()) }).parse(rawInput)
    return registry.reorderRoots(orderedIds)
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RENAME_ROOT, async (_e, rawInput) => {
    const { rootId, newName } = z
      .object({ rootId: z.string().min(1), newName: z.string().min(1) })
      .parse(rawInput)
    const updated = registry.renameRoot(rootId, newName)
    gitManager.syncInstancesWithRegistry()
    return updated
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SAVE_MANIFEST, async (_e, rawInput) => {
    const { filePath, name } = z
      .object({ filePath: z.string().min(1), name: z.string().optional() })
      .parse(rawInput)
    return registry.saveManifestToFile(filePath, name)
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_MANIFEST, async (_e, rawInput) => {
    const { filePath, trusted } = z
      .object({ filePath: z.string().min(1), trusted: z.boolean().optional() })
      .parse(rawInput)
    const manifest = await registry.loadManifestFromFile(filePath, async (paths) => {
      if (trusted) return true
      const win = getMainWindow()
      if (!win) return true
      const resp = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Mount Workspace Roots', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Approve Workspace Root Folders',
        message: 'Do you trust and want to mount the following root directories?',
        detail: paths.join('\n')
      })
      return resp.response === 0
    })
    await watcher.closeAll()
    for (const r of manifest.roots) {
      watcher.watchRoot(r.id, r.path)
    }
    gitManager.syncInstancesWithRegistry()
    return manifest
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST_FILES, async (_e, rawInput) => {
    const { rootId, dirRelPath } = z
      .object({ rootId: z.string().min(1), dirRelPath: z.string().optional() })
      .parse(rawInput)
    return registry.listFilesForRoot(rootId, dirRelPath || '')
  })

  // Documents
  ipcMain.handle(IPC_CHANNELS.DOC_READ, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    const content = await fs.promises.readFile(absPath, 'utf-8')
    const stat = await fs.promises.stat(absPath)
    return { content, updatedAt: stat.mtimeMs }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_WRITE, async (_e, rawInput) => {
    const { rootId, relativePath, content } = DocWriteRequestSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    await atomicWriteFile(absPath, content)
    await recoveryService.clearSnapshot(rootId, relativePath)
    const stat = await fs.promises.stat(absPath)
    return { ok: true, updatedAt: stat.mtimeMs }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_CREATE, async (_e, rawInput) => {
    const { rootId, relativePath, content } = DocWriteRequestSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    await atomicWriteFile(absPath, content)
    return { ok: true, relativePath }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_DELETE, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    if (fs.existsSync(absPath)) {
      await fs.promises.rm(absPath, { recursive: true, force: true })
    }
    await recoveryService.clearSnapshot(rootId, relativePath)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_RENAME, async (_e, rawInput) => {
    const { rootId, oldRelativePath, newRelativePath } = DocRenameRequestSchema.parse(rawInput)
    const res = await assetService.renameDocumentAndRefactorLinks({
      rootId,
      oldRelativePath,
      newRelativePath
    })
    return { ok: true, newRelativePath: res.newRelativePath, updatedMarkdown: res.updatedMarkdown }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_CHECK_CROSS_ROOT_ASSETS, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    return assetService.checkCrossRootAssets(rootId, relativePath)
  })

  ipcMain.handle(IPC_CHANNELS.DOC_MOVE_CROSS_ROOT, async (_e, rawInput) => {
    const input = CrossRootMoveRequestSchema.parse(rawInput)
    return assetService.moveDocumentCrossRoot(input)
  })

  // Assets & Excalidraw
  ipcMain.handle(IPC_CHANNELS.ASSET_SAVE, async (_e, rawInput) => {
    const input = AssetSaveRequestSchema.parse(rawInput)
    return assetService.saveRootScopedAsset(input)
  })

  ipcMain.handle(IPC_CHANNELS.ASSET_LIST_ORPHANS, async (_e, rawInput) => {
    const { rootId } = z.object({ rootId: z.string().min(1) }).parse(rawInput)
    return assetService.listOrphanAssets(rootId)
  })

  ipcMain.handle(IPC_CHANNELS.EXCALIDRAW_SAVE_SVG, async (_e, rawInput) => {
    const input = ExcalidrawSaveRequestSchema.parse(rawInput)
    const scene = JSON.parse(input.sceneJson)
    return assetService.saveExcalidrawSvg({
      rootId: input.rootId,
      relativePath: input.relativePath,
      scene
    })
  })

  ipcMain.handle(IPC_CHANNELS.EXCALIDRAW_LOAD_SVG, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    return assetService.loadExcalidrawSvg(rootId, relativePath)
  })

  // Recovery
  ipcMain.handle(IPC_CHANNELS.RECOVERY_SAVE_SNAPSHOT, async (_e, rawInput) => {
    const { rootId, relativePath, content } = DocWriteRequestSchema.parse(rawInput)
    return recoveryService.saveSnapshot({ rootId, relativePath, content })
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_LIST_SNAPSHOTS, async () => {
    return recoveryService.listSnapshots()
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_CLEAR_SNAPSHOT, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    await recoveryService.clearSnapshot(rootId, relativePath)
    return { ok: true }
  })

  // Search & Backlinks
  ipcMain.handle(IPC_CHANNELS.SEARCH_QUERY, async (_e, rawInput) => {
    const input = SearchQueryRequestSchema.parse(rawInput)
    return searchService.searchAcrossRoots(input)
  })

  ipcMain.handle(IPC_CHANNELS.SEARCH_REPLACE, async (_e, rawInput) => {
    const input = SearchReplaceRequestSchema.parse(rawInput)
    return searchService.replaceAcrossRoots(input)
  })

  ipcMain.handle(IPC_CHANNELS.SEARCH_BACKLINKS, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    return searchService.findBacklinks(rootId, relativePath)
  })

  // Multi-Repo Git
  ipcMain.handle(IPC_CHANNELS.GIT_GET_ALL_STATUS, async () => {
    return gitManager.getAllStatuses()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_GET_REPO_STATUS, async (_e, rawInput) => {
    const { rootId } = z.object({ rootId: z.string().min(1) }).parse(rawInput)
    return gitManager.getRepo(rootId).getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_e, rawInput) => {
    const { rootId } = z.object({ rootId: z.string().min(1) }).parse(rawInput)
    return gitManager.getRepo(rootId).initRepo()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CLONE, async (_e, rawInput) => {
    const input = z
      .object({
        remoteUrl: z.string().min(1),
        targetParentDir: z.string().min(1),
        folderName: z.string().min(1),
        alias: z.string().optional()
      })
      .parse(rawInput)
    return gitManager.cloneAndMountRepository(input)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, async (_e, rawInput) => {
    const { rootId, files } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).stageFiles(files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, async (_e, rawInput) => {
    const { rootId, files } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).unstageFiles(files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, async (_e, rawInput) => {
    const { rootId, relativePath } = z
      .object({ rootId: z.string().min(1), relativePath: z.string().optional() })
      .parse(rawInput)
    return gitManager.getRepo(rootId).getDiff(relativePath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_e, rawInput) => {
    const { rootId, message, files } = GitActionRequestSchema.parse(rawInput)
    if (!message || !message.trim()) throw new Error('Commit message cannot be empty')
    return gitManager.getRepo(rootId).commit(message.trim(), files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_FETCH, async (_e, rawInput) => {
    const { rootId } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).fetch()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_e, rawInput) => {
    const { rootId, strategy } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).pull(strategy)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_e, rawInput) => {
    const { rootId } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).push()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_SYNC_ALL, async () => {
    return gitManager.syncAllRepositories()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCHES, async (_e, rawInput) => {
    const { rootId } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).listBranches()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, async (_e, rawInput) => {
    const { rootId, branch, createBranch } = GitActionRequestSchema.parse(rawInput)
    if (!branch) throw new Error('Branch name is required')
    return gitManager.getRepo(rootId).checkoutBranch(branch, createBranch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_LOG, async (_e, rawInput) => {
    const { rootId } = z.object({ rootId: z.string().optional() }).parse(rawInput || {})
    if (rootId) {
      return gitManager.getRepo(rootId).getLog()
    }
    return gitManager.getInterleavedLogs()
  })

  ipcMain.handle(IPC_CHANNELS.GIT_RESOLVE_CONFLICT, async (_e, rawInput) => {
    const input = GitConflictResolveRequestSchema.parse(rawInput)
    return gitManager.getRepo(input.rootId).resolveConflictInFile(input)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_ABORT_MERGE, async (_e, rawInput) => {
    const { rootId } = GitActionRequestSchema.parse(rawInput)
    return gitManager.getRepo(rootId).abortMergeOrRebase()
  })

  // Settings & Credentials
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsService.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_e, rawInput) => {
    const partial = z.record(z.string(), z.unknown()).parse(rawInput)
    return settingsService.updateSettings(partial as any)
  })

  ipcMain.handle(IPC_CHANNELS.CREDS_SET, async (_e, rawInput) => {
    const { key, value } = z
      .object({ key: z.string().min(1), value: z.string().min(1) })
      .parse(rawInput)
    await settingsService.setSecret(key, value)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.CREDS_HAS, async (_e, rawInput) => {
    const { key } = z.object({ key: z.string().min(1) }).parse(rawInput)
    return { exists: settingsService.hasSecret(key) }
  })

  ipcMain.handle(IPC_CHANNELS.CREDS_DELETE, async (_e, rawInput) => {
    const { key } = z.object({ key: z.string().min(1) }).parse(rawInput)
    await settingsService.deleteSecret(key)
    return { ok: true }
  })

  // Local AI & Hardware Advisor
  ipcMain.handle(IPC_CHANNELS.AI_GET_HARDWARE_ADVICE, async () => {
    return aiOrchestrator.getHardwareAdvice()
  })

  ipcMain.handle(IPC_CHANNELS.AI_TEST_CONNECTION, async () => {
    return aiOrchestrator.testConnection()
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_MODELS, async () => {
    return aiOrchestrator.listModels()
  })

  ipcMain.handle(IPC_CHANNELS.AI_PULL_MODEL, async (_e, rawInput) => {
    const { modelTag } = z.object({ modelTag: z.string().min(1) }).parse(rawInput)
    return aiOrchestrator.pullOllamaModel(modelTag)
  })

  ipcMain.handle(IPC_CHANNELS.AI_STREAM_START, async (_e, rawInput) => {
    const input = AIStreamRequestSchema.parse(rawInput)
    const win = getMainWindow()
    return aiOrchestrator.streamGeneration(input, (chunkEvent) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.EVENT_AI_STREAM_CHUNK, chunkEvent)
      }
    })
  })

  ipcMain.handle(IPC_CHANNELS.AI_STREAM_CANCEL, async (_e, rawInput) => {
    const { requestId } = z.object({ requestId: z.string().min(1) }).parse(rawInput)
    return { cancelled: aiOrchestrator.cancelStream(requestId) }
  })

  ipcMain.handle(IPC_CHANNELS.AI_RAG_QUERY, async (_e, rawInput) => {
    const input = AIRagQueryRequestSchema.parse(rawInput)
    return aiOrchestrator.answerWorkspaceQuestion(input)
  })

  // Export
  ipcMain.handle(IPC_CHANNELS.EXPORT_HTML, async (_e, rawInput) => {
    const input = ExportRequestSchema.parse(rawInput)
    return exportService.exportToHtmlFile(input)
  })

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (_e, rawInput) => {
    const input = ExportRequestSchema.parse(rawInput)
    const html = await exportService.generateStandaloneHtml(input)
    const defaultPdfOut = registry.pathGuard.resolveScopedPath(
      input.rootId,
      input.relativePath.replace(/\.(md|markdown)$/i, '') + '.pdf'
    )
    const outputPath = input.targetFilePath || defaultPdfOut

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    try {
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4'
      })
      await atomicWriteFile(outputPath, pdfBuffer)
      return { outputPath, sizeBytes: pdfBuffer.length }
    } finally {
      printWin.destroy()
    }
  })

  // Window & External Links
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    getMainWindow()?.close()
  })

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_e, rawInput) => {
    const { url } = z.object({ url: z.string().url() }).parse(rawInput)
    const parsed = new URL(url)
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') || !isSafeUrl(url)) {
      throw new Error(`Blocked opening unsafe external URL scheme: ${parsed.protocol}`)
    }
    await shell.openExternal(url)
    return { ok: true }
  })
}
