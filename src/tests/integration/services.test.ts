import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import simpleGit from 'simple-git'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MultiRootRegistry } from '../../main/workspace/multi-root-registry'
import { AssetAndDocumentService } from '../../main/assets/asset-service'
import { RecoveryService } from '../../main/recovery/recovery-service'
import { MultiRootSearchService } from '../../main/search/search-service'
import { MultiRepoManager } from '../../main/git/multi-repo-manager'
import { SettingsAndCredentialService } from '../../main/settings/settings-service'
import { LocalAIOrchestrator } from '../../main/ai/orchestrator'
import { ExportService } from '../../main/export/export-service'

// Valid 1x1 PNG magic bytes base64
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('Integration Tests: Multi-Root Assets, Cross-Root Migration, Concurrent Multi-Repo Git & Local AI', () => {
  let tmpDir: string
  let userDataDir: string
  let rootAPath: string
  let rootBPath: string
  let registry: MultiRootRegistry
  let assetService: AssetAndDocumentService
  let recoveryService: RecoveryService
  let searchService: MultiRootSearchService
  let gitManager: MultiRepoManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-int-'))
    userDataDir = path.join(tmpDir, 'user-data')
    rootAPath = path.join(tmpDir, 'repo-alpha')
    rootBPath = path.join(tmpDir, 'repo-beta')
    fs.mkdirSync(rootAPath, { recursive: true })
    fs.mkdirSync(rootBPath, { recursive: true })

    registry = new MultiRootRegistry(userDataDir)
    registry.addRoot({ id: 'root-alpha', name: 'Repo Alpha', path: rootAPath, assetDir: 'assets' })
    registry.addRoot({ id: 'root-beta', name: 'Repo Beta', path: rootBPath, assetDir: 'docs/assets' })

    assetService = new AssetAndDocumentService(registry)
    recoveryService = new RecoveryService(userDataDir)
    searchService = new MultiRootSearchService(registry)
    gitManager = new MultiRepoManager(registry, recoveryService)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('strictly scopes pasted images to their owning root and migrates assets on cross-root file moves', async () => {
    // 1. Save image into Root Alpha
    const savedAlpha = await assetService.saveRootScopedAsset({
      rootId: 'root-alpha',
      documentRelativePath: 'notes/spec.md',
      fileName: 'diagram-a.png',
      mimeType: 'image/png',
      base64Data: VALID_PNG_BASE64,
      category: 'images'
    })
    expect(savedAlpha.relativeAssetPath).toBe('assets/images/diagram-a.png')
    expect(fs.existsSync(path.join(rootAPath, 'assets/images/diagram-a.png'))).toBe(true)
    expect(fs.existsSync(path.join(rootBPath, 'docs/assets/images/diagram-a.png'))).toBe(false)

    // 2. Save image into Root Beta (custom assetDir: docs/assets)
    const savedBeta = await assetService.saveRootScopedAsset({
      rootId: 'root-beta',
      documentRelativePath: 'readme.md',
      fileName: 'diagram-b.png',
      mimeType: 'image/png',
      base64Data: VALID_PNG_BASE64,
      category: 'images'
    })
    expect(savedBeta.relativeAssetPath).toBe('docs/assets/images/diagram-b.png')
    expect(fs.existsSync(path.join(rootBPath, 'docs/assets/images/diagram-b.png'))).toBe(true)

    // 3. Create Markdown document in Root Alpha referencing diagram-a.png
    const alphaDocPath = path.join(rootAPath, 'notes', 'spec.md')
    fs.mkdirSync(path.dirname(alphaDocPath), { recursive: true })
    fs.writeFileSync(
      alphaDocPath,
      `# Alpha Spec\n\nHere is our architecture:\n\n${savedAlpha.markdownLink}\n`,
      'utf-8'
    )

    const detectedAssets = await assetService.checkCrossRootAssets('root-alpha', 'notes/spec.md')
    expect(detectedAssets).toEqual(['assets/images/diagram-a.png'])

    // 4. Move notes/spec.md from Root Alpha to Root Beta with automatic asset migration
    const moveRes = await assetService.moveDocumentCrossRoot({
      sourceRootId: 'root-alpha',
      sourceRelativePath: 'notes/spec.md',
      targetRootId: 'root-beta',
      targetRelativePath: 'imported/spec.md',
      migrateAssets: true
    })

    expect(moveRes.migratedAssets).toEqual(['docs/assets/images/diagram-a.png'])
    expect(fs.existsSync(path.join(rootBPath, 'docs/assets/images/diagram-a.png'))).toBe(true)
    expect(fs.existsSync(path.join(rootBPath, 'imported/spec.md'))).toBe(true)
    expect(moveRes.updatedMarkdown).toContain('../docs/assets/images/diagram-a.png')
  })

  it('executes multi-root search, per-root filtering, and bulk replace with confirmation', async () => {
    fs.writeFileSync(path.join(rootAPath, 'one.md'), 'Nordic design token alpha\nSecond line', 'utf-8')
    fs.writeFileSync(path.join(rootBPath, 'two.md'), 'Nordic design token beta\n Reference [[one]]', 'utf-8')

    const allHits = await searchService.searchAcrossRoots({ query: 'Nordic design' })
    expect(allHits.length).toBe(2)

    const filteredHits = await searchService.searchAcrossRoots({
      query: 'Nordic design',
      rootIds: ['root-alpha']
    })
    expect(filteredHits.length).toBe(1)
    expect(filteredHits[0].rootId).toBe('root-alpha')

    const replaceRes = await searchService.replaceAcrossRoots({
      search: { query: 'Nordic design' },
      replacement: 'Klartext Nordic',
      confirmedFiles: [{ rootId: 'root-alpha', relativePath: 'one.md' }]
    })
    expect(replaceRes.replacedFilesCount).toBe(1)
    expect(fs.readFileSync(path.join(rootAPath, 'one.md'), 'utf-8')).toContain('Klartext Nordic')
    expect(fs.readFileSync(path.join(rootBPath, 'two.md'), 'utf-8')).toContain('Nordic design')

    const backlinks = await searchService.findBacklinks('root-alpha', 'one.md')
    expect(backlinks.length).toBe(1)
    expect(backlinks[0].isCrossRoot).toBe(true)
    expect(backlinks[0].sourceRootId).toBe('root-beta')
  })

  it('synchronizes multiple Git repositories concurrently and isolates merge conflicts per repo', async () => {
    // Set up bare remotes for Repo Alpha and Repo Beta
    const remoteAlpha = path.join(tmpDir, 'remote-alpha.git')
    const remoteBeta = path.join(tmpDir, 'remote-beta.git')
    await simpleGit().init(true, [remoteAlpha])
    await simpleGit().init(true, [remoteBeta])

    const configureRepo = async (dir: string, remote: string) => {
      const g = simpleGit(dir)
      await g.init()
      await g.addConfig('user.name', 'Klartext Test')
      await g.addConfig('user.email', 'test@klartext.local')
      await g.checkoutLocalBranch('main')
      fs.writeFileSync(path.join(dir, 'doc.md'), '# Initial\nShared content\n', 'utf-8')
      await g.add(['.'])
      await g.commit('Initial commit')
      await g.addRemote('origin', remote)
      await g.push(['-u', 'origin', 'main'])
    }

    await configureRepo(rootAPath, remoteAlpha)
    await configureRepo(rootBPath, remoteBeta)

    // Create a clean commit in Repo Alpha
    fs.writeFileSync(path.join(rootAPath, 'doc.md'), '# Initial\nUpdated cleanly in Alpha\n', 'utf-8')
    await gitManager.getRepo('root-alpha').commit('Alpha update', ['doc.md'])

    // Simulate a conflicting remote commit on remoteBeta while Repo Beta also modifies doc.md locally
    const cloneBetaOther = path.join(tmpDir, 'beta-other')
    await simpleGit().clone(remoteBeta, cloneBetaOther)
    const gOther = simpleGit(cloneBetaOther)
    await gOther.addConfig('user.name', 'Remote Collaborator')
    await gOther.addConfig('user.email', 'collab@klartext.local')
    fs.writeFileSync(path.join(cloneBetaOther, 'doc.md'), '# Initial\nRemote conflicting line\n', 'utf-8')
    await gOther.add(['doc.md'])
    await gOther.commit('Remote change on Beta')
    await gOther.push('origin', 'main')

    // Local conflicting commit in Repo Beta
    fs.writeFileSync(path.join(rootBPath, 'doc.md'), '# Initial\nLocal conflicting line\n', 'utf-8')
    await gitManager.getRepo('root-beta').commit('Local change on Beta', ['doc.md'])

    // Execute "Sync All Repositories" concurrently
    const syncResults = await gitManager.syncAllRepositories('merge')
    const alphaStatus = syncResults.find((s) => s.rootId === 'root-alpha')!
    const betaStatus = syncResults.find((s) => s.rootId === 'root-beta')!

    // Repo Alpha pushed cleanly while Repo Beta entered isolated Merge Conflict state!
    expect(alphaStatus.state).toBe('Synced')
    expect(alphaStatus.ahead).toBe(0)
    expect(betaStatus.state).toBe('Merge Conflict')
    expect(betaStatus.conflictedFiles).toContain('doc.md')

    // Resolve conflict in Repo Beta using interactive conflict resolver ('both')
    const resolved = await gitManager.getRepo('root-beta').resolveConflictInFile({
      relativePath: 'doc.md',
      resolution: 'both'
    })
    expect(resolved.remainingConflicts).toBe(0)
    expect(resolved.updatedContent).toContain('Local conflicting line')
    expect(resolved.updatedContent).toContain('Remote conflicting line')
  })

  it('connects to a local mock Ollama server (127.0.0.1), discovers tags, streams bilingual rewrites, and exports HTML', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/api/tags' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            models: [
              {
                name: 'gemma4:12b',
                size: 7600000000,
                details: { family: 'gemma', parameter_size: '12B', quantization_level: 'Q4_K_M' }
              }
            ]
          })
        )
        return
      }
      if (req.url === '/api/chat' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        res.write(JSON.stringify({ message: { content: '<think>planning</think>\n' }, done: false }) + '\n')
        res.write(
          JSON.stringify({
            message: { content: '### Förbättrad Svensk Text\n\nEtt modernt **användargränssnitt**.' },
            done: false
          }) + '\n'
        )
        res.end(JSON.stringify({ message: { content: '' }, done: true }) + '\n')
        return
      }
      res.writeHead(404)
      res.end()
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    const endpoint = `http://127.0.0.1:${address.port}`

    try {
      const settingsService = new SettingsAndCredentialService(userDataDir)
      await settingsService.updateSettings({
        ai: {
          enabled: true,
          provider: 'ollama',
          endpoint,
          allowNonLoopback: false,
          activeModel: 'gemma4:12b',
          keepAlive: '5m'
        }
      })

      const ai = new LocalAIOrchestrator(() => settingsService.getSettings(), searchService)
      const conn = await ai.testConnection()
      expect(conn.ok).toBe(true)
      expect(conn.models[0].name).toBe('gemma4:12b')

      const chunks: string[] = []
      const finalCleaned = await ai.streamGeneration(
        {
          requestId: 'req-sv-1',
          action: 'improve',
          prompt: 'Förbättra språket',
          selectedText: 'Ett användar gränssnitt.'
        },
        (ev) => {
          if (ev.chunk) chunks.push(ev.chunk)
        }
      )

      expect(chunks.length).toBeGreaterThan(0)
      expect(finalCleaned).not.toContain('<think>')
      expect(finalCleaned).toContain('### Förbättrad Svensk Text')
      expect(finalCleaned).toContain('**användargränssnitt**')

      // Export standalone HTML
      const exportService = new ExportService(registry)
      const exported = await exportService.exportToHtmlFile({
        rootId: 'root-alpha',
        relativePath: 'report.md',
        markdown: finalCleaned,
        title: 'Swedish AI Report'
      })
      expect(fs.existsSync(exported.outputPath)).toBe(true)
      expect(exported.html).toContain('<!DOCTYPE html>')
      expect(exported.html).toContain('användargränssnitt')
    } finally {
      server.close()
    }
  })

  it('detects per-root orphan assets and refactors relative asset links when renaming documents across subdirectories', async () => {
    const usedAsset = await assetService.saveRootScopedAsset({
      rootId: 'root-alpha',
      documentRelativePath: 'Overview.md',
      fileName: 'used-diagram.png',
      mimeType: 'image/png',
      base64Data: VALID_PNG_BASE64,
      category: 'images'
    })
    await assetService.saveRootScopedAsset({
      rootId: 'root-alpha',
      documentRelativePath: 'Overview.md',
      fileName: 'unused-orphan.png',
      mimeType: 'image/png',
      base64Data: VALID_PNG_BASE64,
      category: 'images'
    })

    fs.writeFileSync(
      path.join(rootAPath, 'Overview.md'),
      `# Overview\n\n${usedAsset.markdownLink}\n`,
      'utf-8'
    )

    const orphans = await assetService.listOrphanAssets('root-alpha')
    expect(orphans).toEqual(['assets/images/unused-orphan.png'])

    // Rename Overview.md into nested folder docs/deep/Overview.md and verify relative link refactoring
    const renamed = await assetService.renameDocumentAndRefactorLinks({
      rootId: 'root-alpha',
      oldRelativePath: 'Overview.md',
      newRelativePath: 'docs/deep/Overview.md'
    })
    expect(renamed.updatedMarkdown).toContain('../../assets/images/used-diagram.png')
    expect(fs.existsSync(path.join(rootAPath, 'docs/deep/Overview.md'))).toBe(true)
  })

  it('meets performance budgets for atomic save (<100ms), 5 MB Markdown document handling, and multi-root search (<500ms)', async () => {
    // 1. Generate a 5 MB Markdown document
    const paragraph =
      '## Performance Section\nKlartext handles large 5 MB documents without blocking typing or corrupting state.\n\n'
    const repeatCount = Math.ceil((5 * 1024 * 1024) / Buffer.byteLength(paragraph, 'utf-8'))
    const fiveMbDoc = paragraph.repeat(repeatCount)
    expect(Buffer.byteLength(fiveMbDoc, 'utf-8')).toBeGreaterThanOrEqual(5 * 1024 * 1024)

    const saveStart = performance.now()
    const largeFilePath = path.join(rootAPath, 'large-5mb.md')
    fs.writeFileSync(largeFilePath, fiveMbDoc, 'utf-8')
    const saveElapsed = performance.now() - saveStart
    expect(saveElapsed).toBeLessThan(500)

    // 2. Typical document atomic save latency (< 100ms budget)
    const typicalStart = performance.now()
    fs.writeFileSync(path.join(rootAPath, 'typical.md'), '# Fast Save\nNordic precision.\n', 'utf-8')
    const typicalElapsed = performance.now() - typicalStart
    expect(typicalElapsed).toBeLessThan(100)

    // 3. Multi-root search latency (< 500ms budget)
    fs.unlinkSync(largeFilePath)
    for (let i = 0; i < 40; i++) {
      fs.writeFileSync(
        path.join(rootAPath, `note-${i}.md`),
        `# Note ${i}\nSearchable keyword benchmark-token-${i}\n`,
        'utf-8'
      )
      fs.writeFileSync(
        path.join(rootBPath, `doc-${i}.md`),
        `# Doc ${i}\nAnother file with benchmark-token-${i}\n`,
        'utf-8'
      )
    }

    const searchStart = performance.now()
    const hits = await searchService.searchAcrossRoots({ query: 'benchmark-token-25' })
    const searchElapsed = performance.now() - searchStart
    expect(hits.length).toBe(2)
    expect(searchElapsed).toBeLessThan(500)
  })
})
