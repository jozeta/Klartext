import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { RecoverySnapshot } from '../../shared/types'
import { atomicWriteFile } from '../workspace/multi-root-registry'

export class RecoveryService {
  private recoveryDir: string

  constructor(userDataDir: string) {
    this.recoveryDir = path.join(userDataDir, 'recovery-snapshots')
    fs.mkdirSync(this.recoveryDir, { recursive: true })
  }

  private getSnapshotFileName(rootId: string, relativePath: string): string {
    const normalized = `${rootId}::${relativePath.replace(/\\/g, '/')}`
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24)
    return `${hash}.json`
  }

  async saveSnapshot(params: {
    rootId: string
    relativePath: string
    content: string
    reason?: 'autosave-buffer' | 'pre-merge'
  }): Promise<RecoverySnapshot> {
    const key = `${params.rootId}::${params.relativePath.replace(/\\/g, '/')}`
    const snapshot: RecoverySnapshot = {
      key,
      rootId: params.rootId,
      relativePath: params.relativePath.replace(/\\/g, '/'),
      content: params.content,
      savedAt: Date.now(),
      reason: params.reason || 'autosave-buffer'
    }
    const filePath = path.join(
      this.recoveryDir,
      this.getSnapshotFileName(params.rootId, params.relativePath)
    )
    await atomicWriteFile(filePath, JSON.stringify(snapshot, null, 2))
    return snapshot
  }

  async listSnapshots(): Promise<RecoverySnapshot[]> {
    try {
      const files = await fs.promises.readdir(this.recoveryDir)
      const list: RecoverySnapshot[] = []
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const raw = await fs.promises.readFile(path.join(this.recoveryDir, file), 'utf-8')
          const parsed = JSON.parse(raw) as RecoverySnapshot
          if (parsed && parsed.rootId && parsed.relativePath) {
            list.push(parsed)
          }
        } catch {
          // Ignore malformed snapshot
        }
      }
      return list.sort((a, b) => b.savedAt - a.savedAt)
    } catch {
      return []
    }
  }

  async clearSnapshot(rootId: string, relativePath: string): Promise<void> {
    const filePath = path.join(this.recoveryDir, this.getSnapshotFileName(rootId, relativePath))
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath)
      }
    } catch {
      // Ignore missing
    }
  }
}
