import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AutosaveScheduler } from '../../renderer/features/editor/autosave-scheduler'

describe('AutosaveScheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('editing another tab does not cancel this tab’s pending save', async () => {
    const saved: string[] = []
    const s = new AutosaveScheduler()
    s.schedule('A', 900, async () => void saved.push('A'))
    vi.advanceTimersByTime(300)
    s.schedule('B', 900, async () => void saved.push('B'))
    await vi.advanceTimersByTimeAsync(900)
    expect(saved.sort()).toEqual(['A', 'B'])
  })

  it('debounces repeated edits in the same tab to the latest content', async () => {
    const saved: string[] = []
    const s = new AutosaveScheduler()
    s.schedule('A', 900, async () => void saved.push('v1'))
    vi.advanceTimersByTime(500)
    s.schedule('A', 900, async () => void saved.push('v2'))
    await vi.advanceTimersByTimeAsync(900)
    expect(saved).toEqual(['v2'])
  })

  it('flushAll writes pending saves at once and waits for saves already running', async () => {
    const saved: string[] = []
    let finishRunning: () => void = () => {}
    const s = new AutosaveScheduler()
    s.schedule('running', 10, () => new Promise<void>((r) => (finishRunning = () => (saved.push('running'), r()))))
    await vi.advanceTimersByTimeAsync(10) // started, not finished
    s.schedule('pending', 900, async () => void saved.push('pending'))

    let flushed = false
    const flush = s.flushAll().then(() => (flushed = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(saved).toEqual(['pending'])
    expect(flushed).toBe(false)
    finishRunning()
    await flush
    expect(saved).toEqual(['pending', 'running'])
    expect(s.hasPending()).toBe(false)
  })

  it('flush(key) saves just that tab, once', async () => {
    const save = vi.fn(async () => {})
    const s = new AutosaveScheduler()
    s.schedule('A', 900, save)
    await s.flush('A')
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
    await s.flush('missing')
  })

  it('a failing save is reported and does not break other saves', async () => {
    const onError = vi.fn()
    const saved: string[] = []
    const s = new AutosaveScheduler(onError)
    s.schedule('bad', 10, async () => {
      throw new Error('disk full')
    })
    s.schedule('good', 10, async () => void saved.push('good'))
    await vi.advanceTimersByTimeAsync(10)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(saved).toEqual(['good'])
  })
})
