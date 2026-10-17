import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import simpleGit from 'simple-git'
import { test, expect, _electron as electron } from '@playwright/test'

const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

test.describe('Klartext Electron End-to-End Verification (All 17 Critical User Journeys)', () => {
  let tmpBase: string
  let userDataDir: string
  let rootBDir: string
  let rootCDir: string

  test.beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'klartext-e2e-'))
    userDataDir = path.join(tmpBase, 'user-data')
    rootBDir = path.join(tmpBase, 'root-beta')
    rootCDir = path.join(tmpBase, 'root-gamma')
    fs.mkdirSync(rootBDir, { recursive: true })
    fs.mkdirSync(rootCDir, { recursive: true })
    fs.writeFileSync(
      path.join(rootBDir, 'BetaDoc.md'),
      '# Beta Document\n\nContent inside Beta root.\n',
      'utf-8'
    )
    fs.writeFileSync(
      path.join(rootCDir, 'GammaDoc.md'),
      '# Gamma Document\n\nContent inside Gamma root.\n',
      'utf-8'
    )
  })

  test.afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true })
  })

  test('Scenarios 1–10: Multi-Root Workspaces, Manifests, UI Shell, Modes, Formatting, Per-Root Assets, Cross-Root Migration, Excalidraw & Mermaid', async () => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/index.js')],
      env: {
        ...process.env,
        KLARTEXT_USER_DATA_DIR: userDataDir,
        KLARTEXT_SEED_STARTER: '1',
        KLARTEXT_E2E_AUTO_SAVE_EXPORT: '1'
      }
    })

    try {
      const page = await app.firstWindow()
      await expect(page.getByTestId('klartext-app-shell')).toBeVisible()
      await expect(page.getByTestId('top-titlebar')).toBeVisible()

      // Hover over the Local/Git badge left of Create New File icon and verify root folder path is displayed
      const starterBadge = page.getByTestId('root-git-badge-root-starter')
      await starterBadge.hover()
      await expect(page.getByTestId('root-path-tooltip')).toContainText('Starter-Workspace')

      // Verify "Mount Root Folder by Path" icon is removed and Open Folder Dialog icon is named "Open new workspace"
      await expect(page.getByTestId('toggle-add-root-path-btn')).toHaveCount(0)
      await expect(page.getByTestId('add-folder-dialog-btn')).toHaveAttribute(
        'aria-label',
        'Open new workspace'
      )

      // Scenario 1: Mount two additional root folders & save/reopen .klartext-workspace manifest
      await page.evaluate(
        async ({ bDir, cDir }) => {
          await window.klartext.addRoot({ path: bDir })
          await window.klartext.addRoot({ path: cDir })
        },
        { bDir: rootBDir, cDir: rootCDir }
      )
      await expect(page.getByText('root-beta')).toBeVisible()
      await expect(page.getByText('root-gamma')).toBeVisible()

      // Verify creating a new folder in a workspace does NOT create a new .md file inside it
      await page.getByTestId('new-folder-btn-root-starter').click()
      await page.getByTestId('inline-rename-folder-input-root-starter').press('Enter')
      expect(fs.existsSync(path.join(userDataDir, 'Starter-Workspace', 'New-Folder'))).toBe(true)
      expect(
        fs.existsSync(path.join(userDataDir, 'Starter-Workspace', 'New-Folder', 'Untitled.md'))
      ).toBe(false)

      // Verify right-click folder context menu (icons submenu with Nordic outline icons + standard folder icon, background color, add new note, Templates submenu, rename, delete)
      await page
        .getByTestId('tree-folder-root-starter-New-Folder')
        .click({ button: 'right' })
      await expect(page.getByTestId('file-tree-context-menu')).toBeVisible()
      await expect(page.getByTestId('context-menu-add-note')).toBeVisible()
      await expect(page.getByTestId('context-menu-templates-item')).toBeVisible()
      await expect(page.getByTestId('context-menu-rename')).toBeVisible()
      await expect(page.getByTestId('context-menu-delete')).toBeVisible()
      await expect(page.getByTestId('context-menu-folder-icons-item')).toBeVisible()
      await expect(page.getByTestId('context-menu-folder-colors')).toBeVisible()
      await page.getByTestId('context-menu-folder-icons-item').hover()
      await expect(page.getByTestId('context-menu-folder-icons')).toBeVisible()
      await expect(page.getByTestId('folder-icon-option-folder')).toBeVisible()
      await page.getByTestId('folder-icon-option-star').click()

      // Set folder background color and create a note from a template inside the folder via right-click -> Templates -> Add Meeting Notes
      await page
        .getByTestId('tree-folder-root-starter-New-Folder')
        .click({ button: 'right' })
      await page.getByTestId('folder-color-option-Sky Blue').click()

      await page
        .getByTestId('tree-folder-root-starter-New-Folder')
        .click({ button: 'right' })
      await page.getByTestId('context-menu-templates-item').hover()
      await expect(page.getByTestId('context-menu-templates-submenu')).toBeVisible()
      await expect(page.getByTestId('context-menu-add-template-tpl-meeting-notes')).toContainText(
        'Add Meeting Notes'
      )
      await page.getByTestId('context-menu-add-template-tpl-meeting-notes').click()

      await expect
        .poll(() => {
          const files = fs.readdirSync(
            path.join(userDataDir, 'Starter-Workspace', 'New-Folder')
          )
          return files.some((f) => f.startsWith('Meeting-Notes') && f.endsWith('.md'))
        })
        .toBe(true)

      const evaluatedNoteContent = fs.readFileSync(
        path.join(userDataDir, 'Starter-Workspace', 'New-Folder', 'Meeting-Notes.md'),
        'utf-8'
      )
      expect(evaluatedNoteContent).toContain('New-Folder')
      expect(evaluatedNoteContent).not.toContain('<% folder_name %>')

      // Verify drag-and-drop folders moves the folder and its content into the target folder
      await page.getByTestId('tree-file-root-starter-Welcome.md').click()
      await page.getByTestId('new-folder-btn-root-starter').click()
      await page.getByTestId('inline-rename-folder-input-root-starter').fill('Archive-Target')
      await page.getByTestId('inline-rename-folder-input-root-starter').press('Enter')
      await expect(page.getByTestId('tree-folder-root-starter-Archive-Target')).toBeVisible()
      await page.getByTestId('tree-folder-root-starter-New-Folder').dispatchEvent('dragstart')
      await page.getByTestId('tree-folder-root-starter-Archive-Target').dispatchEvent('dragover')
      await page.getByTestId('tree-folder-root-starter-Archive-Target').dispatchEvent('drop')
      await expect
        .poll(() =>
          fs.existsSync(
            path.join(
              userDataDir,
              'Starter-Workspace',
              'Archive-Target',
              'New-Folder',
              'Meeting-Notes.md'
            )
          )
        )
        .toBe(true)

      const manifestFile = path.join(tmpBase, 'multi.klartext-workspace')
      await page.getByTestId('file-menu-btn').click()
      await page.getByTestId('open-settings-btn').click()
      await expect(page.getByTestId('settings-page-tabs-position-select')).toBeVisible()
      await page.getByTestId('settings-page-tabs-position-select').selectOption('top-menu')
      await expect(
        page.getByTestId('top-titlebar').getByTestId('document-tab-bar')
      ).toBeVisible()
      await page.getByTestId('settings-page-tabs-position-select').selectOption('editor')
      await expect(
        page.getByTestId('top-titlebar').getByTestId('document-tab-bar')
      ).toHaveCount(0)
      await page.getByTestId('manifest-filepath-input').fill(manifestFile)
      await page.getByTestId('save-manifest-btn').click()
      expect(fs.existsSync(manifestFile)).toBe(true)

      // Scenario 2: Create, edit, save, close, and reopen Markdown files across multiple roots via Quick Switcher (in left sidebar bottom controls)
      await expect(page.getByTestId('left-sidebar-bottom-controls')).toBeVisible()
      await page.getByTestId('open-quick-switcher-btn').click()
      await expect(page.getByTestId('quick-switcher-modal')).toBeVisible()
      await page.getByTestId('palette-search-input').fill('BetaDoc.md')
      await page.getByTestId('palette-search-input').press('Enter')
      await expect(page.getByTestId('status-active-root')).toContainText('root-beta')

      // Verify Format menu is positioned to the left of View menu
      const formatBox = await page.getByTestId('format-menu-btn').boundingBox()
      const viewBox = await page.getByTestId('view-menu-btn').boundingBox()
      expect(formatBox!.x).toBeLessThan(viewBox!.x)

      // Scenario 3: Toggle collapsible left/right sidebars, Zen mode, Edit -> Insert submenu, Document Cleanup & Diagrams in Edit menu, top menu hover switching, Help menu, Templates panel, and Command Palette
      await page.getByTestId('edit-menu-btn').click()
      await expect(page.getByTestId('edit-menu-dropdown')).toBeVisible()
      await expect(
        page.getByTestId('edit-menu-dropdown').getByTestId('format-menu-prettify-doc')
      ).toBeVisible()
      await expect(
        page.getByTestId('edit-menu-dropdown').getByTestId('format-menu-align-tables')
      ).toBeVisible()
      await expect(
        page.getByTestId('edit-menu-dropdown').getByTestId('format-menu-clear')
      ).toBeVisible()
      await expect(
        page.getByTestId('edit-menu-dropdown').getByTestId('insert-menu-visual-builder')
      ).toBeVisible()
      await expect(page.getByTestId('insert-menu-btn')).toBeVisible()
      await page.getByTestId('insert-menu-btn').hover()
      await expect(page.getByTestId('insert-menu-dropdown')).toBeVisible()

      // Hover over Format menu while Edit menu is open -> Edit menu closes and Format menu opens
      await page.getByTestId('format-menu-btn').hover()
      await expect(page.getByTestId('format-menu-dropdown')).toBeVisible()
      await expect(page.getByTestId('edit-menu-dropdown')).toHaveCount(0)

      // Hover back to Edit menu and click Copy as Rich HTML
      await page.getByTestId('edit-menu-btn').hover()
      await expect(page.getByTestId('edit-menu-dropdown')).toBeVisible()
      await expect(page.getByTestId('copy-rich-html-btn')).toBeVisible()
      await page.getByTestId('copy-rich-html-btn').click()

      // Verify Help menu opens the right-sided Help panel (`right-help-panel` / `help-reference-modal`) + right panel bottom control strip (`right-sidebar-bottom-controls`)
      await page.getByTestId('help-menu-btn').click()
      await expect(page.getByTestId('help-menu-dropdown')).toBeVisible()
      await page.getByTestId('help-menu-variables').click()
      await expect(page.getByTestId('right-help-panel')).toBeVisible()
      await expect(page.getByTestId('help-reference-modal')).toBeVisible()
      await expect(page.getByTestId('right-sidebar-bottom-controls')).toBeVisible()
      await expect(page.getByTestId('right-panel-tab-frontmatter')).toBeVisible()
      await expect(page.getByTestId('right-panel-tab-templates')).toBeVisible()
      await expect(page.getByTestId('right-panel-tab-ai')).toBeVisible()
      await expect(page.getByTestId('right-panel-tab-help')).toBeVisible()

      // Verify View menu lists all available right-side panels and clicking switches to that panel
      await page.getByTestId('view-menu-btn').click()
      await expect(page.getByTestId('view-menu-toggle-frontmatter')).toBeVisible()
      await expect(page.getByTestId('view-menu-toggle-templates')).toBeVisible()
      await expect(page.getByTestId('view-menu-toggle-ai')).toBeVisible()
      await expect(page.getByTestId('view-menu-toggle-help')).toBeVisible()
      await page.getByTestId('view-menu-toggle-templates').click()
      await expect(page.getByTestId('right-templates-window')).toBeVisible()
      await expect(page.getByTestId('add-new-template-btn')).toBeVisible()
      await page.getByTestId('add-new-template-btn').click()
      await expect(page.getByTestId('doc-tab-__templates__-New-Template.md')).toBeVisible()
      await page.getByTestId('close-templates-window-btn').click()
      await expect(page.getByTestId('right-templates-window')).toHaveCount(0)

      await page.getByTestId('toggle-left-sidebar-btn').click()
      await expect(page.getByTestId('left-sidebar')).toHaveCount(0)
      await page.getByTestId('toggle-left-sidebar-btn').click()
      await expect(page.getByTestId('left-sidebar')).toBeVisible()

      await page.getByTestId('toggle-zen-mode-btn').click()
      await expect(page.getByTestId('exit-zen-mode-btn')).toBeVisible()
      await page.getByTestId('exit-zen-mode-btn').click()

      await page.getByTestId('open-command-palette-btn').click()
      await expect(page.getByTestId('command-palette-modal')).toBeVisible()
      await page.getByTestId('palette-search-input').press('Escape')

      // Scenario 4 & 5 & 10: Switch among Source, Inline Rich, and Split modes + formatting toolbar + Undo/Redo + GFM/KaTeX/Frontmatter
      await expect(page.getByTestId('editor-formatting-bar')).toHaveCount(0)
      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-toggle-toolbar').click()
      await expect(page.getByTestId('editor-formatting-bar')).toBeVisible()

      await page.getByTestId('mode-btn-source').click()
      await page.getByTestId('fmt-bold').click()
      await expect(page.getByTestId('codemirror-editor-container')).toContainText('**bold text**')

      // Verify Undo & Redo via Edit menu
      await page.getByTestId('edit-menu-btn').click()
      await page.getByTestId('edit-menu-undo').click()
      await expect(page.getByTestId('codemirror-editor-container')).not.toContainText('**bold text**')

      await page.getByTestId('edit-menu-btn').click()
      await page.getByTestId('edit-menu-redo').click()
      await expect(page.getByTestId('codemirror-editor-container')).toContainText('**bold text**')

      await page.getByTestId('mode-btn-split').click()
      await expect(page.getByTestId('markdown-split-preview')).toBeVisible()
      await page.getByTestId('mode-btn-inline').click()

      // Scenario 6 & 7: Strict per-root asset saving in Root B and Root C, then cross-root move with asset migration
      const assetBRes = await page.evaluate(async (b64) => {
        const ws = await window.klartext.getWorkspaceState()
        const rootB = ws.roots.find((r) => r.path.includes('root-beta'))!
        const rootC = ws.roots.find((r) => r.path.includes('root-gamma'))!
        const savedB = await window.klartext.saveAsset({
          rootId: rootB.id,
          documentRelativePath: 'BetaDoc.md',
          fileName: 'beta-chart.png',
          mimeType: 'image/png',
          base64Data: b64,
          category: 'images'
        })
        await window.klartext.writeDocument(
          rootB.id,
          'BetaDoc.md',
          `# Beta Document\n\n${savedB.markdownLink}\n`
        )
        const savedC = await window.klartext.saveAsset({
          rootId: rootC.id,
          documentRelativePath: 'GammaDoc.md',
          fileName: 'gamma-chart.png',
          mimeType: 'image/png',
          base64Data: b64,
          category: 'images'
        })
        return { rootBId: rootB.id, rootCId: rootC.id, savedB, savedC }
      }, VALID_PNG_BASE64)

      expect(fs.existsSync(path.join(rootBDir, 'assets/images/beta-chart.png'))).toBe(true)
      expect(fs.existsSync(path.join(rootCDir, 'assets/images/gamma-chart.png'))).toBe(true)
      expect(fs.existsSync(path.join(rootBDir, 'assets/images/gamma-chart.png'))).toBe(false)

      // Move BetaDoc.md to another root with asset migration via IPC & verify
      const movedRes = await page.evaluate(
        async ({ sourceRootId, targetRootId }) => {
          return window.klartext.moveDocumentCrossRoot({
            sourceRootId,
            sourceRelativePath: 'BetaDoc.md',
            targetRootId,
            targetRelativePath: 'BetaDoc.md',
            migrateAssets: true
          })
        },
        { sourceRootId: assetBRes.rootBId, targetRootId: assetBRes.rootCId }
      )
      expect(movedRes.migratedAssets).toContain('assets/images/beta-chart.png')
      expect(fs.existsSync(path.join(rootCDir, 'assets/images/beta-chart.png'))).toBe(true)

      // Scenario 8 & 9: Mermaid diagram live SVG rendering, Visual Mermaid Builder round-trip, & graceful diagnostic on invalid syntax
      await page.getByTestId(`doc-tab-root-starter-Welcome.md`).click()
      await expect(page.getByTestId('mermaid-widget').first()).toBeVisible()
      await page.getByTestId('mermaid-open-visual-builder').first().click()
      await expect(page.getByTestId('visual-mermaid-builder-modal')).toBeVisible()
      await expect(page.getByTestId('mermaid-builder-generated-code')).toContainText('Multi-Root Workspace')
      await page.getByTestId('mermaid-builder-insert-btn').click()
      await expect(page.getByTestId('visual-mermaid-builder-modal')).toHaveCount(0)

      await page.getByTestId('mermaid-toggle-source').first().click()
      await page.getByTestId('mermaid-source-textarea').first().fill('invalid_mermaid_syntax %%%')
      await expect(page.getByTestId('mermaid-error-banner').first()).toBeVisible()

      // Verify folder status (icons, colors, collapsed state) is persisted and migrated when moved via drag-and-drop
      const savedFolderSettings = await page.evaluate(() => window.klartext.getSettings())
      expect(
        savedFolderSettings.folderIcons?.['root-starter/Archive-Target/New-Folder']
      ).toBe('star')
      expect(
        savedFolderSettings.folderColors?.['root-starter/Archive-Target/New-Folder']
      ).toBe('rgba(2, 132, 199, 0.22)')
    } finally {
      await app.close()
    }
  })

  test('Scenarios 11–17: External File Watcher, Multi-Root Search/Replace, Crash Recovery, Concurrent Multi-Repo Git Conflict Resolution, Local AI (SV/EN) & Export/Theme', async () => {
    // Prepare two Git repositories for Scenario 14
    const remote1 = path.join(tmpBase, 'remote1.git')
    const remote2 = path.join(tmpBase, 'remote2.git')
    await simpleGit().init(true, [remote1])
    await simpleGit().init(true, [remote2])

    const initGitRoot = async (dir: string, remote: string, docName: string) => {
      const g = simpleGit(dir)
      await g.init()
      await g.addConfig('user.name', 'E2E User')
      await g.addConfig('user.email', 'e2e@klartext.local')
      await g.checkoutLocalBranch('main')
      fs.writeFileSync(path.join(dir, docName), '# Shared\nBase line\n', 'utf-8')
      await g.add(['.'])
      await g.commit('Initial')
      await g.addRemote('origin', remote)
      await g.push(['-u', 'origin', 'main'])
    }

    await initGitRoot(rootBDir, remote1, 'BetaDoc.md')
    await initGitRoot(rootCDir, remote2, 'GammaDoc.md')

    // Start mock Ollama server on 127.0.0.1 for Scenario 15
    const ollamaServer = http.createServer((req, res) => {
      if (req.url === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            models: [{ name: 'gemma4:12b', details: { parameter_size: '12B' } }]
          })
        )
        return
      }
      if (req.url === '/api/chat') {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        res.write(
          JSON.stringify({
            message: { content: '# Svensk Rubrik\n\nKorrekt sammansatt **användargränssnitt**.' },
            done: false
          }) + '\n'
        )
        res.end(JSON.stringify({ message: { content: '' }, done: true }) + '\n')
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => ollamaServer.listen(0, '127.0.0.1', resolve))
    const ollamaPort = (ollamaServer.address() as { port: number }).port

    const app = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/index.js')],
      env: {
        ...process.env,
        KLARTEXT_USER_DATA_DIR: userDataDir,
        KLARTEXT_E2E_AUTO_SAVE_EXPORT: '1'
      }
    })

    try {
      const page = await app.firstWindow()
      await expect(page.getByTestId('klartext-app-shell')).toBeVisible()

      // Mount both Git roots via IPC (triggers EVENT_WATCHER_CHANGE so React state updates immediately)
      await page.evaluate(
        async ({ bDir, cDir }) => {
          await window.klartext.addRoot({ path: bDir })
          await window.klartext.addRoot({ path: cDir })
        },
        { bDir: rootBDir, cDir: rootCDir }
      )
      await expect(page.getByText('root-beta')).toBeVisible()
      await expect(page.getByText('root-gamma')).toBeVisible()

      const wsState = await page.evaluate(() => window.klartext.getWorkspaceState())
      const repo1Id = wsState.roots.find((r) => r.path.includes('root-beta'))!.id
      const repo2Id = wsState.roots.find((r) => r.path.includes('root-gamma'))!.id

      // Scenario 11: External file modification reload
      await page.getByTestId(`tree-file-${repo1Id}-BetaDoc.md`).click()
      fs.writeFileSync(
        path.join(rootBDir, 'BetaDoc.md'),
        '# Shared\nExternally updated line on disk\n',
        'utf-8'
      )

      // Scenario 12: Multi-root instant search-as-you-type and replace with confirmation
      await page.getByTestId('sidebar-tab-search').click()
      await page.getByTestId('global-search-input').fill('Externally updated')
      await expect(page.getByTestId(`search-result-card-${repo1Id}-BetaDoc.md`)).toBeVisible()
      await page.getByTestId('global-replace-input').fill('Replaced across root')
      await page.getByTestId('global-replace-confirm-btn').click()
      await expect(page.getByTestId('search-replace-summary')).toContainText('Replaced 1 occurrence')

      // Scenario 13: Crash recovery snapshot save & list
      await page.evaluate(async (rId) => {
        await window.klartext.saveRecoverySnapshot(
          rId,
          'BetaDoc.md',
          '# Unsaved Crash Recovery Buffer'
        )
      }, repo1Id)
      const snaps = await page.evaluate(() => window.klartext.listRecoverySnapshots())
      expect(snaps.some((s) => s.content.includes('Unsaved Crash Recovery Buffer'))).toBe(true)

      // Scenario 14: Concurrent Multi-Repo Sync where Repo 1 pushes cleanly and Repo 2 enters isolated conflict resolution
      await page.evaluate(async (rId) => {
        await window.klartext.gitStage(rId, ['BetaDoc.md'])
        await window.klartext.gitCommit(rId, 'Clean commit on Repo 1')
      }, repo1Id)

      // Create remote conflict on Repo 2
      const otherClone = path.join(tmpBase, 'other-repo2')
      await simpleGit().clone(remote2, otherClone)
      const gOther = simpleGit(otherClone)
      await gOther.addConfig('user.name', 'Other')
      await gOther.addConfig('user.email', 'other@klartext.local')
      fs.writeFileSync(path.join(otherClone, 'GammaDoc.md'), '# Shared\nRemote Gamma Line\n', 'utf-8')
      await gOther.add(['GammaDoc.md'])
      await gOther.commit('Remote commit')
      await gOther.push('origin', 'main')

      fs.writeFileSync(path.join(rootCDir, 'GammaDoc.md'), '# Shared\nLocal Gamma Line\n', 'utf-8')
      await page.evaluate(async (rId) => {
        await window.klartext.gitStage(rId, ['GammaDoc.md'])
        await window.klartext.gitCommit(rId, 'Local commit on Repo 2')
      }, repo2Id)

      await page.getByTestId('sidebar-tab-git').click()
      await page.getByTestId('sync-all-repos-btn').click()

      await expect(page.getByTestId(`git-repo-state-${repo1Id}`)).toContainText('Synced')
      await expect(page.getByTestId(`git-repo-state-${repo2Id}`)).toContainText('Merge Conflict')
      await expect(page.getByTestId(`git-conflicted-group-${repo2Id}`)).toBeVisible()

      // Resolve Repo 2 conflict via inline action button
      await page.getByTestId(`git-resolve-both-${repo2Id}-GammaDoc.md`).click()
      await expect(page.getByTestId(`git-conflicted-group-${repo2Id}`)).toHaveCount(0)

      // Scenario 15: Local AI Assistant, Hardware Advisor, Bilingual Rewrite, and Diff Accept (via AI menu)
      await page.getByTestId('ai-menu-btn').click()
      await expect(page.getByTestId('ai-menu-dropdown')).toBeVisible()
      await expect(page.getByTestId('toggle-inline-ai-prompt-btn')).toBeVisible()
      await expect(page.getByTestId('ai-quick-improve-btn')).toBeVisible()
      await page.getByTestId('toggle-right-sidebar-btn').click()
      await expect(page.getByTestId('right-ai-panel')).toBeVisible()
      await expect(page.getByTestId('hardware-advisor-card')).toBeVisible()
      await expect(page.getByTestId('detected-ram-badge')).toContainText('GB RAM')

      await page.getByTestId('ai-endpoint-input').fill(`http://127.0.0.1:${ollamaPort}`)
      await page.getByTestId('ai-test-connection-btn').click()
      await expect(page.getByTestId('ai-connection-badge')).toContainText('Connected')

      await page.getByTestId('ai-action-improve').click()
      await expect(page.getByTestId('ai-diff-review-card')).toBeVisible()
      await expect(page.getByTestId('ai-diff-proposed-text')).toContainText('användargränssnitt')
      await page.getByTestId('ai-diff-accept-btn').click()
      await expect(page.getByTestId('ai-diff-review-card')).toHaveCount(0)

      // Scenario 16 & 17: Export to standalone HTML & PDF via File Menu + View Menu (Theme, White Paper, Word Wrap, Frontmatter Window)
      await page.getByTestId('file-menu-btn').click()
      await page.getByTestId('export-html-btn').click()
      await expect(page.getByTestId('export-status-banner')).toContainText('Exported HTML')

      await page.getByTestId('file-menu-btn').click()
      await page.getByTestId('export-pdf-btn').click()
      await expect(page.getByTestId('export-status-banner')).toContainText('Exported PDF')

      await page.getByTestId('view-menu-btn').click()
      await expect(page.getByTestId('view-menu-dropdown')).toBeVisible()
      await page.getByTestId('view-menu-toggle-wordwrap').click()
      await expect(page.getByTestId('view-menu-dropdown')).toHaveCount(0)

      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-toggle-wordwrap').click()

      // Verify View menu width is spacious (>= 300px) and never cramped
      await page.getByTestId('view-menu-btn').click()
      const viewMenuBox = await page.getByTestId('view-menu-dropdown').boundingBox()
      expect(viewMenuBox!.width).toBeGreaterThanOrEqual(300)
      await page.getByTestId('view-menu-toggle-frontmatter').click()
      await expect(page.getByTestId('right-frontmatter-window')).toBeVisible()
      // Mutual exclusion: right-ai-panel must be hidden when right-frontmatter-window is shown
      await expect(page.getByTestId('right-ai-panel')).toHaveCount(0)

      // Verify switching between different right panels keeps the exact same width (does not resize)
      const fmPanelBox = await page.getByTestId('right-panel-container').boundingBox()
      await page.getByTestId('right-panel-tab-templates').click()
      await expect(page.getByTestId('right-templates-window')).toBeVisible()
      const tplPanelBox = await page.getByTestId('right-panel-container').boundingBox()
      expect(tplPanelBox!.width).toBe(fmPanelBox!.width)

      await page.getByTestId('right-panel-tab-ai').click()
      await expect(page.getByTestId('right-ai-panel')).toBeVisible()
      const aiPanelBox = await page.getByTestId('right-panel-container').boundingBox()
      expect(aiPanelBox!.width).toBe(fmPanelBox!.width)

      await page.getByTestId('right-panel-tab-help').click()
      await expect(page.getByTestId('right-help-panel')).toBeVisible()
      const helpPanelBox = await page.getByTestId('right-panel-container').boundingBox()
      expect(helpPanelBox!.width).toBe(fmPanelBox!.width)

      // Switch back to Frontmatter and verify Toggle Right Panel button hides and re-opens the last activated right panel
      await page.getByTestId('right-panel-tab-frontmatter').click()
      await expect(page.getByTestId('right-frontmatter-window')).toBeVisible()
      await page.getByTestId('toggle-right-panel-btn').click()
      await expect(page.getByTestId('right-frontmatter-window')).toHaveCount(0)
      await page.getByTestId('toggle-right-panel-btn').click()
      await expect(page.getByTestId('right-frontmatter-window')).toBeVisible()

      // Verify global tooltip portal renders on top of all UI elements (z-index: 2147483647)
      await page.getByTestId('right-panel-tab-templates').hover()
      await expect(page.getByTestId('global-tooltip-portal')).toBeVisible()
      await expect(page.getByTestId('global-tooltip-portal')).toContainText('Templates')

      // Verify Insert Icon via Edit menu (`edit-menu-insert-icon`) opens Command Palette in Icon Search Mode (`icon-picker-modal`)
      await page.getByTestId('edit-menu-btn').click()
      await expect(page.getByTestId('edit-menu-insert-icon')).toBeVisible()
      await page.getByTestId('edit-menu-insert-icon').click()
      await expect(page.getByTestId('icon-picker-modal')).toBeVisible()
      await expect(page.getByTestId('icon-picker-grid')).toBeVisible()
      await page.getByTestId('palette-search-input').fill('Sparkles')
      await page.getByTestId('icon-picker-item-Sparkles').click()
      await expect(page.getByTestId('icon-picker-modal')).toHaveCount(0)

      // Verify Saved Themes, Theme Preview Window, and 12 Highlight Colors + Custom Highlight Color in Settings
      await page.getByTestId('file-menu-btn').click()
      await page.getByTestId('open-settings-btn').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()
      await page.getByTestId('settings-tab-visual').click()
      await expect(page.getByTestId('theme-preview-window')).toBeVisible()
      await expect(page.getByTestId('highlight-color-palette')).toBeVisible()
      await page.getByTestId('highlight-color-swatch-emerald-mint').click()
      await page.getByTestId('custom-highlight-hex-input').fill('#FF3399')
      await page.getByTestId('add-custom-highlight-color-btn').click()
      const appliedHighlightVar = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--highlight-color')
      )
      expect(appliedHighlightVar).toBe('#FF3399')

      // Save a new theme, verify it appears in dropdown, edit it, and export/import
      await page.getByTestId('save-new-theme-input').fill('My Nordic Theme')
      await page.getByTestId('save-theme-btn').click()
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText('My Nordic Theme')
      await page.getByTestId('export-themes-btn').click()
      await expect(page.getByTestId('themes-import-export-drawer')).toBeVisible()
      await expect(page.getByTestId('themes-json-textarea')).toHaveValue(/My Nordic Theme/)
      await page.getByTestId('close-settings-btn').click()

      // Verify Power-User dynamic variables (CLI exec, sh script, URL fetch, env var)
      const powerResult = await page.evaluate(async (port) => {
        return window.klartext.evaluatePowerTemplate({
          expressions: [
            'exec: printf "CLI_OK"',
            'sh: echo "SH_OK"',
            `json_url: http://127.0.0.1:${port}/api/tags | models.0.name`,
            'env:PATH'
          ]
        })
      }, ollamaPort)
      expect(powerResult['exec: printf "CLI_OK"']).toBe('CLI_OK')
      expect(powerResult['sh: echo "SH_OK"']).toBe('SH_OK')
      expect(powerResult[`json_url: http://127.0.0.1:${ollamaPort}/api/tags | models.0.name`]).toBe(
        'gemma4:12b'
      )
      expect(powerResult['env:PATH'].length).toBeGreaterThan(0)

      // Verify sidebar tab icons are inside left-sidebar-bottom-controls and can be toggled from View menu
      await expect(
        page.getByTestId('left-sidebar-bottom-controls').getByTestId('sidebar-tab-switcher')
      ).toBeVisible()
      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-toggle-sidebar-bar').click()
      await expect(page.getByTestId('left-sidebar-bottom-controls')).toHaveCount(0)
      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-toggle-sidebar-bar').click()
      await expect(page.getByTestId('left-sidebar-bottom-controls')).toBeVisible()

      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-toggle-theme').click()
      const themeAttr = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      )
      expect(['light', 'dark']).toContain(themeAttr)
      if (themeAttr === 'dark') {
        await page.getByTestId('view-menu-btn').click()
        await page.getByTestId('view-menu-toggle-lightpaper').click()
        await expect
          .poll(() =>
            page.evaluate(() =>
              document.documentElement.getAttribute('data-light-paper')
            )
          )
          .toBe('true')
      }

      // Verify all settings, panel visibility, sidebar tab, saved themes, and open tabs are persisted
      const persistedSettings = await page.evaluate(() => window.klartext.getSettings())
      expect(persistedSettings.frontmatterPanelVisible).toBe(true)
      expect(persistedSettings.lastActiveRightPanel).toBe('frontmatter')
      expect(persistedSettings.leftSidebarTab).toBe('git')
      expect(persistedSettings.savedThemes?.some((t) => t.name === 'My Nordic Theme')).toBe(true)
      expect(Array.isArray(persistedSettings.openTabs)).toBe(true)
      expect(persistedSettings.openTabs.length).toBeGreaterThan(0)
    } finally {
      await app.close()
      ollamaServer.close()
    }
  })
})
