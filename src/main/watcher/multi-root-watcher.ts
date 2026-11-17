import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import chokidar, { type FSWatcher } from 'chokidar'
import type { WatcherChangeEvent } from '../../shared/types'

export class MultiRootWatcher {
  private watchers = new Map<string, FSWatcher>()
  // Hash of the content Klartext last wrote to each file. A change event whose file content still
  // matches is our own save; anything else is a real external change, even one made a moment after
  // our save (a time window used to hide those, and the next autosave then overwrote them).
  private internalWriteHashes = new Map<string, string>()
  private onChangeCallback?: (event: WatcherChangeEvent) => void

  constructor(onChange?: (event: WatcherChangeEvent) => void) {
    this.onChangeCallback = onChange
  }

  setChangeHandler(handler: (event: WatcherChangeEvent) => void): void {
    this.onChangeCallback = handler
  }

  markInternalWrite(rootId: string, relativePath: string, content: string | Buffer): void {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    this.internalWriteHashes.set(`${rootId}::${cleanRel}`, hashContent(content))
  }

  /** Starts watching; resolves once the initial scan is done (callers may ignore the promise). */
  watchRoot(rootId: string, rootPath: string): Promise<void> {
    void this.unwatchRoot(rootId)
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

    const emit = async (eventType: 'add' | 'change' | 'unlink', absPath: string) => {
      if (!this.onChangeCallback) return
      const rel = path.relative(rootPath, absPath).replace(/\\/g, '/')
      if (!rel || rel.startsWith('..')) return
      const key = `${rootId}::${rel}`
      if (eventType === 'unlink') {
        this.internalWriteHashes.delete(key)
      } else {
        const ours = this.internalWriteHashes.get(key)
        if (ours) {
          try {
            if (hashContent(await fs.promises.readFile(absPath)) === ours) return
          } catch {
            // Unreadable right now: report it and let the renderer re-read.
          }
        }
      }
      this.onChangeCallback?.({
        rootId,
        relativePath: rel,
        eventType,
        timestamp: Date.now()
      })
    }

    watcher.on('add', (p) => void emit('add', p))
    watcher.on('change', (p) => void emit('change', p))
    watcher.on('unlink', (p) => void emit('unlink', p))

    this.watchers.set(rootId, watcher)
    return new Promise((resolve) => {
      watcher.once('ready', () => resolve())
      watcher.once('error', () => resolve())
    })
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

function hashContent(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}
