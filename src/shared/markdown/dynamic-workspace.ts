import type { DynamicFilterRule } from '../types'
import { extractFrontmatter, extractHeadings } from './pipeline'

export interface DynamicCandidateDocument {
  rootId: string
  rootName: string
  relativePath: string
  name: string
  content: string
  updatedAt?: number
}

export function matchWildcardPattern(value: string, pattern: string): boolean {
  const trimmedPattern = pattern.trim()
  if (!trimmedPattern) return true
  const normalizedValue = String(value ?? '').trim()
  if (!normalizedValue) return false

  const hasWildcard = trimmedPattern.includes('*') || trimmedPattern.includes('?')
  if (!hasWildcard) {
    return normalizedValue.toLowerCase().includes(trimmedPattern.toLowerCase())
  }

  const escaped = trimmedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  const regex = new RegExp(`^${escaped}$`, 'i')
  return regex.test(normalizedValue)
}

export function normalizeFrontmatterDate(rawDate: unknown): string | null {
  if (!rawDate) return null
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
    return rawDate.toISOString().slice(0, 10)
  }
  const str = String(rawDate).trim()
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  const parsed = new Date(str)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

export function formatTagWithHash(rawTag: string): string {
  const cleaned = String(rawTag ?? '')
    .trim()
    .replace(/^#+/, '')
    .trim()
  return cleaned ? `#${cleaned}` : ''
}

export function stripTagHash(rawTag: string): string {
  return String(rawTag ?? '')
    .trim()
    .replace(/^#+/, '')
    .trim()
}

/**
 * Parses tag input written as `#tag1, #tag2`, `#tag1 #tag2`, or `#tag1 Tag2`
 * and normalizes every tag to start with `#` (e.g. `['#tag1', '#tag2']`).
 */
export function parseTagListInput(rawInput: string): string[] {
  if (!rawInput || !rawInput.trim()) return []
  const tokens = rawInput
    .split(/[\s,]+/)
    .map((t) => formatTagWithHash(t))
    .filter(Boolean)
  return Array.from(new Set(tokens))
}

export function extractDocumentTags(frontmatter: Record<string, unknown> | null): string[] {
  if (!frontmatter) return []
  const rawTags = frontmatter.tags ?? frontmatter.tag
  if (Array.isArray(rawTags)) {
    const out: string[] = []
    for (const item of rawTags) {
      for (const parsed of parseTagListInput(String(item ?? ''))) {
        if (!out.includes(parsed)) out.push(parsed)
      }
    }
    return out
  }
  if (typeof rawTags === 'string') {
    return parseTagListInput(rawTags)
  }
  return []
}

export function hasAnyActiveDynamicRule(rules?: DynamicFilterRule | null): boolean {
  if (!rules) return false
  if (rules.tagsPattern?.trim()) return true
  if (rules.titlePattern?.trim()) return true
  if (rules.authorPattern?.trim()) return true
  if (rules.statusPattern?.trim()) return true
  if (rules.dateFrom?.trim()) return true
  if (rules.dateTo?.trim()) return true
  if (
    Array.isArray(rules.customFrontmatterFilters) &&
    rules.customFrontmatterFilters.some((f) => f.key.trim() !== '' || f.valuePattern.trim() !== '')
  ) {
    return true
  }
  return false
}

export function matchesDynamicFilterRule(
  doc: DynamicCandidateDocument,
  rules?: DynamicFilterRule | null
): boolean {
  if (!rules) return true
  // Only consider markdown documents in dynamic folders
  if (!/\.(md|markdown|mdx|txt)$/i.test(doc.name)) {
    return false
  }

  const { frontmatter } = extractFrontmatter(doc.content)
  const fm = frontmatter ?? {}

  // 1. Tags filter (supports `#tag1, #tag2` or `#tag1 Tag2` and wildcard patterns)
  if (rules.tagsPattern && rules.tagsPattern.trim()) {
    const patterns = rules.tagsPattern
      .split(/[\s,]+/)
      .map((p) => stripTagHash(p))
      .filter(Boolean)
    if (patterns.length > 0) {
      const docTags = extractDocumentTags(fm)
      if (docTags.length === 0) return false
      const matchedTag = patterns.some((pattern) =>
        docTags.some(
          (tag) =>
            matchWildcardPattern(stripTagHash(tag), pattern) ||
            matchWildcardPattern(tag, `#${pattern}`)
        )
      )
      if (!matchedTag) return false
    }
  }

  // 2. Title filter (matches frontmatter.title, first H1 heading, or file basename)
  if (rules.titlePattern && rules.titlePattern.trim()) {
    const fmTitle = fm.title != null ? String(fm.title) : ''
    const headings = extractHeadings(doc.content)
    const firstH1 = headings.find((h) => h.depth === 1)?.text ?? ''
    const baseName = doc.name.replace(/\.(md|markdown|mdx|txt)$/i, '')
    const candidateTitles = [fmTitle, firstH1, baseName, doc.name].filter(Boolean)
    const matchedTitle = candidateTitles.some((t) =>
      matchWildcardPattern(t, rules.titlePattern)
    )
    if (!matchedTitle) return false
  }

  // 3. Author filter (matches frontmatter.author or owner)
  if (rules.authorPattern && rules.authorPattern.trim()) {
    const rawAuthor = fm.author ?? fm.owner ?? fm.created_by ?? ''
    const authorStr = Array.isArray(rawAuthor) ? rawAuthor.join(', ') : String(rawAuthor)
    if (!matchWildcardPattern(authorStr, rules.authorPattern)) {
      return false
    }
  }

  // 4. Status filter (matches frontmatter.status)
  if (rules.statusPattern && rules.statusPattern.trim()) {
    const statusStr = fm.status != null ? String(fm.status) : ''
    if (!matchWildcardPattern(statusStr, rules.statusPattern)) {
      return false
    }
  }

  // 5. Date range filter (inclusive YYYY-MM-DD against frontmatter.date)
  const dateFrom = rules.dateFrom?.trim() || ''
  const dateTo = rules.dateTo?.trim() || ''
  if (dateFrom || dateTo) {
    const docDate = normalizeFrontmatterDate(fm.date)
    if (!docDate) return false
    if (dateFrom && docDate < dateFrom) return false
    if (dateTo && docDate > dateTo) return false
  }

  // 6. Custom Frontmatter Filters (supports any frontmatter property + wildcards on key and value)
  if (Array.isArray(rules.customFrontmatterFilters) && rules.customFrontmatterFilters.length > 0) {
    for (const customFilter of rules.customFrontmatterFilters) {
      const keyPattern = customFilter.key.trim()
      const valPattern = customFilter.valuePattern.trim()
      if (!keyPattern && !valPattern) continue

      const entries = Object.entries(fm)
      if (entries.length === 0) return false

      const matchedEntry = entries.some(([k, v]) => {
        const keyMatches = !keyPattern || keyPattern === '*' || matchWildcardPattern(k, keyPattern)
        if (!keyMatches) return false
        if (!valPattern || valPattern === '*') return v != null && String(v).trim() !== ''

        if (Array.isArray(v)) {
          return v.some((item) => matchWildcardPattern(String(item), valPattern))
        }
        if (typeof v === 'object' && v !== null) {
          return matchWildcardPattern(JSON.stringify(v), valPattern)
        }
        return matchWildcardPattern(String(v ?? ''), valPattern)
      })

      if (!matchedEntry) return false
    }
  }

  return true
}

export function formatDynamicRuleSummary(rules?: DynamicFilterRule | null): string {
  if (!rules) return 'All Markdown documents'
  const parts: string[] = []
  if (rules.tagsPattern?.trim()) parts.push(`tags: ${rules.tagsPattern.trim()}`)
  if (rules.titlePattern?.trim()) parts.push(`title: ${rules.titlePattern.trim()}`)
  if (rules.authorPattern?.trim()) parts.push(`author: ${rules.authorPattern.trim()}`)
  if (rules.statusPattern?.trim()) parts.push(`status: ${rules.statusPattern.trim()}`)
  if (rules.dateFrom?.trim() || rules.dateTo?.trim()) {
    parts.push(`date: ${rules.dateFrom?.trim() || '*'} → ${rules.dateTo?.trim() || '*'}`)
  }
  if (Array.isArray(rules.customFrontmatterFilters)) {
    for (const cf of rules.customFrontmatterFilters) {
      if (cf.key.trim() || cf.valuePattern.trim()) {
        parts.push(`${cf.key.trim() || '*'}: ${cf.valuePattern.trim() || '*'}`)
      }
    }
  }
  return parts.length > 0 ? parts.join(' • ') : 'All Markdown documents'
}
