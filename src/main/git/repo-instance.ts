import fs from 'fs'
import path from 'path'
import simpleGit, { type SimpleGit } from 'simple-git'
import type {
  GitCommitLogEntry,
  GitFileStatus,
  GitPullStrategy,
  GitRepoStateType,
  GitRepoStatus
} from '../../shared/types'
import { hasConflictMarkers, resolveAllConflictHunksInText, resolveConflictHunkInText } from './conflict-resolver'
import { atomicWriteFile } from '../workspace/multi-root-registry'
import { RecoveryService } from '../recovery/recovery-service'

export class GitRepoInstance {
  private git: SimpleGit
  private mutexPromise: Promise<unknown> = Promise.resolve()
  private isSyncing = false
  private lastSyncAt?: number
  private lastError?: string

  constructor(
    public readonly rootId: string,
    public rootName: string,
    public readonly rootPath: string,
    private recoveryService?: RecoveryService
  ) {
    this.git = simpleGit({
      baseDir: this.rootPath,
      binary: 'git',
      maxConcurrentProcesses: 1,
      config: ['core.hooksPath=/dev/null'],
      unsafe: {
        allowUnsafeHooksPath: true
      }
    })
  }

  /**
   * Serializes all Git operations per repository so concurrent clicks or background fetches
   * never collide on `.git/index.lock`.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.mutexPromise.then(task, task)
    this.mutexPromise = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  async isGitRepository(): Promise<boolean> {
    const gitMarker = path.join(this.rootPath, '.git')
    if (fs.existsSync(gitMarker)) return true
    try {
      return await this.git.checkIsRepo()
    } catch {
      return false
    }
  }

  async initRepo(): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      await this.git.init()
    })
    return this.getStatus()
  }

  async getStatus(): Promise<GitRepoStatus> {
    return this.enqueue(async () => {
      const isRepo = await this.isGitRepository()
      if (!isRepo) {
        return {
          rootId: this.rootId,
          rootName: this.rootName,
          isGitRepo: false,
          state: 'Not a Git Repo',
          branch: 'local',
          ahead: 0,
          behind: 0,
          files: [],
          conflictedFiles: []
        }
      }

      try {
        const status = await this.git.status()
        const files: GitFileStatus[] = status.files.map((f) => ({
          relativePath: f.path,
          index: f.index,
          workingDir: f.working_dir,
          isConflicted:
            status.conflicted.includes(f.path) ||
            f.index === 'U' ||
            f.working_dir === 'U' ||
            (f.index === 'A' && f.working_dir === 'A')
        }))

        // Also inspect modified markdown files for raw conflict markers
        const conflictedSet = new Set<string>(status.conflicted)
        for (const f of files) {
          if (f.isConflicted) conflictedSet.add(f.relativePath)
          const abs = path.join(this.rootPath, f.relativePath)
          if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            try {
              const content = await fs.promises.readFile(abs, 'utf-8')
              if (hasConflictMarkers(content)) {
                conflictedSet.add(f.relativePath)
                f.isConflicted = true
              }
            } catch {
              // Binary file or unreadable
            }
          }
        }

        const conflictedFiles = Array.from(conflictedSet)
        let state: GitRepoStateType = 'Synced'

        if (this.isSyncing) {
          state = 'Syncing'
        } else if (conflictedFiles.length > 0) {
          state = 'Merge Conflict'
        } else if (this.lastError) {
          if (/auth|permission|403|401|credential/i.test(this.lastError)) {
            state = 'Auth Required'
          } else if (/could not resolve host|offline|network/i.test(this.lastError)) {
            state = 'Offline'
          } else {
            state = 'Error'
          }
        } else if (status.ahead > 0 && status.behind > 0) {
          state = 'Diverged'
        } else if (status.staged.length > 0) {
          state = 'Staged'
        } else if (status.modified.length > 0 || status.deleted.length > 0) {
          state = 'Modified'
        } else if (status.not_added.length > 0) {
          state = 'Untracked'
        } else if (status.ahead > 0) {
          state = 'Ahead'
        } else if (status.behind > 0) {
          state = 'Behind'
        }

        return {
          rootId: this.rootId,
          rootName: this.rootName,
          isGitRepo: true,
          state,
          branch: status.current || 'HEAD',
          tracking: status.tracking || undefined,
          ahead: status.ahead,
          behind: status.behind,
          files,
          conflictedFiles,
          lastSyncAt: this.lastSyncAt,
          errorMessage: this.lastError
        }
      } catch (err: any) {
        return {
          rootId: this.rootId,
          rootName: this.rootName,
          isGitRepo: true,
          state: 'Error',
          branch: 'unknown',
          ahead: 0,
          behind: 0,
          files: [],
          conflictedFiles: [],
          errorMessage: err?.message || String(err)
        }
      }
    })
  }

  async stageFiles(files?: string[]): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      const targetFiles = files && files.length > 0 ? files : ['.']
      // Prevent staging files that still contain unresolved <<<<<<< conflict markers
      for (const rel of targetFiles) {
        if (rel === '.') continue
        const abs = path.join(this.rootPath, rel)
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          const text = await fs.promises.readFile(abs, 'utf-8')
          if (hasConflictMarkers(text)) {
            throw new Error(
              `Cannot stage "${rel}" while it still contains unresolved conflict markers (<<<<<<<)`
            )
          }
        }
      }
      await this.git.add(targetFiles)
      this.lastError = undefined
    })
    return this.getStatus()
  }

  async unstageFiles(files?: string[]): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      const targetFiles = files && files.length > 0 ? files : ['.']
      await this.git.reset(['HEAD', '--', ...targetFiles])
    })
    return this.getStatus()
  }

  async getDiff(relativePath?: string): Promise<string> {
    return this.enqueue(async () => {
      if (relativePath) {
        return await this.git.diff(['--', relativePath])
      }
      return await this.git.diff()
    })
  }

  async commit(message: string, files?: string[]): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      if (files && files.length > 0) {
        await this.git.add(files)
      }
      await this.git.commit(message)
      this.lastError = undefined
    })
    return this.getStatus()
  }

  private async snapshotModifiedFilesBeforeMerge(): Promise<void> {
    if (!this.recoveryService) return
    try {
      const status = await this.git.status()
      for (const f of status.files) {
        const abs = path.join(this.rootPath, f.path)
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          const content = await fs.promises.readFile(abs, 'utf-8')
          await this.recoveryService.saveSnapshot({
            rootId: this.rootId,
            relativePath: f.path,
            content,
            reason: 'pre-merge'
          })
        }
      }
    } catch {
      // Non-fatal
    }
  }

  async fetch(): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      try {
        await this.git.fetch()
        this.lastError = undefined
      } catch (err: any) {
        this.lastError = err?.message || String(err)
      }
    })
    return this.getStatus()
  }

  async pull(strategy: GitPullStrategy = 'merge'): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      this.isSyncing = true
      await this.snapshotModifiedFilesBeforeMerge()
      try {
        const options = strategy === 'rebase' ? { '--rebase': 'true' } : { '--no-rebase': null }
        await this.git.pull(undefined, undefined, options as any)
        this.lastError = undefined
        this.lastSyncAt = Date.now()
      } catch (err: any) {
        const msg = err?.message || String(err)
        if (!/CONFLICT|Merge conflict/i.test(msg)) {
          this.lastError = msg
        } else {
          this.lastError = undefined
        }
      } finally {
        this.isSyncing = false
      }
    })
    return this.getStatus()
  }

  async push(): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      this.isSyncing = true
      try {
        const status = await this.git.status()
        if (status.conflicted.length > 0) {
          throw new Error('Cannot push while repository has unresolved merge conflicts')
        }
        await this.git.push()
        this.lastError = undefined
        this.lastSyncAt = Date.now()
      } catch (err: any) {
        this.lastError = err?.message || String(err)
      } finally {
        this.isSyncing = false
      }
    })
    return this.getStatus()
  }

  async sync(strategy: GitPullStrategy = 'merge'): Promise<GitRepoStatus> {
    await this.fetch()
    const afterPull = await this.pull(strategy)
    if (afterPull.state === 'Merge Conflict' || afterPull.state === 'Error') {
      return afterPull
    }
    if (afterPull.ahead > 0) {
      return await this.push()
    }
    return afterPull
  }

  async resolveConflictInFile(params: {
    relativePath: string
    hunkIndex?: number
    resolution: 'current' | 'incoming' | 'both' | 'custom'
    customContent?: string
  }): Promise<{ updatedContent: string; remainingConflicts: number; status: GitRepoStatus }> {
    const absPath = path.join(this.rootPath, params.relativePath)
    const raw = await fs.promises.readFile(absPath, 'utf-8')

    let updated: string
    if (params.hunkIndex !== undefined || params.resolution === 'custom') {
      updated = resolveConflictHunkInText(
        raw,
        params.resolution,
        params.hunkIndex ?? 0,
        params.customContent
      )
    } else {
      updated = resolveAllConflictHunksInText(raw, params.resolution)
    }

    await atomicWriteFile(absPath, updated)

    if (!hasConflictMarkers(updated)) {
      await this.enqueue(async () => {
        await this.git.add([params.relativePath])
      })
    }

    const status = await this.getStatus()
    return {
      updatedContent: updated,
      remainingConflicts: status.conflictedFiles.length,
      status
    }
  }

  async abortMergeOrRebase(): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      const gitDir = path.join(this.rootPath, '.git')
      if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
        await this.git.raw(['merge', '--abort'])
      } else if (
        fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
        fs.existsSync(path.join(gitDir, 'rebase-apply'))
      ) {
        await this.git.raw(['rebase', '--abort'])
      }
      this.lastError = undefined
    })
    return this.getStatus()
  }

  async listBranches(): Promise<{ current: string; all: string[] }> {
    return this.enqueue(async () => {
      const isRepo = await this.isGitRepository()
      if (!isRepo) return { current: 'local', all: [] }
      const summary = await this.git.branchLocal()
      return { current: summary.current, all: summary.all }
    })
  }

  async checkoutBranch(branch: string, createNew = false): Promise<GitRepoStatus> {
    await this.enqueue(async () => {
      if (createNew) {
        await this.git.checkoutLocalBranch(branch)
      } else {
        await this.git.checkout(branch)
      }
    })
    return this.getStatus()
  }

  async getLog(maxCount = 30): Promise<GitCommitLogEntry[]> {
    return this.enqueue(async () => {
      const isRepo = await this.isGitRepository()
      if (!isRepo) return []
      try {
        const log = await this.git.log({ maxCount })
        return log.all.map((entry) => ({
          hash: entry.hash,
          date: entry.date,
          message: entry.message,
          authorName: entry.author_name,
          authorEmail: entry.author_email,
          rootId: this.rootId,
          rootName: this.rootName
        }))
      } catch {
        return []
      }
    })
  }
}
