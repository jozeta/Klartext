import fs from 'fs'
import path from 'path'
import { MultiRootRegistry, atomicWriteFile } from '../workspace/multi-root-registry'
import { extractWikiLinks } from '../../shared/markdown/pipeline'
import type { BacklinkItem, SearchFileResult, SearchMatchLine } from '../../shared/types'

const SEARCHABLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.json', '.yaml', '.yml'])

function matchesSimpleGlob(relPath: string, globPattern?: string): boolean {
  if (!globPattern || !globPattern.trim()) return true
  const patterns = globPattern
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (patterns.length === 0) return true

  return patterns.some((pattern) => {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
    const regex = new RegExp(`^${escaped}$`, 'i')
    return regex.test(relPath) || relPath.toLowerCase().includes(pattern.replace(/\*/g, '').toLowerCase())
  })
}

export class MultiRootSearchService {
  constructor(private registry: MultiRootRegistry) {}

  private async collectMarkdownFiles(rootId: string): Promise<string[]> {
    const tree = await this.registry.listFilesForRoot(rootId)
    const files: string[] = []
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        if (n.isDirectory && n.children) {
          walk(n.children)
        } else if (!n.isDirectory) {
          const ext = path.extname(n.name).toLowerCase()
          if (SEARCHABLE_EXTENSIONS.has(ext)) {
            files.push(n.relativePath)
          }
        }
      }
    }
    walk(tree)
    return files
  }

  private buildMatcher(params: {
    query: string
    caseSensitive?: boolean
    wholeWord?: boolean
    isRegex?: boolean
  }): RegExp {
    const flags = params.caseSensitive ? 'g' : 'gi'
    if (params.isRegex) {
      return new RegExp(params.query, flags)
    }
    const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = params.wholeWord ? `\\b${escaped}\\b` : escaped
    return new RegExp(pattern, flags)
  }

  async searchAcrossRoots(params: {
    query: string
    rootIds?: string[]
    caseSensitive?: boolean
    wholeWord?: boolean
    isRegex?: boolean
    includeGlob?: string
    excludeGlob?: string
  }): Promise<SearchFileResult[]> {
    if (!params.query) return []
    const matcher = this.buildMatcher(params)
    const allRoots = this.registry.getState().roots
    const targetRoots =
      params.rootIds && params.rootIds.length > 0
        ? allRoots.filter((r) => params.rootIds!.includes(r.id))
        : allRoots

    const results: SearchFileResult[] = []

    for (const root of targetRoots) {
      const files = await this.collectMarkdownFiles(root.id)
      for (const relPath of files) {
        if (params.includeGlob && !matchesSimpleGlob(relPath, params.includeGlob)) continue
        if (params.excludeGlob && matchesSimpleGlob(relPath, params.excludeGlob)) continue

        try {
          const absPath = this.registry.pathGuard.resolveScopedPath(root.id, relPath)
          const content = await fs.promises.readFile(absPath, 'utf-8')
          const lines = content.split(/\r?\n/)
          const matches: SearchMatchLine[] = []

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            matcher.lastIndex = 0
            let m: RegExpExecArray | null
            while ((m = matcher.exec(line)) !== null) {
              matches.push({
                lineNumber: i + 1,
                lineText: line.slice(0, 300),
                matchStart: m.index,
                matchEnd: m.index + m[0].length
              })
              if (m.index === matcher.lastIndex) matcher.lastIndex++
            }
          }

          if (matches.length > 0) {
            results.push({
              rootId: root.id,
              rootName: root.name,
              relativePath: relPath,
              matches
            })
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return results
  }

  async replaceAcrossRoots(params: {
    search: {
      query: string
      rootIds?: string[]
      caseSensitive?: boolean
      wholeWord?: boolean
      isRegex?: boolean
    }
    replacement: string
    confirmedFiles: Array<{ rootId: string; relativePath: string }>
  }): Promise<{ replacedFilesCount: number; totalReplacements: number }> {
    const matcher = this.buildMatcher(params.search)
    let replacedFilesCount = 0
    let totalReplacements = 0

    for (const item of params.confirmedFiles) {
      const absPath = this.registry.pathGuard.resolveScopedPath(item.rootId, item.relativePath)
      if (!fs.existsSync(absPath)) continue

      const original = await fs.promises.readFile(absPath, 'utf-8')
      let fileReplacements = 0
      const updated = original.replace(matcher, () => {
        fileReplacements++
        return params.replacement
      })

      if (fileReplacements > 0 && updated !== original) {
        await atomicWriteFile(absPath, updated)
        replacedFilesCount++
        totalReplacements += fileReplacements
      }
    }

    return { replacedFilesCount, totalReplacements }
  }

  async findBacklinks(targetRootId: string, targetRelativePath: string): Promise<BacklinkItem[]> {
    const targetBaseName = path.basename(targetRelativePath, path.extname(targetRelativePath)).toLowerCase()
    const targetRelNoExt = targetRelativePath.replace(/\.[^.]+$/, '').toLowerCase()
    const allRoots = this.registry.getState().roots
    const backlinks: BacklinkItem[] = []

    for (const root of allRoots) {
      const files = await this.collectMarkdownFiles(root.id)
      for (const relPath of files) {
        if (root.id === targetRootId && relPath === targetRelativePath) continue
        try {
          const absPath = this.registry.pathGuard.resolveScopedPath(root.id, relPath)
          const content = await fs.promises.readFile(absPath, 'utf-8')
          const wikiLinks = extractWikiLinks(content)
          const lines = content.split(/\r?\n/)

          for (const wl of wikiLinks) {
            const normalizedTarget = wl.target.replace(/\.md$/i, '').toLowerCase()
            if (normalizedTarget === targetBaseName || normalizedTarget === targetRelNoExt) {
              backlinks.push({
                sourceRootId: root.id,
                sourceRootName: root.name,
                sourceRelativePath: relPath,
                lineNumber: wl.line,
                excerpt: (lines[wl.line - 1] || '').trim(),
                isCrossRoot: root.id !== targetRootId
              })
            }
          }
        } catch {
          // Ignore errors
        }
      }
    }

    return backlinks
  }
}
