import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, afterEach } from 'vitest'
import { MultiRootWatcher } from '../../main/watcher/multi-root-watcher'
import type { WatcherChangeEvent } from '../../shared/types'

// Klartext's own saves must not come back as "changed on disk", but a change made by another
// program right after one of our saves (git pull, Dropbox, another editor) must.

const waitFor = async (cond: () => boolean, ms = 4000) => {
  const start = Date.now()
  while (!cond() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 50))
}

describe('MultiRootWatcher', () => {
  let watcher: MultiRootWatcher | null = null
  afterEach(async () => {
    await watcher?.closeAll()
    watcher = null
  })

  it('ignores our own write but reports an external change made right after it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-watch-'))
    const file = path.join(dir, 'note.md')
    fs.writeFileSync(file, 'v0')
    const events: WatcherChangeEvent[] = []
    watcher = new MultiRootWatcher((ev) => events.push(ev))
    await watcher.watchRoot('R', dir)

    watcher.markInternalWrite('R', 'note.md', 'v1 ours')
    fs.writeFileSync(file, 'v1 ours')
    await new Promise((r) => setTimeout(r, 800))
    expect(events.filter((e) => e.eventType === 'change')).toHaveLength(0)

    fs.writeFileSync(file, 'v2 from git pull')
    await waitFor(() => events.some((e) => e.eventType === 'change'))
    expect(events.filter((e) => e.eventType === 'change').map((e) => e.relativePath)).toEqual(['note.md'])
  }, 10000)
})
