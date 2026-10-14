const KEYWORDS = new Set([
  'import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'switch', 'case', 'break', 'continue', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw',
  'new', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'public', 'private', 'protected',
  'readonly', 'static', 'true', 'false', 'null', 'undefined', 'void', 'typeof', 'instanceof', 'in', 'of',
  'def', 'elif', 'except', 'lambda', 'pass', 'raise', 'with', 'yield', 'None', 'True', 'False', 'fn', 'mut',
  'pub', 'struct', 'impl', 'trait', 'match', 'use', 'mod', 'package', 'func', 'go', 'defer', 'select', 'WHERE',
  'SELECT', 'FROM', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ORDER', 'BY', 'GROUP'
])

const BUILTIN_TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'Record', 'Array', 'Promise', 'Map', 'Set',
  'Date', 'RegExp', 'Error', 'HTMLElement', 'React', 'FC', 'Node', 'Buffer', 'int', 'float', 'str', 'dict',
  'list', 'tuple', 'u8', 'u16', 'u32', 'u64', 'i32', 'i64', 'f64', 'usize', 'String', 'Vec', 'Option', 'Result'
])

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Lightweight deterministic syntax highlighter that returns safe, color-coded HTML spans
 * with `.hl-keyword`, `.hl-string`, `.hl-comment`, `.hl-number`, `.hl-type`, `.hl-fn`.
 */
export function highlightCodeToHtml(
  code: string,
  _lang = '',
  withLineNumbers = true
): string {
  const tokenRegex =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(\s*\()?/g

  const highlightSingleSegment = (segment: string): string => {
    let result = ''
    let lastIndex = 0
    let match: RegExpExecArray | null
    tokenRegex.lastIndex = 0

    while ((match = tokenRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        result += escapeHtml(segment.slice(lastIndex, match.index))
      }

      const [full, comment, str, num, ident, callParen] = match
      if (comment !== undefined) {
        result += `<span class="hl-comment">${escapeHtml(comment)}</span>`
      } else if (str !== undefined) {
        result += `<span class="hl-string">${escapeHtml(str)}</span>`
      } else if (num !== undefined) {
        result += `<span class="hl-number">${escapeHtml(num)}</span>`
      } else if (ident !== undefined) {
        if (KEYWORDS.has(ident)) {
          result += `<span class="hl-keyword">${escapeHtml(ident)}</span>`
        } else if (BUILTIN_TYPES.has(ident) || /^[A-Z][A-Za-z0-9_]*$/.test(ident)) {
          result += `<span class="hl-type">${escapeHtml(ident)}</span>`
        } else if (callParen) {
          result += `<span class="hl-fn">${escapeHtml(ident)}</span>`
        } else {
          result += escapeHtml(ident)
        }
        if (callParen) {
          result += escapeHtml(callParen)
        }
      } else {
        result += escapeHtml(full)
      }

      lastIndex = tokenRegex.lastIndex
    }

    if (lastIndex < segment.length) {
      result += escapeHtml(segment.slice(lastIndex))
    }

    return result
  }

  if (!withLineNumbers) {
    return highlightSingleSegment(code)
  }

  const normalized = code.replace(/\r\n/g, '\n').replace(/\n$/, '')
  const rawLines = normalized.split('\n')
  return rawLines
    .map((lineText, idx) => {
      const lineNum = idx + 1
      const highlightedLine = highlightSingleSegment(lineText)
      return `<span class="klartext-code-line"><span class="klartext-code-linenum" aria-hidden="true">${lineNum}</span><span class="klartext-code-line-text">${highlightedLine || ' '}</span></span>`
    })
    .join('')
}

