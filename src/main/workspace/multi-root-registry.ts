import fs from 'fs'
import path from 'path'
import { WorkspaceManifestSchema, PerRootConfigSchema, type WorkspaceManifest } from '../../shared/schemas'
import type { FileTreeNode, WorkspaceRoot } from '../../shared/types'
import { MultiRootPathGuard, isSensitiveSystemPath, isStrictSubpath } from '../security/path-guard'

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.DS_Store', 'dist', 'out'])

// On Windows, renaming over a file fails with EPERM/EBUSY/EACCES while another handle has it open
// (our own file watcher reading a change, an antivirus scanner, the search indexer). The lock is
// released within milliseconds, so retry with a short backoff instead of failing the save. This is
// the same workaround graceful-fs uses. On other platforms these errors are real, so fail at once.
const TRANSIENT_RENAME_ERRORS = new Set(['EPERM', 'EBUSY', 'EACCES'])

export async function renameWithRetry(
  from: string,
  to: string,
  options: {
    platform?: NodeJS.Platform
    rename?: (from: string, to: string) => Promise<void>
    delaysMs?: number[]
  } = {}
): Promise<void> {
  const platform = options.platform ?? process.platform
  const rename = options.rename ?? fs.promises.rename
  const delaysMs = options.delaysMs ?? [10, 25, 50, 100, 200, 400, 800]
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? ''
      const retryable = platform === 'win32' && TRANSIENT_RENAME_ERRORS.has(code)
      if (!retryable || attempt >= delaysMs.length) throw err
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]))
    }
  }
}

export async function atomicWriteFile(filePath: string, content: string | Buffer): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.promises.mkdir(dir, { recursive: true })
  const tmpPath = `${filePath}.klartext-${process.pid}-${Date.now()}.tmp`
  await fs.promises.writeFile(tmpPath, content)
  try {
    await renameWithRetry(tmpPath, filePath)
  } catch (err) {
    // Don't leave a stray .tmp file next to the user's document.
    await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined)
    throw err
  }
}

/** Synchronous variant of atomicWriteFile for state that is saved from synchronous code paths. */
export function atomicWriteFileSync(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.klartext-${process.pid}-${Date.now()}.tmp`
  fs.writeFileSync(tmpPath, content, 'utf-8')
  try {
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    fs.rmSync(tmpPath, { force: true })
    throw err
  }
}

export class MultiRootRegistry {
  private roots: WorkspaceRoot[] = []
  // Roots from the saved workspace whose folder was missing at startup (an unplugged drive, a
  // network share that isn't mounted yet). They are not mounted, but are kept in the saved state so
  // they come back once the folder is there again.
  private unavailableRoots: WorkspaceRoot[] = []
  private workspaceName = 'Klartext Workspace'
  private stateFilePath: string
  public readonly pathGuard: MultiRootPathGuard

  constructor(userDataDir: string, pathGuard?: MultiRootPathGuard) {
    this.pathGuard = pathGuard || new MultiRootPathGuard()
    this.stateFilePath = path.join(userDataDir, 'workspace-state.json')
    this.loadPersistedState()
  }

  private loadPersistedState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf-8'))
        const parsed = WorkspaceManifestSchema.safeParse(raw)
        if (parsed.success) {
          this.workspaceName = parsed.data.name
          for (const root of parsed.data.roots) {
            if (!fs.existsSync(path.resolve(root.path))) {
              this.unavailableRoots.push(root)
              continue
            }
            try {
              this.addRoot(root, false, { createIfMissing: false })
            } catch {
              // Skip invalid roots from previous session
            }
          }
        }
      }
    } catch {
      // Ignore corrupt state file on startup
    }
  }

  private persistState(): void {
    try {
      const mountedIds = new Set(this.roots.map((r) => r.id))
      const manifest: WorkspaceManifest = {
        version: 1,
        name: this.workspaceName,
        roots: [...this.roots, ...this.unavailableRoots.filter((r) => !mountedIds.has(r.id))]
      }
      atomicWriteFileSync(this.stateFilePath, JSON.stringify(manifest, null, 2))
    } catch {
      // Non-fatal in test environments
    }
  }

  getState(): { name: string; roots: WorkspaceRoot[] } {
    return {
      name: this.workspaceName,
      roots: [...this.roots]
    }
  }

  addRoot(
    input: {
      id?: string
      name?: string
      path: string
      assetDir?: string
      gitSyncPolicy?: WorkspaceRoot['gitSyncPolicy']
    },
    persist = true,
    options: { createIfMissing?: boolean } = {}
  ): WorkspaceRoot {
    const resolvedPath = path.resolve(input.path)
    if (isSensitiveSystemPath(resolvedPath)) {
      throw new Error(`Security rejection: Sensitive path "${resolvedPath}" cannot be mounted`)
    }
    if (!fs.existsSync(resolvedPath)) {
      // Mounting a new folder from the UI creates it; restoring a saved workspace or loading a
      // manifest never does (see loadPersistedState / loadManifestFromFile).
      if (options.createIfMissing === false) {
        throw new Error(`Root folder does not exist: "${resolvedPath}"`)
      }
      fs.mkdirSync(resolvedPath, { recursive: true })
    }

    const existing = this.roots.find((r) => path.resolve(r.path) === resolvedPath)
    if (existing) {
      return existing
    }

    // Check optional per-root .klartext/workspace.json overrides
    let assetDir = input.assetDir || 'assets'
    const perRootConfigFile = path.join(resolvedPath, '.klartext', 'workspace.json')
    if (fs.existsSync(perRootConfigFile)) {
      try {
        const rawConfig = JSON.parse(fs.readFileSync(perRootConfigFile, 'utf-8'))
        const parsedConfig = PerRootConfigSchema.safeParse(rawConfig)
        if (parsedConfig.success && parsedConfig.data.assetDir) {
          assetDir = parsedConfig.data.assetDir
        }
      } catch {
        // Ignore invalid per-root config
      }
    }

    const baseName = input.name || path.basename(resolvedPath) || 'Root'
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root'
    let id = input.id || `root-${slug}`
    let counter = 2
    while (this.roots.some((r) => r.id === id)) {
      id = `root-${slug}-${counter++}`
    }

    this.pathGuard.registerRoot({
      id,
      name: baseName,
      path: resolvedPath,
      assetDir
    })

    const rootEntry: WorkspaceRoot = {
      id,
      name: baseName,
      path: resolvedPath,
      assetDir,
      gitSyncPolicy: input.gitSyncPolicy || {
        autoFetch: true,
        fetchIntervalSec: 180,
        pullStrategy: 'rebase',
        autoSyncMode: 'auto-fetch'
      }
    }

    this.roots.push(rootEntry)
    this.unavailableRoots = this.unavailableRoots.filter(
      (r) => r.id !== id && path.resolve(r.path) !== resolvedPath
    )
    if (persist) this.persistState()
    return rootEntry
  }

  removeRoot(rootId: string): void {
    this.roots = this.roots.filter((r) => r.id !== rootId)
    this.unavailableRoots = this.unavailableRoots.filter((r) => r.id !== rootId)
    this.pathGuard.unregisterRoot(rootId)
    this.persistState()
  }

  reorderRoots(orderedIds: string[]): WorkspaceRoot[] {
    const map = new Map(this.roots.map((r) => [r.id, r]))
    const next: WorkspaceRoot[] = []
    for (const id of orderedIds) {
      const found = map.get(id)
      if (found) {
        next.push(found)
        map.delete(id)
      }
    }
    for (const remaining of map.values()) {
      next.push(remaining)
    }
    this.roots = next
    this.persistState()
    return [...this.roots]
  }

  renameRoot(rootId: string, newName: string): WorkspaceRoot {
    const root = this.roots.find((r) => r.id === rootId)
    if (!root) throw new Error(`Unknown rootId: ${rootId}`)
    root.name = newName.trim() || root.name
    this.persistState()
    return root
  }

  async saveManifestToFile(filePath: string, name?: string): Promise<WorkspaceManifest> {
    if (name) this.workspaceName = name
    const manifest: WorkspaceManifest = {
      version: 1,
      name: this.workspaceName,
      roots: this.roots,
      settings: {
        defaultEditMode: 'inline',
        theme: 'system'
      }
    }
    const validated = WorkspaceManifestSchema.parse(manifest)
    await atomicWriteFile(filePath, JSON.stringify(validated, null, 2))
    return validated
  }

  async loadManifestFromFile(
    filePath: string,
    approveUntrustedPaths: (paths: string[]) => Promise<boolean> = async () => true
  ): Promise<WorkspaceManifest> {
    const raw = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'))
    const validated = WorkspaceManifestSchema.parse(raw)

    for (const r of validated.roots) {
      if (isSensitiveSystemPath(r.path)) {
        throw new Error(
          `Security rejection: Manifest contains sensitive system directory "${r.path}"`
        )
      }
    }

    const approved = await approveUntrustedPaths(validated.roots.map((r) => r.path))
    if (!approved) {
      throw new Error('User declined mounting workspace manifest root directories')
    }

    this.roots = []
    this.unavailableRoots = []
    this.pathGuard.clearRoots()
    this.workspaceName = validated.name

    for (const r of validated.roots) {
      // A manifest (possibly from someone else) never creates folders; missing ones are kept for
      // later, like a saved workspace whose drive is unplugged.
      if (!fs.existsSync(path.resolve(r.path))) {
        this.unavailableRoots.push(r)
        continue
      }
      this.addRoot(r, false, { createIfMissing: false })
    }
    this.persistState()
    return validated
  }

  async listFilesForRoot(rootId: string, dirRelPath = ''): Promise<FileTreeNode[]> {
    const targetDir = this.pathGuard.resolveScopedPath(rootId, dirRelPath)
    const rootReal = this.pathGuard.getRoot(rootId).realPath

    const readRecursive = async (currentAbs: string, currentRel: string): Promise<FileTreeNode[]> => {
      let entries: fs.Dirent[] = []
      try {
        entries = await fs.promises.readdir(currentAbs, { withFileTypes: true })
      } catch {
        return []
      }

      const nodes: FileTreeNode[] = []
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.endsWith('.tmp')) continue
        const entryRel = currentRel ? `${currentRel}/${entry.name}` : entry.name
        const entryAbs = path.join(currentAbs, entry.name)

        // Symlinks are listed only when their target stays inside the owning root. A symlink's
        // Dirent is neither a file nor a directory, so classify it by what it points to.
        let isDirectory = entry.isDirectory()
        let isFile = entry.isFile()
        if (entry.isSymbolicLink()) {
          try {
            const symReal = await fs.promises.realpath(entryAbs)
            if (!isStrictSubpath(rootReal, symReal)) continue
            // A link to a folder that contains it would make the tree endless.
            if (isStrictSubpath(symReal, await fs.promises.realpath(currentAbs))) continue
            const targetStat = await fs.promises.stat(symReal)
            isDirectory = targetStat.isDirectory()
            isFile = targetStat.isFile()
          } catch {
            continue
          }
        }

        if (isDirectory) {
          const children = await readRecursive(entryAbs, entryRel)
          nodes.push({
            name: entry.name,
            relativePath: entryRel,
            rootId,
            isDirectory: true,
            children
          })
        } else if (isFile) {
          const stat = await fs.promises.stat(entryAbs)
          nodes.push({
            name: entry.name,
            relativePath: entryRel,
            rootId,
            isDirectory: false,
            size: stat.size,
            updatedAt: stat.mtimeMs
          })
        }
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }

    return readRecursive(targetDir, dirRelPath)
  }
}
