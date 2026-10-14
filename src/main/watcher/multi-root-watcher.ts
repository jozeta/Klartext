import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import type { WatcherChangeEvent } from '../../shared/types'

export class MultiRootWatcher {
  private watchers = new Map<string, FSWatcher>()
  private internalWriteTimestamps = new Map<string, number>()
  private onChangeCallback?: (event: WatcherChangeEvent) => void

  constructor(onChange?: (event: WatcherChangeEvent) => void) {
    this.onChangeCallback = onChange
  }

  setChangeHandler(handler: (event: WatcherChangeEvent) => void): void {
    this.onChangeCallback = handler
  }

  markInternalWrite(rootId: string, relativePath: string): void {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    this.internalWriteTimestamps.set(`${rootId}::${cleanRel}`, Date.now())
  }

  watchRoot(rootId: string, rootPath: string): void {
    this.unwatchRoot(rootId)
    const watcher = chokidar.watch(rootPath, {
      ignored: (filePath: string) => {
        const base = path.basename(filePath)
        if (base === '.git' || base === 'node_modules' || base === '.DS_Store') return true
        if (base.endsWith('.tmp')) return true
        return false
      },
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 40
      }
    })

    const emit = (eventType: 'add' | 'change' | 'unlink', absPath: string) => {
      if (!this.onChangeCallback) return
      const rel = path.relative(rootPath, absPath).replace(/\\/g, '/')
      if (!rel || rel.startsWith('..')) return
      if (eventType === 'change') {
        const lastInternal = this.internalWriteTimestamps.get(`${rootId}::${rel}`)
        if (lastInternal && Date.now() - lastInternal < 5000) {
          return
        }
      }
      this.onChangeCallback({
        rootId,
        relativePath: rel,
        eventType,
        timestamp: Date.now()
      })
    }

    watcher.on('add', (p) => emit('add', p))
    watcher.on('change', (p) => emit('change', p))
    watcher.on('unlink', (p) => emit('unlink', p))

    this.watchers.set(rootId, watcher)
  }

  async unwatchRoot(rootId: string): Promise<void> {
    const existing = this.watchers.get(rootId)
    if (existing) {
      this.watchers.delete(rootId)
      await existing.close()
    }
  }

  async closeAll(): Promise<void> {
    const promises = Array.from(this.watchers.values()).map((w) => w.close())
    this.watchers.clear()
    await Promise.allSettled(promises)
  }
}
