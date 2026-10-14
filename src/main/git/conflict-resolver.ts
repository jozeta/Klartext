import type { ConflictHunk } from '../../shared/types'

export function hasConflictMarkers(content: string): boolean {
  return /^<{7}\s/m.test(content) && /^={7}\s*$/m.test(content) && /^>{7}\s/m.test(content)
}

export function parseConflictHunks(content: string): ConflictHunk[] {
  const lines = content.split(/\r?\n/)
  const hunks: ConflictHunk[] = []
  let i = 0

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const startLine = i + 1
      const currentHeader = lines[i].replace(/^<{7}\s*/, '').trim()
      i++
      const currentLines: string[] = []
      const baseLines: string[] = []
      const incomingLines: string[] = []
      let inBase = false

      while (i < lines.length && !lines[i].startsWith('=======')) {
        if (lines[i].startsWith('|||||||')) {
          inBase = true
          i++
          continue
        }
        if (inBase) {
          baseLines.push(lines[i])
        } else {
          currentLines.push(lines[i])
        }
        i++
      }

      if (i < lines.length && lines[i].startsWith('=======')) {
        i++
      }

      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        incomingLines.push(lines[i])
        i++
      }

      let incomingHeader = 'incoming'
      if (i < lines.length && lines[i].startsWith('>>>>>>>')) {
        incomingHeader = lines[i].replace(/^>{7}\s*/, '').trim()
      }
      const endLine = i + 1

      hunks.push({
        index: hunks.length,
        startLine,
        endLine,
        currentHeader: currentHeader || 'HEAD',
        incomingHeader: incomingHeader || 'incoming',
        currentContent: currentLines.join('\n'),
        baseContent: baseLines.length > 0 ? baseLines.join('\n') : undefined,
        incomingContent: incomingLines.join('\n')
      })
    }
    i++
  }

  return hunks
}

export function resolveConflictHunkInText(
  content: string,
  resolution: 'current' | 'incoming' | 'both' | 'custom',
  hunkIndex = 0,
  customContent?: string
): string {
  const hunks = parseConflictHunks(content)
  if (hunks.length === 0) return content

  const targetHunk = hunks[hunkIndex] || hunks[0]
  const lines = content.split(/\r?\n/)

  let replacement = ''
  if (resolution === 'current') {
    replacement = targetHunk.currentContent
  } else if (resolution === 'incoming') {
    replacement = targetHunk.incomingContent
  } else if (resolution === 'both') {
    replacement = [targetHunk.currentContent, targetHunk.incomingContent]
      .filter((s) => s.length > 0)
      .join('\n')
  } else {
    replacement = customContent ?? targetHunk.currentContent
  }

  const before = lines.slice(0, targetHunk.startLine - 1)
  const after = lines.slice(targetHunk.endLine)
  const replacementLines = replacement.length > 0 ? replacement.split(/\r?\n/) : []

  return [...before, ...replacementLines, ...after].join('\n')
}

export function resolveAllConflictHunksInText(
  content: string,
  resolution: 'current' | 'incoming' | 'both'
): string {
  let result = content
  let safety = 0
  while (hasConflictMarkers(result) && safety < 200) {
    result = resolveConflictHunkInText(result, resolution, 0)
    safety++
  }
  return result
}
