import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, afterEach } from 'vitest'
import { atomicWriteFile, renameWithRetry } from '../../main/workspace/multi-root-registry'

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: operation not permitted, rename`), { code })
}

/** A rename that fails with `code` for the first `failures` calls, then succeeds. */
function flakyRename(code: string, failures: number) {
  const calls: string[] = []
  const rename = async (from: string, to: string) => {
    calls.push(`${from}->${to}`)
    if (calls.length <= failures) throw errno(code)
  }
  return { rename, calls }
}

describe('renameWithRetry (Windows file locks)', () => {
  const noDelay = [0, 0, 0, 0]

  it('retries while Windows reports the target as locked, then succeeds', async () => {
    for (const code of ['EPERM', 'EBUSY', 'EACCES']) {
      const { rename, calls } = flakyRename(code, 2)
      await renameWithRetry('a.tmp', 'a.md', { platform: 'win32', rename, delaysMs: noDelay })
      expect(calls).toHaveLength(3)
    }
  })

  it('gives up after the last retry and rethrows the original error', async () => {
    const { rename, calls } = flakyRename('EPERM', 99)
    await expect(
      renameWithRetry('a.tmp', 'a.md', { platform: 'win32', rename, delaysMs: noDelay })
    ).rejects.toMatchObject({ code: 'EPERM' })
    expect(calls).toHaveLength(noDelay.length + 1)
  })

  it('does not retry on other platforms or for other errors', async () => {
    const mac = flakyRename('EPERM', 1)
    await expect(
      renameWithRetry('a.tmp', 'a.md', { platform: 'darwin', rename: mac.rename, delaysMs: noDelay })
    ).rejects.toMatchObject({ code: 'EPERM' })
    expect(mac.calls).toHaveLength(1)

    const missing = flakyRename('ENOENT', 1)
    await expect(
      renameWithRetry('a.tmp', 'a.md', { platform: 'win32', rename: missing.rename, delaysMs: noDelay })
    ).rejects.toMatchObject({ code: 'ENOENT' })
    expect(missing.calls).toHaveLength(1)
  })
})

describe('atomicWriteFile', () => {
  let tmp: string
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

  it('replaces the file and leaves no temp file behind', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-atomic-'))
    const target = path.join(tmp, 'doc.md')
    fs.writeFileSync(target, 'old')
    await atomicWriteFile(target, 'new')
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
    expect(fs.readdirSync(tmp)).toEqual(['doc.md'])
  })

  it('removes its temp file when the rename fails', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-atomic-'))
    // Renaming a file over a non-empty directory fails on every platform.
    const target = path.join(tmp, 'occupied')
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'child.md'), 'x')
    await expect(atomicWriteFile(target, 'new')).rejects.toThrow()
    expect(fs.readdirSync(tmp)).toEqual(['occupied'])
  })
})
