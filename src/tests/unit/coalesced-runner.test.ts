import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCoalescedRunner } from '../../renderer/features/workspace/coalesced-runner'

describe('createCoalescedRunner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('turns a burst of file events (e.g. a branch checkout) into one refresh', async () => {
    const run = vi.fn(async () => {})
    const trigger = createCoalescedRunner(run, 250)
    for (let i = 0; i < 500; i++) trigger()
    await vi.advanceTimersByTimeAsync(250)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('runs once more if events arrive while a refresh is in progress, never in parallel', async () => {
    let active = 0
    let maxActive = 0
    let finish: () => void = () => {}
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active++
          maxActive = Math.max(maxActive, active)
          finish = () => {
            active--
            resolve()
          }
        })
    )
    const trigger = createCoalescedRunner(run, 100)
    trigger()
    await vi.advanceTimersByTimeAsync(100) // first run starts
    trigger()
    trigger()
    await vi.advanceTimersByTimeAsync(100) // still running: must not start a second one yet
    expect(run).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)
    expect(run).toHaveBeenCalledTimes(2)
    finish()
    await vi.advanceTimersByTimeAsync(500)
    expect(run).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
  })

  it('keeps working after a failed run', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const trigger = createCoalescedRunner(run, 10)
    trigger()
    await vi.advanceTimersByTimeAsync(10)
    trigger()
    await vi.advanceTimersByTimeAsync(10)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
