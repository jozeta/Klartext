import simpleGit from 'simple-git'
import type { GitCommitLogEntry, GitPullStrategy, GitRepoStatus } from '../../shared/types'
import { MultiRootRegistry } from '../workspace/multi-root-registry'
import { RecoveryService } from '../recovery/recovery-service'
import { GitRepoInstance } from './repo-instance'

export class MultiRepoManager {
  private instances = new Map<string, GitRepoInstance>()

  constructor(
    private registry: MultiRootRegistry,
    private recoveryService?: RecoveryService
  ) {
    this.syncInstancesWithRegistry()
  }

  syncInstancesWithRegistry(): void {
    const roots = this.registry.getState().roots
    const activeIds = new Set(roots.map((r) => r.id))

    for (const existingId of this.instances.keys()) {
      if (!activeIds.has(existingId)) {
        this.instances.delete(existingId)
      }
    }

    for (const root of roots) {
      const existing = this.instances.get(root.id)
      if (!existing) {
        this.instances.set(
          root.id,
          new GitRepoInstance(root.id, root.name, root.path, this.recoveryService)
        )
      } else {
        existing.rootName = root.name
      }
    }
  }

  getRepo(rootId: string): GitRepoInstance {
    this.syncInstancesWithRegistry()
    const repo = this.instances.get(rootId)
    if (!repo) {
      throw new Error(`No Git controller registered for rootId "${rootId}"`)
    }
    return repo
  }

  async getAllStatuses(): Promise<GitRepoStatus[]> {
    this.syncInstancesWithRegistry()
    const repos = Array.from(this.instances.values())
    const settled = await Promise.allSettled(repos.map((r) => r.getStatus()))
    return settled
      .filter((s): s is PromiseFulfilledResult<GitRepoStatus> => s.status === 'fulfilled')
      .map((s) => s.value)
  }

  /**
   * Executes concurrent `fetch -> pull -> push` across all mounted Git repositories using
   * `Promise.allSettled()` so that a merge conflict or failure in Repo A never aborts Repo B.
   */
  async syncAllRepositories(strategyOverride?: GitPullStrategy): Promise<GitRepoStatus[]> {
    this.syncInstancesWithRegistry()
    const roots = this.registry.getState().roots
    const tasks = roots.map(async (root) => {
      const repo = this.getRepo(root.id)
      const isGit = await repo.isGitRepository()
      if (!isGit) {
        return repo.getStatus()
      }
      const strategy = strategyOverride || root.gitSyncPolicy?.pullStrategy || 'merge'
      return repo.sync(strategy)
    })

    const settled = await Promise.allSettled(tasks)
    return settled.map((res, idx) => {
      if (res.status === 'fulfilled') {
        return res.value
      }
      const root = roots[idx]
      return {
        rootId: root.id,
        rootName: root.name,
        isGitRepo: true,
        state: 'Error',
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        files: [],
        conflictedFiles: [],
        errorMessage: res.reason?.message || String(res.reason)
      }
    })
  }

  async cloneAndMountRepository(params: {
    remoteUrl: string
    targetParentDir: string
    folderName: string
    alias?: string
  }): Promise<{ rootId: string; status: GitRepoStatus }> {
    const pathMod = await import('path')
    const fsMod = await import('fs')
    const destPath = pathMod.resolve(params.targetParentDir, params.folderName)
    await fsMod.promises.mkdir(params.targetParentDir, { recursive: true })

    const git = simpleGit({
      config: ['core.hooksPath=/dev/null'],
      unsafe: { allowUnsafeHooksPath: true }
    })
    await git.clone(params.remoteUrl, destPath)

    const addedRoot = this.registry.addRoot({
      name: params.alias || params.folderName,
      path: destPath
    })
    this.syncInstancesWithRegistry()
    const status = await this.getRepo(addedRoot.id).getStatus()
    return { rootId: addedRoot.id, status }
  }

  async getInterleavedLogs(maxPerRepo = 20): Promise<GitCommitLogEntry[]> {
    this.syncInstancesWithRegistry()
    const repos = Array.from(this.instances.values())
    const settled = await Promise.allSettled(repos.map((r) => r.getLog(maxPerRepo)))
    const combined: GitCommitLogEntry[] = []
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        combined.push(...s.value)
      }
    }
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}
