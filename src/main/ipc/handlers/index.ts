import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import { app, ipcMain, dialog, shell, BrowserWindow } from 'electron'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)
import { z } from 'zod'
import { IPC_CHANNELS, APP_METADATA, compareSemverVersions } from '../../../shared/constants'
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
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.EVENT_WATCHER_CHANGE, {
        rootId: added.id,
        relativePath: '',
        eventType: 'addDir'
      })
    }
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

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_IN_FINDER, async (_e, rawInput) => {
    const { rootId } = z.object({ rootId: z.string().min(1) }).parse(rawInput)
    const root = registry.getState().roots.find((r) => r.id === rootId)
    if (!root) {
      throw new Error(`Unknown rootId: ${rootId}`)
    }
    const err = await shell.openPath(root.path)
    if (err) {
      throw new Error(err)
    }
    return { ok: true, path: root.path }
  })

  // Documents
  const getBinaryAssetMime = (relPath: string): string | null => {
    const lower = relPath.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.bmp')) return 'image/bmp'
    if (lower.endsWith('.ico')) return 'image/x-icon'
    if (lower.endsWith('.avif')) return 'image/avif'
    if (lower.endsWith('.pdf')) return 'application/pdf'
    return null
  }

  ipcMain.handle(IPC_CHANNELS.DOC_READ, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    const stat = await fs.promises.stat(absPath)
    const binaryMime = getBinaryAssetMime(relativePath)
    if (binaryMime) {
      const buf = await fs.promises.readFile(absPath)
      const content = `data:${binaryMime};base64,${buf.toString('base64')}`
      return { content, updatedAt: stat.mtimeMs }
    }
    const content = await fs.promises.readFile(absPath, 'utf-8')
    return { content, updatedAt: stat.mtimeMs }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_WRITE, async (_e, rawInput) => {
    const { rootId, relativePath, content } = DocWriteRequestSchema.parse(rawInput)
    if (getBinaryAssetMime(relativePath)) {
      return { ok: true, updatedAt: Date.now() }
    }
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    watcher.markInternalWrite(rootId, relativePath)
    await atomicWriteFile(absPath, content)
    watcher.markInternalWrite(rootId, relativePath)
    await recoveryService.clearSnapshot(rootId, relativePath)
    const stat = await fs.promises.stat(absPath)
    return { ok: true, updatedAt: stat.mtimeMs }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_CREATE, async (_e, rawInput) => {
    const { rootId, relativePath, content } = DocWriteRequestSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    watcher.markInternalWrite(rootId, relativePath)
    await atomicWriteFile(absPath, content)
    watcher.markInternalWrite(rootId, relativePath)
    return { ok: true, relativePath }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_CREATE_DIR, async (_e, rawInput) => {
    const { rootId, relativePath } = RootScopedPathSchema.parse(rawInput)
    const absPath = registry.pathGuard.resolveScopedPath(rootId, relativePath)
    await fs.promises.mkdir(absPath, { recursive: true })
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
    const oldAbs = registry.pathGuard.resolveScopedPath(rootId, oldRelativePath)
    const newAbs = registry.pathGuard.resolveScopedPath(rootId, newRelativePath)
    if (fs.existsSync(oldAbs) && fs.statSync(oldAbs).isDirectory()) {
      await fs.promises.mkdir(path.dirname(newAbs), { recursive: true })
      await fs.promises.rename(oldAbs, newAbs)
      return { ok: true, newRelativePath, updatedMarkdown: '' }
    }
    const res = await assetService.renameDocumentAndRefactorLinks({
      rootId,
      oldRelativePath,
      newRelativePath
    })
    return { ok: true, newRelativePath: res.newRelativePath, updatedMarkdown: res.updatedMarkdown }
  })

  const getLocalIpAddress = (): string => {
    try {
      const nets = os.networkInterfaces()
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            return net.address
          }
        }
      }
    } catch {
      // Fallback
    }
    return '127.0.0.1'
  }

  const formatSystemUptime = (): string => {
    const sec = Math.floor(os.uptime())
    const days = Math.floor(sec / 86400)
    const hours = Math.floor((sec % 86400) / 3600)
    const mins = Math.floor((sec % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_ENV_INFO, async () => {
    let userName = 'user'
    try {
      userName = os.userInfo().username || 'user'
    } catch {
      // Fallback if userInfo is unavailable
    }
    const freeGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1)
    return {
      userName,
      hostName: os.hostname() || 'localhost',
      osPlatform:
        process.platform === 'darwin'
          ? 'macOS'
          : process.platform === 'win32'
            ? 'Windows'
            : 'Linux',
      cpuArch: process.arch || 'arm64',
      cpuCores: os.cpus()?.length || 8,
      memoryFree: `${freeGb} GB`,
      uptime: formatSystemUptime(),
      ipLocal: getLocalIpAddress(),
      appVersion: app.getVersion() || APP_METADATA.version,
      envVars: {
        USER: userName,
        SHELL: process.env.SHELL || '/bin/zsh',
        HOME: os.homedir() || '~',
        LANG: process.env.LANG || 'en_US.UTF-8',
        PATH: process.env.PATH || ''
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_EVALUATE_POWER, async (_e, rawInput) => {
    const schema = z.object({
      expressions: z.array(z.string()).max(60),
      cwd: z.string().optional()
    })
    const { expressions, cwd } = schema.parse(rawInput || { expressions: [] })
    const defaultRootPath = registry.getState().roots[0]?.path || os.homedir()
    const execCwd = cwd && fs.existsSync(cwd) ? cwd : defaultRootPath
    const powerVariables: Record<string, string> = {}

    for (const rawExpr of expressions) {
      const expr = rawExpr.trim()
      const lower = expr.toLowerCase()
      try {
        if (lower === 'git_commit' || lower === 'commit' || lower === 'git_sha') {
          const { stdout } = await execAsync('git rev-parse --short HEAD', {
            cwd: execCwd,
            timeout: 3000
          })
          powerVariables[expr] = stdout.trim() || 'HEAD'
          continue
        }
        if (lower === 'git_author' || lower === 'commit_author') {
          const { stdout } = await execAsync('git config user.name', {
            cwd: execCwd,
            timeout: 3000
          })
          powerVariables[expr] = stdout.trim() || os.userInfo().username || 'user'
          continue
        }
        if (lower === 'git_remote' || lower === 'remote_url' || lower === 'origin') {
          const { stdout } = await execAsync('git config --get remote.origin.url', {
            cwd: execCwd,
            timeout: 3000
          })
          powerVariables[expr] = stdout.trim() || 'local'
          continue
        }
        if (lower === 'cpu_cores' || lower === 'cores' || lower === 'cpus') {
          powerVariables[expr] = String(os.cpus()?.length || 8)
          continue
        }
        if (lower === 'memory_free' || lower === 'mem_free' || lower === 'free_memory') {
          powerVariables[expr] = `${(os.freemem() / (1024 * 1024 * 1024)).toFixed(1)} GB`
          continue
        }
        if (lower === 'uptime' || lower === 'system_uptime') {
          powerVariables[expr] = formatSystemUptime()
          continue
        }
        if (lower === 'ip_local' || lower === 'local_ip' || lower === 'ip') {
          powerVariables[expr] = getLocalIpAddress()
          continue
        }

        const envMatch = expr.match(/^env:\s*(.+)$/i)
        if (envMatch) {
          const varName = envMatch[1].trim()
          powerVariables[expr] = process.env[varName] ?? ''
          continue
        }

        const execMatch = expr.match(
          /^(exec|cli|cmd|sh|bash|zsh|script|applescript|osascript|url|fetch|curl|http|json_url|json):\s*(.+)$/i
        )
        if (execMatch) {
          const kind = execMatch[1].toLowerCase()
          const payload = execMatch[2].trim()

          if (kind === 'exec' || kind === 'cli' || kind === 'cmd') {
            const { stdout } = await execAsync(payload, {
              cwd: execCwd,
              timeout: 5000,
              maxBuffer: 512 * 1024
            })
            powerVariables[expr] = stdout.trim()
            continue
          }

          if (kind === 'sh' || kind === 'bash' || kind === 'zsh' || kind === 'script') {
            const shellBin = kind === 'zsh' ? '/bin/zsh' : kind === 'bash' ? '/bin/bash' : '/bin/sh'
            let cmdToRun = payload
            if (payload.startsWith('~/')) {
              cmdToRun = path.join(os.homedir(), payload.slice(2))
            } else if (
              !payload.includes(' ') &&
              !payload.startsWith('/') &&
              fs.existsSync(path.join(execCwd, payload))
            ) {
              cmdToRun = path.join(execCwd, payload)
            }
            const { stdout } = await execAsync(cmdToRun, {
              cwd: execCwd,
              shell: fs.existsSync(shellBin) ? shellBin : undefined,
              timeout: 5000,
              maxBuffer: 512 * 1024
            })
            powerVariables[expr] = stdout.trim()
            continue
          }

          if (kind === 'applescript' || kind === 'osascript') {
            if (process.platform === 'darwin') {
              const { stdout } = await execFileAsync('osascript', ['-e', payload], {
                cwd: execCwd,
                timeout: 5000
              })
              powerVariables[expr] = stdout.trim()
            } else {
              powerVariables[expr] = `[applescript:${payload}]`
            }
            continue
          }

          if (kind === 'url' || kind === 'fetch' || kind === 'curl' || kind === 'http') {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 5000)
            try {
              const res = await fetch(payload, { signal: controller.signal })
              const text = await res.text()
              powerVariables[expr] = text.trim().slice(0, 4000)
            } finally {
              clearTimeout(timer)
            }
            continue
          }

          if (kind === 'json_url' || kind === 'json') {
            const parts = payload.split('|').map((s) => s.trim())
            const targetUrl = parts[0]
            const keyPath = parts[1] || ''
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 5000)
            try {
              const res = await fetch(targetUrl, { signal: controller.signal })
              const data = await res.json()
              if (!keyPath) {
                powerVariables[expr] = JSON.stringify(data)
              } else {
                const val = keyPath
                  .split('.')
                  .reduce<unknown>(
                    (acc, key) =>
                      acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
                    data
                  )
                powerVariables[expr] =
                  val === undefined || val === null
                    ? ''
                    : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val)
              }
            } finally {
              clearTimeout(timer)
            }
            continue
          }
        }
      } catch (err) {
        powerVariables[expr] = `[error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}]`
      }
    }

    return { ...powerVariables, powerVariables }
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
    let targetFilePath = input.targetFilePath
    if (!targetFilePath && process.env.KLARTEXT_E2E_AUTO_SAVE_EXPORT !== '1') {
      let defaultHtmlOut: string
      try {
        defaultHtmlOut = registry.pathGuard.resolveScopedPath(
          input.rootId,
          input.relativePath.replace(/\.(md|markdown)$/i, '') + '.export.html'
        )
      } catch {
        defaultHtmlOut = path.join(
          app.getPath('documents'),
          path.basename(input.relativePath).replace(/\.(md|markdown)$/i, '') + '.export.html'
        )
      }
      const win = getMainWindow()
      const saveRes = await dialog.showSaveDialog(win!, {
        title: 'Export Document to Standalone HTML',
        defaultPath: defaultHtmlOut,
        buttonLabel: 'Export HTML',
        filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }]
      })
      if (saveRes.canceled || !saveRes.filePath) {
        return { outputPath: '', html: '', canceled: true }
      }
      targetFilePath = saveRes.filePath
    }
    return exportService.exportToHtmlFile({
      ...input,
      targetFilePath
    })
  })

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (_e, rawInput) => {
    const input = ExportRequestSchema.parse(rawInput)
    let defaultPdfOut: string
    try {
      defaultPdfOut = registry.pathGuard.resolveScopedPath(
        input.rootId,
        input.relativePath.replace(/\.(md|markdown)$/i, '') + '.pdf'
      )
    } catch {
      defaultPdfOut = path.join(
        app.getPath('documents'),
        path.basename(input.relativePath).replace(/\.(md|markdown)$/i, '') + '.pdf'
      )
    }
    let outputPath = input.targetFilePath
    if (!outputPath && process.env.KLARTEXT_E2E_AUTO_SAVE_EXPORT !== '1') {
      const win = getMainWindow()
      const saveRes = await dialog.showSaveDialog(win!, {
        title: 'Export Document to PDF',
        defaultPath: defaultPdfOut,
        buttonLabel: 'Export PDF',
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })
      if (saveRes.canceled || !saveRes.filePath) {
        return { outputPath: '', sizeBytes: 0, canceled: true }
      }
      outputPath = saveRes.filePath
    }
    outputPath = outputPath || defaultPdfOut

    const html = await exportService.generateStandaloneHtml(input)
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

  ipcMain.handle(IPC_CHANNELS.EXPORT_DOCX, async (_e, rawInput) => {
    const input = ExportRequestSchema.parse(rawInput)
    let defaultDocxOut: string
    try {
      defaultDocxOut = registry.pathGuard.resolveScopedPath(
        input.rootId,
        input.relativePath.replace(/\.(md|markdown)$/i, '') + '.docx'
      )
    } catch {
      defaultDocxOut = path.join(
        app.getPath('documents'),
        path.basename(input.relativePath).replace(/\.(md|markdown)$/i, '') + '.docx'
      )
    }
    let outputPath = input.targetFilePath
    if (!outputPath && process.env.KLARTEXT_E2E_AUTO_SAVE_EXPORT !== '1') {
      const win = getMainWindow()
      const saveRes = await dialog.showSaveDialog(win!, {
        title: 'Export Document to Word (.docx)',
        defaultPath: defaultDocxOut,
        buttonLabel: 'Export DOCX',
        filters: [{ name: 'Word Document (.docx)', extensions: ['docx'] }]
      })
      if (saveRes.canceled || !saveRes.filePath) {
        return { outputPath: '', sizeBytes: 0, canceled: true }
      }
      outputPath = saveRes.filePath
    }
    outputPath = outputPath || defaultDocxOut
    return exportService.exportToDocxFile({
      ...input,
      targetFilePath: outputPath
    })
  })

  ipcMain.handle(IPC_CHANNELS.WEB_FETCH_METADATA, async (_e, rawInput) => {
    const { url } = z.object({ url: z.string().url() }).parse(rawInput)
    if (!isSafeUrl(url)) {
      throw new Error('Blocked unsafe URL')
    }
    return exportService.fetchUrlMetadata(url)
  })

  ipcMain.handle(IPC_CHANNELS.WEB_CLIP_URL, async (_e, rawInput) => {
    const { url } = z.object({ url: z.string().url() }).parse(rawInput)
    if (!isSafeUrl(url)) {
      throw new Error('Blocked unsafe URL')
    }
    return exportService.clipWebPageToMarkdown(url)
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

  ipcMain.handle(IPC_CHANNELS.APP_CHECK_FOR_UPDATES, async (_e, rawInput) => {
    const parsedInput = z
      .object({
        feedUrl: z.string().url().optional()
      })
      .optional()
      .parse(rawInput)

    const currentVersion = APP_METADATA.version.replace(/^v/i, '')
    const checkedAt = Date.now()
    const targetUrl =
      parsedInput?.feedUrl ||
      process.env.KLARTEXT_UPDATE_FEED_URL ||
      APP_METADATA.latestReleaseApiUrl

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(targetUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Klartext/${currentVersion}`
        },
        signal: controller.signal
      })
      clearTimeout(timer)

      if (!response.ok) {
        settingsService.updateSettings({ lastUpdateCheckAt: checkedAt })
        return {
          ok: true,
          currentVersion,
          latestVersion: currentVersion,
          updateAvailable: false,
          releaseUrl: APP_METADATA.releasesUrl,
          checkedAt
        }
      }

      const data = (await response.json()) as {
        tag_name?: string
        name?: string
        html_url?: string
        body?: string
        published_at?: string
        assets?: Array<{ name?: string; browser_download_url?: string }>
      }

      const latestVersion = String(data.tag_name || data.name || currentVersion)
        .trim()
        .replace(/^v/i, '')
      const updateAvailable = compareSemverVersions(latestVersion, currentVersion) > 0
      const macAsset = Array.isArray(data.assets)
        ? data.assets.find(
            (a) =>
              typeof a.browser_download_url === 'string' &&
              /\.(zip|dmg)$/i.test(a.name || a.browser_download_url)
          )
        : undefined

      settingsService.updateSettings({ lastUpdateCheckAt: checkedAt })

      return {
        ok: true,
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseUrl: data.html_url || APP_METADATA.releasesUrl,
        downloadUrl: macAsset?.browser_download_url || data.html_url || APP_METADATA.releasesUrl,
        releaseNotes: typeof data.body === 'string' ? data.body : undefined,
        publishedAt: typeof data.published_at === 'string' ? data.published_at : undefined,
        checkedAt
      }
    } catch (err: any) {
      settingsService.updateSettings({ lastUpdateCheckAt: checkedAt })
      return {
        ok: true,
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        releaseUrl: APP_METADATA.releasesUrl,
        checkedAt,
        error: err?.message ? String(err.message) : undefined
      }
    }
  })
}
