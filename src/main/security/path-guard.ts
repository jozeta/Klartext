import fs from 'fs'
import path from 'path'
import os from 'os'

export interface AllowedRootEntry {
  id: string
  name: string
  path: string
  realPath: string
  assetDir: string
}

const SENSITIVE_SYSTEM_PATHS_UNIX = ['/etc', '/var/root', '/root', '/bin', '/sbin', '/usr/bin', '/usr/sbin', '/System', '/private/etc']
const SENSITIVE_SYSTEM_PATHS_WIN = ['c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\system32']

export function isSensitiveSystemPath(candidatePath: string): boolean {
  const normalized = path.resolve(candidatePath)
  const lower = normalized.toLowerCase()
  const home = os.homedir()

  // Reject ~/.ssh, ~/.gnupg, ~/.aws
  const sensitiveDotDirs = ['.ssh', '.gnupg', '.aws', '.kube']
  for (const dotDir of sensitiveDotDirs) {
    const fullDotPath = path.join(home, dotDir)
    if (normalized === fullDotPath || normalized.startsWith(fullDotPath + path.sep)) {
      return true
    }
  }

  if (process.platform === 'win32') {
    return SENSITIVE_SYSTEM_PATHS_WIN.some((sys) => lower === sys || lower.startsWith(sys + '\\'))
  }

  if (normalized === '/') return true
  return SENSITIVE_SYSTEM_PATHS_UNIX.some(
    (sys) => normalized === sys || normalized.startsWith(sys + '/')
  )
}

export function isStrictSubpath(parentRealPath: string, targetRealPath: string): boolean {
  const rel = path.relative(parentRealPath, targetRealPath)
  if (rel === '') return true
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return false
  }
  return true
}

export class MultiRootPathGuard {
  private allowedRoots = new Map<string, AllowedRootEntry>()

  registerRoot(root: { id: string; name: string; path: string; assetDir?: string }): AllowedRootEntry {
    const resolved = path.resolve(root.path)
    if (isSensitiveSystemPath(resolved)) {
      throw new Error(`Security rejection: Cannot mount sensitive system path "${resolved}" as a workspace root`)
    }
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true })
    }
    const realPath = fs.realpathSync(resolved)
    if (isSensitiveSystemPath(realPath)) {
      throw new Error(`Security rejection: Symlink resolves to sensitive system path "${realPath}"`)
    }

    const entry: AllowedRootEntry = {
      id: root.id,
      name: root.name,
      path: resolved,
      realPath,
      assetDir: root.assetDir || 'assets'
    }
    this.allowedRoots.set(root.id, entry)
    return entry
  }

  unregisterRoot(rootId: string): void {
    this.allowedRoots.delete(rootId)
  }

  clearRoots(): void {
    this.allowedRoots.clear()
  }

  getRoot(rootId: string): AllowedRootEntry {
    const root = this.allowedRoots.get(rootId)
    if (!root) {
      throw new Error(`Security rejection: Unknown or unmounted rootId "${rootId}"`)
    }
    return root
  }

  getAllRoots(): AllowedRootEntry[] {
    return Array.from(this.allowedRoots.values())
  }

  /**
   * Resolves a root-scoped relative path and verifies that:
   * 1. It does not contain NUL bytes or escape the owning root.
   * 2. If the target or its parent directory exists on disk, its canonical realpath
   *    (resolving symlinks) strictly stays inside the owning root's realPath.
   */
  resolveScopedPath(rootId: string, relativePath: string): string {
    if (relativePath.includes('\0')) {
      throw new Error('Security rejection: Path contains NUL byte')
    }
    const root = this.getRoot(rootId)
    // Normalize Windows/Unix slashes
    const normalizedRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    const candidate = path.resolve(root.realPath, normalizedRel)

    if (!isStrictSubpath(root.realPath, candidate)) {
      throw new Error(
        `Security rejection: Path traversal attempt outside root "${rootId}" (${relativePath})`
      )
    }

    // Check symlink resolution for existing file or nearest existing ancestor
    let checkCursor = candidate
    while (checkCursor !== root.realPath && !fs.existsSync(checkCursor)) {
      const parent = path.dirname(checkCursor)
      if (parent === checkCursor) break
      checkCursor = parent
    }

    if (fs.existsSync(checkCursor)) {
      const targetReal = fs.realpathSync(checkCursor)
      if (!isStrictSubpath(root.realPath, targetReal)) {
        throw new Error(
          `Security rejection: Symlink escape detected outside root "${rootId}" -> "${targetReal}"`
        )
      }
    }

    return candidate
  }

  /**
   * Validates that an AI endpoint URL strictly targets loopback unless allowNonLoopback is enabled.
   */
  static validateLoopbackUrl(endpointUrl: string, allowNonLoopback = false): URL {
    let parsed: URL
    try {
      parsed = new URL(endpointUrl)
    } catch {
      throw new Error(`Invalid endpoint URL: ${endpointUrl}`)
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol "${parsed.protocol}" for AI endpoint`)
    }

    if (!allowNonLoopback) {
      const host = parsed.hostname.toLowerCase()
      const isLoopback =
        host === '127.0.0.1' ||
        host === 'localhost' ||
        host === '[::1]' ||
        host === '::1'
      if (!isLoopback) {
        throw new Error(
          `Security SSRF rejection: Non-loopback host "${host}" blocked while local-only mode is active`
        )
      }
    }
    return parsed
  }
}
