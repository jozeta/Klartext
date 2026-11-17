import crypto from 'crypto'
import { FlushDoneRequestSchema } from '../../shared/schemas'

// Closing the window or quitting the app first asks the renderer to write any autosave that is
// still waiting for its debounce timer, so the last edits aren't lost. Main sends
// EVENT_FLUSH_PENDING_SAVES with a request id; the renderer answers with APP_FLUSH_DONE and the
// same id. A renderer that never answers (hung, crashed) can't block closing: after the timeout
// main closes anyway.

const pending = new Map<string, () => void>()

export const FLUSH_TIMEOUT_MS = 3000

export function requestRendererFlush(
  send: (payload: { requestId: string }) => void,
  timeoutMs = FLUSH_TIMEOUT_MS
): Promise<'done' | 'timeout'> {
  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      resolve('timeout')
    }, timeoutMs)
    pending.set(requestId, () => {
      clearTimeout(timer)
      pending.delete(requestId)
      resolve('done')
    })
    try {
      send({ requestId })
    } catch {
      // Nothing to wait for if the message can't be sent (window already gone).
      pending.get(requestId)?.()
    }
  })
}

/** IPC handler body for APP_FLUSH_DONE. Throws on a malformed payload. */
export function handleFlushDone(rawInput: unknown): void {
  const { requestId } = FlushDoneRequestSchema.parse(rawInput)
  pending.get(requestId)?.()
}
