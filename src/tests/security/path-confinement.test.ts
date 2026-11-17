import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { describe, it, expect, beforeEach } from 'vitest'
import { MultiRootPathGuard } from '../../main/security/path-guard'
import { GitRepoInstance } from '../../main/git/repo-instance'
import { ExportRequestSchema } from '../../shared/schemas'

// Regression tests for the 2026-11-17 bug check: renderer-supplied paths must stay inside a
// mounted root and must never name the root folder itself for a destructive operation.

describe('Path confinement', () => {
  let base: string
  let root: string
  let guard: MultiRootPathGuard

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-confine-'))
    root = path.join(base, 'root')
    fs.mkdirSync(root)
    guard = new MultiRootPathGuard()
    guard.registerRoot({ id: 'R', name: 'R', path: root })
  })

  it('resolveScopedEntryPath refuses paths that resolve to the root itself', () => {
    for (const p of ['.', './', 'sub/..', 'a/b/../..']) {
      expect(() => guard.resolveScopedEntryPath('R', p)).toThrow(/root folder itself/)
    }
    expect(guard.resolveScopedEntryPath('R', 'notes/a.md')).toBe(
      path.join(fs.realpathSync(root), 'notes/a.md')
    )
  })

  it('allows file names that merely start with two dots', () => {
    expect(guard.resolveScopedPath('R', '..notes.md')).toBe(path.join(fs.realpathSync(root), '..notes.md'))
    expect(() => guard.resolveScopedPath('R', '../x.md')).toThrow(/traversal/)
    expect(() => guard.resolveScopedPath('R', '..')).toThrow(/traversal/)
  })

  it('registerRoot does not create a missing folder', () => {
    const missing = path.join(base, 'not-there')
    expect(() => guard.registerRoot({ id: 'M', name: 'M', path: missing })).toThrow(/does not exist/)
    expect(fs.existsSync(missing)).toBe(false)
  })

  it('Git conflict resolution cannot write outside the repository', async () => {
    execSync('git init -q', { cwd: root })
    const outside = path.join(base, 'outside.sh')
    const original = 'echo hi\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> x\n'
    fs.writeFileSync(outside, original)
    const repo = new GitRepoInstance('R', 'R', root)
    await expect(
      repo.resolveConflictInFile({
        relativePath: '../outside.sh',
        resolution: 'custom',
        hunkIndex: 0,
        customContent: 'PWNED'
      })
    ).rejects.toThrow(/Security rejection/)
    expect(fs.readFileSync(outside, 'utf-8')).toBe(original)
  })

  it('Git staging cannot read files outside the repository', async () => {
    execSync('git init -q', { cwd: root })
    const repo = new GitRepoInstance('R', 'R', root)
    await expect(repo.stageFiles(['../outside.sh'])).rejects.toThrow(/Security rejection/)
  })

  it('a file whose name starts with a dash is staged as a file, not read as a git option', async () => {
    execSync('git init -q', { cwd: root })
    fs.writeFileSync(path.join(root, '--dry-run'), 'x')
    const repo = new GitRepoInstance('R', 'R', root)
    await repo.stageFiles(['--dry-run'])
    const staged = execSync('git diff --cached --name-only', { cwd: root }).toString().trim()
    expect(staged).toBe('--dry-run')
  })

  it('export requests cannot name an arbitrary output file', () => {
    const parsed = ExportRequestSchema.parse({
      rootId: 'R',
      relativePath: 'a.md',
      markdown: '# A',
      targetFilePath: '/tmp/anywhere.html'
    })
    expect('targetFilePath' in parsed).toBe(false)
  })
})
