// Debounced autosave, one timer per open document.
//
// A single shared timer meant that typing in tab B (split view, or a quick tab switch) cancelled
// tab A's pending save, and quitting within the debounce delay lost the last edits. Each document
// now has its own timer, and flush()/flushAll() write pending saves immediately (on tab close, and
// before the window closes or the app quits), also waiting for saves that are already running.

type Save = () => Promise<void>

export class AutosaveScheduler {
  private pending = new Map<string, { timer: ReturnType<typeof setTimeout>; save: Save }>()
  private running = new Set<Promise<void>>()

  constructor(private onError: (err: unknown) => void = () => {}) {}

  /** (Re)starts `key`'s timer; when it fires, `save` runs. A newer schedule replaces an older one. */
  schedule(key: string, delayMs: number, save: Save): void {
    const previous = this.pending.get(key)
    if (previous) clearTimeout(previous.timer)
    const timer = setTimeout(() => void this.flush(key), delayMs)
    this.pending.set(key, { timer, save })
  }

  /** Runs `key`'s pending save now (if any) and resolves when it is written. Never rejects. */
  flush(key: string): Promise<void> {
    const entry = this.pending.get(key)
    if (!entry) return Promise.resolve()
    clearTimeout(entry.timer)
    this.pending.delete(key)
    const promise = entry.save().catch((err) => this.onError(err))
    this.running.add(promise)
    return promise.finally(() => this.running.delete(promise))
  }

  /** Writes every pending save and waits for saves already in progress. */
  async flushAll(): Promise<void> {
    const keys = Array.from(this.pending.keys())
    await Promise.all([...keys.map((key) => this.flush(key)), ...Array.from(this.running)])
  }

  hasPending(): boolean {
    return this.pending.size > 0 || this.running.size > 0
  }
}
