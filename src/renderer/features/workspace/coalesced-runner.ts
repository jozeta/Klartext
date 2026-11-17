// Coalesces bursts of triggers into one run of an async task.
//
// Every file-watcher event used to re-list every root's file tree and run `git status` on every
// repository, so a branch checkout touching 500 files caused 500 full rescans. Now triggers within
// `delayMs` of each other share one run, runs never overlap, and triggers that arrive during a run
// cause exactly one follow-up run.

export function createCoalescedRunner(task: () => Promise<void>, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let rerunRequested = false

  const start = async () => {
    timer = null
    if (running) {
      rerunRequested = true
      return
    }
    running = true
    try {
      await task()
    } catch (err) {
      console.error('[Klartext] Refresh failed', err)
    } finally {
      running = false
      if (rerunRequested) {
        rerunRequested = false
        trigger()
      }
    }
  }

  const trigger = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void start(), delayMs)
  }

  return trigger
}
