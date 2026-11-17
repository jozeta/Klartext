import { describe, it, expect } from 'vitest'
import {
  requestRendererFlush,
  handleFlushDone
} from '../../main/ipc/flush-before-close'
import { FlushDoneRequestSchema } from '../../shared/schemas'

// Closing the window or quitting first asks the renderer to finish pending autosaves.

describe('Flush pending saves before close', () => {
  it('resolves "done" once the renderer reports back with the matching request id', async () => {
    const result = await requestRendererFlush((payload) => {
      setTimeout(() => handleFlushDone({ requestId: payload.requestId }), 5)
    }, 1000)
    expect(result).toBe('done')
  })

  it('gives up after the timeout so a hung renderer can never block quitting', async () => {
    const result = await requestRendererFlush(() => {}, 30)
    expect(result).toBe('timeout')
  })

  it('ignores a reply for an unknown request id', async () => {
    const result = await requestRendererFlush(() => {
      handleFlushDone({ requestId: 'someone-else' })
    }, 30)
    expect(result).toBe('timeout')
  })

  it('validates the renderer payload', () => {
    expect(() => handleFlushDone({ requestId: 42 })).toThrow()
    expect(() => handleFlushDone(undefined)).toThrow()
    expect(FlushDoneRequestSchema.safeParse({ requestId: 'x'.repeat(200) }).success).toBe(false)
  })
})
