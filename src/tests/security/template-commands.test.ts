import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  classifyPowerExpression,
  blockedPlaceholder,
  resolveTemplateCwd
} from '../../main/security/template-command-policy'

describe('Template commands policy (exec:/sh:/url:/env: power variables)', () => {
  it('treats every command, network and environment variable as sensitive, case-insensitively', () => {
    for (const e of ['exec: rm -rf ~', 'CLI: id', 'cmd: dir', 'sh: echo hi', 'bash: x', 'zsh: x', 'script: ./a.sh', 'osascript: beep', 'applescript: beep']) {
      expect(classifyPowerExpression(e)).toBe('command')
    }
    for (const e of ['url: http://x', 'fetch: http://x', 'curl: http://x', 'http: //x', 'json_url: http://x | a', 'JSON: http://x']) {
      expect(classifyPowerExpression(e)).toBe('network')
    }
    expect(classifyPowerExpression('env:AWS_SECRET_ACCESS_KEY')).toBe('environment')
    expect(classifyPowerExpression('  Env: PATH')).toBe('environment')
  })

  it('leaves harmless variables alone', () => {
    for (const e of ['git_commit', 'git_author', 'cpu_cores', 'uptime', 'ip_local', 'date', 'executive summary']) {
      expect(classifyPowerExpression(e)).toBeNull()
    }
  })

  it('explains why a variable was blocked', () => {
    expect(blockedPlaceholder('disabled')).toContain('Settings')
    expect(blockedPlaceholder('declined')).toContain('not approved')
  })

  describe('working folder', () => {
    let tmp: string
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

    it('accepts a folder inside a mounted root and rejects everything else', () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-tplcwd-'))
      const root = path.join(tmp, 'root')
      const inside = path.join(root, 'notes')
      const outside = path.join(tmp, 'outside')
      fs.mkdirSync(inside, { recursive: true })
      fs.mkdirSync(outside)
      const real = (p: string) => fs.realpathSync(p)

      expect(resolveTemplateCwd(inside, [root], '/fallback')).toBe(real(inside))
      expect(resolveTemplateCwd(outside, [root], '/fallback')).toBe(root)
      expect(resolveTemplateCwd(path.join(root, '..', 'outside'), [root], '/fallback')).toBe(root)
      expect(resolveTemplateCwd(path.join(tmp, 'missing'), [root], '/fallback')).toBe(root)
      expect(resolveTemplateCwd(undefined, [root], '/fallback')).toBe(root)
      expect(resolveTemplateCwd(outside, [], '/fallback')).toBe('/fallback')
    })
  })
})
