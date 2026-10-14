import fs from 'fs'
import path from 'path'
import { MultiRootRegistry, atomicWriteFile } from '../workspace/multi-root-registry'
import {
  extractLocalAssetReferences,
  rewriteAssetLinksInMarkdown
} from '../../shared/markdown/pipeline'
import {
  extractExcalidrawSceneFromSvgOrJson,
  serializeExcalidrawSvg,
  sanitizeSvgContent,
  type ExcalidrawSceneData
} from '../../shared/serialization/excalidraw-svg'

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg', '.excalidraw.svg'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.csv', '.md'],
  'application/json': ['.json', '.excalidraw']
}

export function validateAssetMimeAndMagicBytes(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): boolean {
  const lowerMime = mimeType.toLowerCase()
  const allowedExts = ALLOWED_EXTENSIONS[lowerMime]
  if (!allowedExts) return false

  const lowerName = fileName.toLowerCase()
  if (!allowedExts.some((ext) => lowerName.endsWith(ext))) {
    return false
  }

  if (lowerMime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    )
  }
  if (lowerMime === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (lowerMime === 'image/gif') {
    return (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    )
  }
  if (lowerMime === 'image/svg+xml') {
    const head = buffer.subarray(0, 512).toString('utf-8').toLowerCase()
    return head.includes('<svg')
  }
  return buffer.length > 0
}

export class AssetAndDocumentService {
  constructor(private registry: MultiRootRegistry) {}

  /**
   * Saves a pasted or dropped asset strictly into the owning root's asset directory
   * (`<ActiveRoot>/<assetDir>/<category>/<collisionSafeName>`) and returns a relative Markdown reference.
   */
  async saveRootScopedAsset(params: {
    rootId: string
    documentRelativePath?: string
    fileName: string
    mimeType: string
    base64Data: string
    category?: 'images' | 'attachments' | 'drawings'
  }): Promise<{ relativeAssetPath: string; markdownLink: string; absolutePath: string }> {
    const root = this.registry.pathGuard.getRoot(params.rootId)
    const category = params.category || 'images'
    const buffer = Buffer.from(params.base64Data, 'base64')

    if (!validateAssetMimeAndMagicBytes(buffer, params.mimeType, params.fileName)) {
      throw new Error(
        `Invalid or mismatched asset MIME type (${params.mimeType}) / magic bytes for "${params.fileName}"`
      )
    }

    const sanitizedBase = path
      .basename(params.fileName)
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')

    const assetSubdirRel = `${root.assetDir}/${category}`.replace(/\\/g, '/')
    let targetRelPath = `${assetSubdirRel}/${sanitizedBase}`
    let candidateAbs = this.registry.pathGuard.resolveScopedPath(params.rootId, targetRelPath)

    if (fs.existsSync(candidateAbs)) {
      const extIndex = sanitizedBase.indexOf('.')
      const stem = extIndex > 0 ? sanitizedBase.slice(0, extIndex) : sanitizedBase
      const ext = extIndex > 0 ? sanitizedBase.slice(extIndex) : ''
      const suffix = Date.now().toString(36)
      targetRelPath = `${assetSubdirRel}/${stem}-${suffix}${ext}`
      candidateAbs = this.registry.pathGuard.resolveScopedPath(params.rootId, targetRelPath)
    }

    const payload =
      params.mimeType.toLowerCase() === 'image/svg+xml'
        ? Buffer.from(sanitizeSvgContent(buffer.toString('utf-8')), 'utf-8')
        : buffer

    await atomicWriteFile(candidateAbs, payload)

    // Compute clean relative path from the document's directory inside the same root
    let linkPath = targetRelPath
    if (params.documentRelativePath) {
      const docDir = path.posix.dirname(params.documentRelativePath.replace(/\\/g, '/'))
      if (docDir && docDir !== '.') {
        linkPath = path.posix.relative(docDir, targetRelPath)
      }
    }

    const encodedLink = linkPath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')

    const label = path.basename(sanitizedBase, path.extname(sanitizedBase))
    const isImage = params.mimeType.startsWith('image/')
    const markdownLink = isImage ? `![${label}](${encodedLink})` : `[${label}](${encodedLink})`

    return {
      relativeAssetPath: targetRelPath,
      markdownLink,
      absolutePath: candidateAbs
    }
  }

  /**
   * Saves an Excalidraw scene as a portable `.excalidraw.svg` inside `<ActiveRoot>/<assetDir>/drawings/`.
   */
  async saveExcalidrawSvg(params: {
    rootId: string
    relativePath: string
    scene: ExcalidrawSceneData
  }): Promise<{ relativePath: string; svgContent: string }> {
    const cleanRel = params.relativePath.endsWith('.excalidraw.svg')
      ? params.relativePath
      : `${params.relativePath.replace(/\.svg$/i, '')}.excalidraw.svg`

    const absPath = this.registry.pathGuard.resolveScopedPath(params.rootId, cleanRel)
    const svgContent = serializeExcalidrawSvg(params.scene)
    await atomicWriteFile(absPath, svgContent)
    return { relativePath: cleanRel, svgContent }
  }

  async loadExcalidrawSvg(
    rootId: string,
    relativePath: string
  ): Promise<{ scene: ExcalidrawSceneData | null; rawSvg: string; corrupted: boolean }> {
    const absPath = this.registry.pathGuard.resolveScopedPath(rootId, relativePath)
    if (!fs.existsSync(absPath)) {
      throw new Error(`Drawing asset not found: ${relativePath}`)
    }
    const rawSvg = await fs.promises.readFile(absPath, 'utf-8')
    const scene = extractExcalidrawSceneFromSvgOrJson(rawSvg)
    return {
      scene,
      rawSvg: sanitizeSvgContent(rawSvg),
      corrupted: scene === null
    }
  }

  /**
   * Inspects a Markdown document before moving it from sourceRootId to targetRootId,
   * returning all local assets that exist in sourceRootId so the user can migrate them.
   */
  async checkCrossRootAssets(
    sourceRootId: string,
    sourceRelativePath: string
  ): Promise<string[]> {
    const sourceDocAbs = this.registry.pathGuard.resolveScopedPath(sourceRootId, sourceRelativePath)
    if (!fs.existsSync(sourceDocAbs)) return []

    const content = await fs.promises.readFile(sourceDocAbs, 'utf-8')
    const refs = extractLocalAssetReferences(content)
    const docDirRel = path.posix.dirname(sourceRelativePath.replace(/\\/g, '/'))

    const existingAssetRelPaths: string[] = []
    for (const ref of refs) {
      const resolvedRel =
        docDirRel && docDirRel !== '.'
          ? path.posix.normalize(path.posix.join(docDirRel, ref.normalizedPath))
          : path.posix.normalize(ref.normalizedPath)
      try {
        const assetAbs = this.registry.pathGuard.resolveScopedPath(sourceRootId, resolvedRel)
        if (fs.existsSync(assetAbs)) {
          existingAssetRelPaths.push(resolvedRel)
        }
      } catch {
        // Ignore invalid refs
      }
    }
    return existingAssetRelPaths
  }

  /**
   * Moves a Markdown file from sourceRootId to targetRootId, optionally migrating all referenced
   * local images, attachments, and `.excalidraw.svg` drawings into targetRootId's asset directory
   * and rewriting relative links so neither repository has broken references.
   */
  async moveDocumentCrossRoot(params: {
    sourceRootId: string
    sourceRelativePath: string
    targetRootId: string
    targetRelativePath: string
    migrateAssets: boolean
  }): Promise<{
    movedFileRelativePath: string
    migratedAssets: string[]
    updatedMarkdown: string
  }> {
    const sourceDocAbs = this.registry.pathGuard.resolveScopedPath(
      params.sourceRootId,
      params.sourceRelativePath
    )
    const targetDocAbs = this.registry.pathGuard.resolveScopedPath(
      params.targetRootId,
      params.targetRelativePath
    )
    const targetRoot = this.registry.pathGuard.getRoot(params.targetRootId)

    let markdown = await fs.promises.readFile(sourceDocAbs, 'utf-8')
    const migratedAssets: string[] = []

    if (params.migrateAssets) {
      const refs = extractLocalAssetReferences(markdown)
      const sourceDocDir = path.posix.dirname(params.sourceRelativePath.replace(/\\/g, '/'))
      const targetDocDir = path.posix.dirname(params.targetRelativePath.replace(/\\/g, '/'))
      const replacements: Record<string, string> = {}

      for (const ref of refs) {
        const sourceAssetRel =
          sourceDocDir && sourceDocDir !== '.'
            ? path.posix.normalize(path.posix.join(sourceDocDir, ref.normalizedPath))
            : path.posix.normalize(ref.normalizedPath)

        try {
          const sourceAssetAbs = this.registry.pathGuard.resolveScopedPath(
            params.sourceRootId,
            sourceAssetRel
          )
          if (!fs.existsSync(sourceAssetAbs)) continue

          const subCategory = ref.isExcalidrawSvg ? 'drawings' : 'images'
          const fileName = path.posix.basename(sourceAssetRel)
          const targetAssetRel = `${targetRoot.assetDir}/${subCategory}/${fileName}`.replace(
            /\\/g,
            '/'
          )
          const targetAssetAbs = this.registry.pathGuard.resolveScopedPath(
            params.targetRootId,
            targetAssetRel
          )

          await fs.promises.mkdir(path.dirname(targetAssetAbs), { recursive: true })
          await fs.promises.copyFile(sourceAssetAbs, targetAssetAbs)
          migratedAssets.push(targetAssetRel)

          const newRelFromTargetDoc =
            targetDocDir && targetDocDir !== '.'
              ? path.posix.relative(targetDocDir, targetAssetRel)
              : targetAssetRel

          replacements[ref.rawUrl] = newRelFromTargetDoc
          replacements[ref.normalizedPath] = newRelFromTargetDoc
        } catch {
          // Continue migrating other assets
        }
      }

      if (Object.keys(replacements).length > 0) {
        markdown = rewriteAssetLinksInMarkdown(markdown, replacements)
      }
    }

    await atomicWriteFile(targetDocAbs, markdown)
    await fs.promises.unlink(sourceDocAbs)

    return {
      movedFileRelativePath: params.targetRelativePath,
      migratedAssets,
      updatedMarkdown: markdown
    }
  }

  /**
   * Scans the specified root's asset directory and compares against all local asset links
   * across every Markdown document in that root, returning unreferenced orphan asset paths.
   */
  async listOrphanAssets(rootId: string): Promise<string[]> {
    const root = this.registry.pathGuard.getRoot(rootId)
    const tree = await this.registry.listFilesForRoot(rootId)

    const mdFiles: string[] = []
    const assetFiles: string[] = []
    const assetPrefix = `${root.assetDir}/`.replace(/\\/g, '/')

    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        if (n.isDirectory && n.children) {
          walk(n.children)
        } else if (!n.isDirectory) {
          if (/\.(md|markdown)$/i.test(n.name)) {
            mdFiles.push(n.relativePath)
          } else if (n.relativePath.startsWith(assetPrefix)) {
            assetFiles.push(n.relativePath)
          }
        }
      }
    }
    walk(tree)

    const referencedSet = new Set<string>()
    for (const mdRel of mdFiles) {
      try {
        const abs = this.registry.pathGuard.resolveScopedPath(rootId, mdRel)
        const content = await fs.promises.readFile(abs, 'utf-8')
        const refs = extractLocalAssetReferences(content)
        const docDir = path.posix.dirname(mdRel.replace(/\\/g, '/'))
        for (const r of refs) {
          const resolvedRel =
            docDir && docDir !== '.'
              ? path.posix.normalize(path.posix.join(docDir, r.normalizedPath))
              : path.posix.normalize(r.normalizedPath)
          referencedSet.add(resolvedRel)
        }
      } catch {
        // Ignore unreadable file
      }
    }

    return assetFiles.filter((af) => !referencedSet.has(af))
  }

  /**
   * When a Markdown document is moved or renamed within the same root (e.g. `notes/a.md` -> `archive/2026/a.md`),
   * rewrites relative asset links inside that document so they continue to resolve to `<Root>/<assetDir>/...`.
   */
  async renameDocumentAndRefactorLinks(params: {
    rootId: string
    oldRelativePath: string
    newRelativePath: string
  }): Promise<{ newRelativePath: string; updatedMarkdown: string }> {
    const oldAbs = this.registry.pathGuard.resolveScopedPath(params.rootId, params.oldRelativePath)
    const newAbs = this.registry.pathGuard.resolveScopedPath(params.rootId, params.newRelativePath)

    let markdown = await fs.promises.readFile(oldAbs, 'utf-8')
    const oldDir = path.posix.dirname(params.oldRelativePath.replace(/\\/g, '/'))
    const newDir = path.posix.dirname(params.newRelativePath.replace(/\\/g, '/'))

    if (oldDir !== newDir) {
      const refs = extractLocalAssetReferences(markdown)
      const replacements: Record<string, string> = {}
      for (const ref of refs) {
        const assetRelFromRoot =
          oldDir && oldDir !== '.'
            ? path.posix.normalize(path.posix.join(oldDir, ref.normalizedPath))
            : path.posix.normalize(ref.normalizedPath)
        const nextRelFromNewDoc =
          newDir && newDir !== '.'
            ? path.posix.relative(newDir, assetRelFromRoot)
            : assetRelFromRoot
        replacements[ref.rawUrl] = nextRelFromNewDoc
        replacements[ref.normalizedPath] = nextRelFromNewDoc
      }
      if (Object.keys(replacements).length > 0) {
        markdown = rewriteAssetLinksInMarkdown(markdown, replacements)
      }
    }

    await atomicWriteFile(newAbs, markdown)
    if (oldAbs !== newAbs && fs.existsSync(oldAbs)) {
      await fs.promises.unlink(oldAbs)
    }

    return {
      newRelativePath: params.newRelativePath,
      updatedMarkdown: markdown
    }
  }
}
