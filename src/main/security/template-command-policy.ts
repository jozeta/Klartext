import fs from 'fs'
import { isStrictSubpath } from './path-guard'

// Power-template variables that reach outside the editor: run a program, fetch a URL, or read an
// environment variable (which can hold secrets). A Markdown file from someone else (e.g. a cloned
// repo) can contain them, so they only run when the user has enabled them in Settings and then
// confirmed the exact list in a native dialog shown by the main process (see
// TEMPLATE_EVALUATE_POWER in ipc/handlers). Harmless variables (date, uptime, git_commit, …) are
// not affected.

export type SensitiveKind = 'command' | 'network' | 'environment'

const COMMAND = /^(exec|cli|cmd|sh|bash|zsh|script|applescript|osascript):/i
const NETWORK = /^(url|fetch|curl|http|json_url|json):/i
const ENVIRONMENT = /^env:/i

/** Returns why an expression is sensitive, or null if it is safe to evaluate without asking. */
export function classifyPowerExpression(expression: string): SensitiveKind | null {
  const expr = expression.trim()
  if (COMMAND.test(expr)) return 'command'
  if (NETWORK.test(expr)) return 'network'
  if (ENVIRONMENT.test(expr)) return 'environment'
  return null
}

/** Text inserted in place of a sensitive variable that was not allowed to run. */
export function blockedPlaceholder(reason: 'disabled' | 'declined'): string {
  return reason === 'disabled'
    ? '[blocked: enable "Template commands" in Settings → General]'
    : '[blocked: not approved]'
}

/**
 * Working directory for template commands: the requested one only if it is inside a mounted root
 * (paths from the renderer must never reach the filesystem unchecked), otherwise the first root.
 */
export function resolveTemplateCwd(
  requested: string | undefined,
  rootPaths: string[],
  fallback: string
): string {
  if (requested) {
    try {
      const real = fs.realpathSync(requested)
      for (const root of rootPaths) {
        try {
          if (isStrictSubpath(fs.realpathSync(root), real)) return real
        } catch {
          // root no longer exists; skip it
        }
      }
    } catch {
      // requested path doesn't exist
    }
  }
  return rootPaths[0] ?? fallback
}
