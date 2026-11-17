import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, beforeEach } from 'vitest'
import { MultiRootRegistry } from '../../main/workspace/multi-root-registry'
import { AssetAndDocumentService } from '../../main/assets/asset-service'
import { MultiRootSearchService } from '../../main/search/search-service'
import { SettingsAndCredentialService } from '../../main/settings/settings-service'

// Regression tests for the 2026-11-17 bug check: renames, cross-root moves, search & replace,
// missing roots, symlinks and settings recovery must never lose or silently overwrite user data.

describe('File operations never lose or overwrite user data', () => {
  let base: string
  let rootA: string
  let rootB: string
  let registry: MultiRootRegistry
  let assets: AssetAndDocumentService

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-fileops-'))
    rootA = path.join(base, 'root-a')
    rootB = path.join(base, 'root-b')
    fs.mkdirSync(rootA)
    fs.mkdirSync(rootB)
    registry = new MultiRootRegistry(path.join(base, 'user-data'))
    registry.addRoot({ id: 'A', path: rootA }, false)
    registry.addRoot({ id: 'B', path: rootB }, false)
    assets = new AssetAndDocumentService(registry)
  })

  it('a case-only rename keeps the document', async () => {
    fs.writeFileSync(path.join(rootA, 'note.md'), 'IMPORTANT')
    await assets.renameDocumentAndRefactorLinks({
      rootId: 'A',
      oldRelativePath: 'note.md',
      newRelativePath: 'Note.md'
    })
    expect(fs.readdirSync(rootA)).toEqual(['Note.md'])
    expect(fs.readFileSync(path.join(rootA, 'Note.md'), 'utf-8')).toBe('IMPORTANT')
  })

  it('renaming onto an existing document is refused', async () => {
    fs.writeFileSync(path.join(rootA, 'x.md'), 'X')
    fs.writeFileSync(path.join(rootA, 'y.md'), 'Y')
    await expect(
      assets.renameDocumentAndRefactorLinks({ rootId: 'A', oldRelativePath: 'x.md', newRelativePath: 'y.md' })
    ).rejects.toThrow(/already exists/)
    expect(fs.readFileSync(path.join(rootA, 'y.md'), 'utf-8')).toBe('Y')
    expect(fs.readFileSync(path.join(rootA, 'x.md'), 'utf-8')).toBe('X')
  })

  it('a cross-root move keeps a different asset with the same name in the target root', async () => {
    fs.mkdirSync(path.join(rootA, 'assets/images'), { recursive: true })
    fs.mkdirSync(path.join(rootB, 'assets/images'), { recursive: true })
    fs.writeFileSync(path.join(rootA, 'assets/images/image.png'), 'A-IMAGE')
    fs.writeFileSync(path.join(rootB, 'assets/images/image.png'), 'B-IMAGE')
    fs.writeFileSync(path.join(rootA, 'doc.md'), '![x](assets/images/image.png)\n')

    const res = await assets.moveDocumentCrossRoot({
      sourceRootId: 'A',
      sourceRelativePath: 'doc.md',
      targetRootId: 'B',
      targetRelativePath: 'doc.md',
      migrateAssets: true
    })

    expect(fs.readFileSync(path.join(rootB, 'assets/images/image.png'), 'utf-8')).toBe('B-IMAGE')
    expect(res.migratedAssets).toHaveLength(1)
    const migrated = res.migratedAssets[0]
    expect(migrated).not.toBe('assets/images/image.png')
    expect(fs.readFileSync(path.join(rootB, migrated), 'utf-8')).toBe('A-IMAGE')
    expect(res.updatedMarkdown).toContain(migrated)
  })

  it('a cross-root move reuses an identical asset instead of duplicating it', async () => {
    fs.mkdirSync(path.join(rootA, 'assets/images'), { recursive: true })
    fs.mkdirSync(path.join(rootB, 'assets/images'), { recursive: true })
    fs.writeFileSync(path.join(rootA, 'assets/images/same.png'), 'SAME')
    fs.writeFileSync(path.join(rootB, 'assets/images/same.png'), 'SAME')
    fs.writeFileSync(path.join(rootA, 'doc.md'), '![x](assets/images/same.png)\n')
    const res = await assets.moveDocumentCrossRoot({
      sourceRootId: 'A',
      sourceRelativePath: 'doc.md',
      targetRootId: 'B',
      targetRelativePath: 'doc.md',
      migrateAssets: true
    })
    expect(res.migratedAssets).toEqual(['assets/images/same.png'])
    expect(fs.readdirSync(path.join(rootB, 'assets/images'))).toEqual(['same.png'])
  })

  it('a cross-root move refuses to overwrite an existing document in the target root', async () => {
    fs.writeFileSync(path.join(rootA, 'doc.md'), 'FROM A')
    fs.writeFileSync(path.join(rootB, 'doc.md'), 'ALREADY IN B')
    await expect(
      assets.moveDocumentCrossRoot({
        sourceRootId: 'A',
        sourceRelativePath: 'doc.md',
        targetRootId: 'B',
        targetRelativePath: 'doc.md',
        migrateAssets: false
      })
    ).rejects.toThrow(/already exists/)
    expect(fs.readFileSync(path.join(rootB, 'doc.md'), 'utf-8')).toBe('ALREADY IN B')
    expect(fs.existsSync(path.join(rootA, 'doc.md'))).toBe(true)
  })

  it('regex replace matches ^ and $ per line, like search does', async () => {
    fs.writeFileSync(path.join(rootA, 's.md'), 'foo 1\nfoo 2\r\nfoo 3\n')
    const search = new MultiRootSearchService(registry)
    const found = await search.searchAcrossRoots({ query: '^foo \\d$', isRegex: true })
    const replaced = await search.replaceAcrossRoots({
      search: { query: '^foo \\d$', isRegex: true },
      replacement: 'bar',
      confirmedFiles: [{ rootId: 'A', relativePath: 's.md' }]
    })
    expect(found[0].matches).toHaveLength(3)
    expect(replaced.totalReplacements).toBe(3)
    expect(fs.readFileSync(path.join(rootA, 's.md'), 'utf-8')).toBe('bar\nbar\r\nbar\n')
  })

  it('regex replace expands $1 capture groups; plain replace keeps $ literally', async () => {
    fs.writeFileSync(path.join(rootA, 'c.md'), 'John Smith\n')
    fs.writeFileSync(path.join(rootA, 'p.md'), 'price\n')
    const search = new MultiRootSearchService(registry)
    await search.replaceAcrossRoots({
      search: { query: '(\\w+) (\\w+)', isRegex: true },
      replacement: '$2, $1',
      confirmedFiles: [{ rootId: 'A', relativePath: 'c.md' }]
    })
    await search.replaceAcrossRoots({
      search: { query: 'price' },
      replacement: '$1 & $&',
      confirmedFiles: [{ rootId: 'A', relativePath: 'p.md' }]
    })
    expect(fs.readFileSync(path.join(rootA, 'c.md'), 'utf-8')).toBe('Smith, John\n')
    expect(fs.readFileSync(path.join(rootA, 'p.md'), 'utf-8')).toBe('$1 & $&\n')
  })

  it('a root whose folder is missing at startup is not recreated, and is not forgotten', () => {
    const userData = path.join(base, 'ud-missing')
    const usb = path.join(base, 'Volumes', 'USB', 'notes')
    fs.mkdirSync(usb, { recursive: true })
    const first = new MultiRootRegistry(userData)
    first.addRoot({ id: 'usb', path: usb })
    first.addRoot({ id: 'A', path: rootA })

    fs.rmSync(path.join(base, 'Volumes'), { recursive: true, force: true }) // drive unplugged
    const second = new MultiRootRegistry(userData)
    expect(fs.existsSync(usb)).toBe(false)
    expect(second.getState().roots.map((r) => r.id)).toEqual(['A'])

    second.renameRoot('A', 'Renamed') // persists state while the drive is away
    fs.mkdirSync(usb, { recursive: true }) // drive plugged back in
    const third = new MultiRootRegistry(userData)
    expect(third.getState().roots.map((r) => r.id).sort()).toEqual(['A', 'usb'])
  })

  it('adding a new root from the UI still creates its folder', () => {
    const fresh = path.join(base, 'brand-new')
    registry.addRoot({ path: fresh }, false)
    expect(fs.existsSync(fresh)).toBe(true)
  })

  it('the workspace state file is written atomically (no partial file on failure)', () => {
    const userData = path.join(base, 'ud-atomic')
    const reg = new MultiRootRegistry(userData)
    reg.addRoot({ id: 'A', path: rootA })
    const leftovers = fs.readdirSync(userData).filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-state.json'), 'utf-8')).roots).toHaveLength(1)
  })

  it('lists symlinked files and folders that stay inside the root, and skips ones that escape', async () => {
    const outside = path.join(base, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'secret.md'), 'S')
    fs.mkdirSync(path.join(rootA, 'real'))
    fs.writeFileSync(path.join(rootA, 'real', 'inner.md'), 'I')
    fs.symlinkSync(path.join(rootA, 'real', 'inner.md'), path.join(rootA, 'link.md'))
    fs.symlinkSync(path.join(rootA, 'real'), path.join(rootA, 'linked-dir'))
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(rootA, 'escape.md'))

    const tree = await registry.listFilesForRoot('A')
    const names = tree.map((n) => n.name)
    expect(names).toContain('link.md')
    expect(names).toContain('linked-dir')
    expect(names).not.toContain('escape.md')
    const linkedDir = tree.find((n) => n.name === 'linked-dir')
    expect(linkedDir?.isDirectory).toBe(true)
    expect(linkedDir?.children?.map((c) => c.name)).toEqual(['inner.md'])
  })

  it('a single invalid settings field only resets that field, and the old file is backed up', () => {
    const userData = path.join(base, 'ud-settings')
    fs.mkdirSync(userData)
    const customTemplates = [{ id: 'tpl-1', name: 'Mine', content: '# Mine', updatedAt: 1 }]
    fs.writeFileSync(
      path.join(userData, 'settings.json'),
      JSON.stringify({ theme: 'not-a-theme', floatingToolbarEnabled: false, customTemplates })
    )
    const svc = new SettingsAndCredentialService(userData)
    const s = svc.getSettings()
    expect(s.theme).toBe('system')
    expect(s.floatingToolbarEnabled).toBe(false)
    expect(s.customTemplates?.[0]?.name).toBe('Mine')
    expect(fs.existsSync(path.join(userData, 'settings.json.bak'))).toBe(true)
  })

  it('refuses to store a credential when OS encryption is unavailable', async () => {
    const userData = path.join(base, 'ud-creds')
    const svc = new SettingsAndCredentialService(userData, {
      isEncryptionAvailable: () => false,
      encryptString: () => Buffer.from(''),
      decryptString: () => ''
    })
    await expect(svc.setSecret('ai-key', 'sk-test-not-real')).rejects.toThrow(/encryption/i) // secret-scan:allow
    expect(svc.hasSecret('ai-key')).toBe(false)
    expect(fs.existsSync(path.join(userData, 'credentials.enc.json'))).toBe(false)
  })
})
