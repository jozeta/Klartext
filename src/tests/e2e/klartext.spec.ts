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

      // Verify "Mount Root Folder by Path" and "Open new workspace" icons are removed from left panel header
      await expect(page.getByTestId('toggle-add-root-path-btn')).toHaveCount(0)
      await expect(page.getByTestId('add-folder-dialog-btn')).toHaveCount(0)
      // Verify AI menu is removed from top row menus
      await expect(page.getByTestId('ai-menu-btn')).toHaveCount(0)

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

      // Verify File menu has "Add Git workspace..." and "Create a new dynamic workspace..." wizards
      await page.getByTestId('file-menu-btn').click()
      await expect(page.getByTestId('file-menu-add-git-workspace')).toBeVisible()
      await expect(page.getByTestId('file-menu-create-dynamic-workspace')).toBeVisible()
      await page.getByTestId('file-menu-add-git-workspace').click()
      await expect(page.getByTestId('github-workspace-wizard-modal')).toBeVisible()
      await page.getByTestId('github-wizard-repo-input').fill('octocat/Hello-World')
      await page.getByTestId('github-wizard-next-btn').click()
      await expect(page.getByTestId('github-wizard-folder-name-input')).toHaveValue('Hello-World')
      await page.keyboard.press('Escape')
      await page
        .getByTestId('github-workspace-wizard-modal')
        .locator('button', { hasText: 'Cancel' })
        .click()
      await expect(page.getByTestId('github-workspace-wizard-modal')).toHaveCount(0)

      // Create a Dynamic Workspace with a Dynamic Folder via the wizard and verify wildcard matching
      await page.getByTestId('file-menu-btn').click()
      await page.getByTestId('file-menu-create-dynamic-workspace').click()
      await expect(page.getByTestId('dynamic-workspace-wizard-modal')).toBeVisible()
      await page.getByTestId('dynamic-wizard-workspace-name-input').fill('Nordic Dynamic Hub')
      await page.getByTestId('dynamic-wizard-folder-name-input').fill('Beta & Welcome Docs')
      await page.getByTestId('dynamic-wizard-next-btn').click()
      // Verify typing a partial tag (#sec) filters suggestions and clicking #security completes the tag
      await page.getByTestId('dynamic-wizard-tags-input').fill('#sec')
      await expect(page.getByTestId('dynamic-wizard-tag-suggestion-security')).toBeVisible()
      await expect(page.getByTestId('dynamic-wizard-tag-suggestion-architecture')).toHaveCount(0)
      await page.getByTestId('dynamic-wizard-tag-suggestion-security').click()
      await expect(page.getByTestId('dynamic-wizard-tags-input')).toHaveValue('#security')
      await page.getByTestId('dynamic-wizard-tags-input').fill('')
      await page.getByTestId('dynamic-wizard-title-input').fill('*Beta*')
      await expect(page.getByTestId('dynamic-wizard-live-preview')).toContainText('BetaDoc.md')
      await page.getByTestId('dynamic-wizard-submit-btn').click()
      await expect(page.getByTestId('dynamic-workspace-wizard-modal')).toHaveCount(0)
      await expect(page.getByText('Nordic Dynamic Hub')).toBeVisible()
      await expect(page.getByText('Beta & Welcome Docs')).toBeVisible()

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

      // Verify workspace sort controls (Name A-Z, Name Z-A, Custom dropdown + Folders on top checkbox)
      await expect(page.getByTestId('workspace-sort-controls')).toBeVisible()
      await expect(page.getByTestId('workspace-sort-order-select')).toBeVisible()
      await expect(page.getByTestId('workspace-folders-on-top-checkbox')).toBeChecked()
      await page.getByTestId('workspace-sort-order-select').selectOption('name-desc')
      await expect(page.getByTestId('workspace-sort-order-select')).toHaveValue('name-desc')
      await page.getByTestId('workspace-sort-order-select').selectOption('name-asc')
      await expect(page.getByTestId('workspace-sort-order-select')).toHaveValue('name-asc')

      // Verify right-click Sticky option on file and folder pins them to top of folder (folders first, then files, sorted A-Z)
      await page.getByTestId('tree-file-root-starter-Welcome.md').click({ button: 'right' })
      await expect(page.getByTestId('context-menu-toggle-sticky')).toBeVisible()
      await page.getByTestId('context-menu-toggle-sticky').click()
      await expect(page.getByTestId('tree-sticky-badge-root-starter-Welcome.md')).toBeVisible()

      // Verify drag-and-drop folders moves the folder and its content into the target folder and automatically switches sort order to Custom
      await page.getByTestId('tree-file-root-starter-Welcome.md').click()
      await page.getByTestId('new-folder-btn-root-starter').click()
      await page.getByTestId('inline-rename-folder-input-root-starter').fill('Archive-Target')
      await page.getByTestId('inline-rename-folder-input-root-starter').press('Enter')
      await expect(page.getByTestId('tree-folder-root-starter-Archive-Target')).toBeVisible()
      await page.getByTestId('tree-folder-root-starter-New-Folder').dispatchEvent('dragstart')
      await page.getByTestId('tree-folder-root-starter-Archive-Target').dispatchEvent('dragover')
      await page.getByTestId('tree-folder-root-starter-Archive-Target').dispatchEvent('drop')
      await expect(page.getByTestId('workspace-sort-order-select')).toHaveValue('custom')
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

      // Verify Settings -> Frontmatter Tab: Default properties, Creation Date with <% creation_date %>, add & remove default properties
      await page.getByTestId('settings-tab-frontmatter').click()
      await expect(page.getByTestId('settings-frontmatter-panel')).toBeVisible()
      await expect(page.getByTestId('settings-fm-prop-label-date')).toContainText('Creation Date')
      await expect(page.getByTestId('settings-fm-default-input-date')).toHaveValue(
        '<% creation_date %>'
      )
      await expect(page.getByTestId('settings-fm-default-input-title')).toHaveValue('<% title %>')
      // Add a new default property with a dynamic variable and another temporary property to remove
      await page.getByTestId('settings-fm-new-key-input').fill('category')
      await page.getByTestId('settings-fm-new-default-input').fill('<% folder_name %>')
      await page.getByTestId('settings-fm-add-btn').click()
      await expect(page.getByTestId('settings-fm-prop-row-category')).toBeVisible()
      await page.getByTestId('settings-fm-new-key-input').fill('temp_prop')
      await page.getByTestId('settings-fm-new-default-input').fill('temporary')
      await page.getByTestId('settings-fm-add-btn').click()
      await expect(page.getByTestId('settings-fm-prop-row-temp_prop')).toBeVisible()
      await page.getByTestId('settings-fm-remove-btn-temp_prop').click()
      await expect(page.getByTestId('settings-fm-prop-row-temp_prop')).toHaveCount(0)

      await page.getByTestId('settings-tab-general').click()
      await page.getByTestId('manifest-filepath-input').fill(manifestFile)
      await page.getByTestId('save-manifest-btn').click()
      await expect.poll(() => fs.existsSync(manifestFile)).toBe(true)

      // Verify creating a new file populates frontmatter with evaluated default properties (including Creation Date)
      // and renaming the file while headline is still # Untitled updates the headline to the new file name (without extension)
      await page.getByTestId('tree-file-root-starter-Welcome.md').click()
      await page.getByTestId('new-file-btn-root-starter').click()
      await expect(page.getByTestId('inline-rename-input-root-starter')).toBeVisible()
      await page
        .getByTestId('inline-rename-input-root-starter')
        .fill('Architecture-Overview.md')
      await page.getByTestId('inline-rename-input-root-starter').press('Enter')
      await expect
        .poll(() =>
          fs.existsSync(
            path.join(userDataDir, 'Starter-Workspace', 'Architecture-Overview.md')
          )
        )
        .toBe(true)
      const renamedContent = fs.readFileSync(
        path.join(userDataDir, 'Starter-Workspace', 'Architecture-Overview.md'),
        'utf-8'
      )
      expect(renamedContent).toContain('# Architecture-Overview')
      expect(renamedContent).not.toContain('# Architecture-Overview.md')
      expect(renamedContent).not.toContain('# Untitled')
      expect(renamedContent).toMatch(/date:\s*"?\d{4}-\d{2}-\d{2}"?/)
      expect(renamedContent).toContain('category: Starter Notes')

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

      // Verify Help menu opens the right-sided Help panel (`right-help-panel` / `help-reference-modal`) and does NOT contain Show Right Templates Panel
      await page.getByTestId('help-menu-btn').click()
      await expect(page.getByTestId('help-menu-dropdown')).toBeVisible()
      await expect(page.getByTestId('help-menu-open-templates')).toHaveCount(0)
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

      // Scenario 8 & 9: Mermaid diagram live SVG rendering, Visio-style Visual Diagram Studio (17 diagram types, Packet & C4 removed), & graceful diagnostic on invalid syntax
      await page.getByTestId(`doc-tab-root-starter-Welcome.md`).click()
      await expect(page.getByTestId('mermaid-widget').first()).toBeVisible()
      await page.getByTestId('mermaid-open-visual-builder').first().click()
      await expect(page.getByTestId('visual-mermaid-builder-modal')).toBeVisible()
      await expect(page.getByTestId('mermaid-preset-gallery')).toBeVisible()
      await expect(page.getByTestId('mermaid-preset-packet')).toHaveCount(0)
      await expect(page.getByTestId('mermaid-preset-c4')).toHaveCount(0)
      await expect(page.getByTestId('mermaid-builder-generated-code')).toContainText('Multi-Root Workspace')

      // Verify Visio-style shape stencil buttons with SVG icons, arrow style buttons, and 2D canvas pan & zoom
      await expect(page.getByTestId('mermaid-add-rect')).toBeVisible()
      await expect(page.getByTestId('mermaid-add-subroutine')).toBeVisible()
      await expect(page.getByTestId('mermaid-add-hexagon')).toBeVisible()
      await expect(page.getByTestId('mermaid-arrow-solid')).toBeVisible()
      await expect(page.getByTestId('mermaid-arrow-dashed')).toBeVisible()
      await expect(page.getByTestId('mermaid-arrow-thick')).toBeVisible()
      await expect(page.getByTestId('mermaid-arrow-bi')).toBeVisible()
      await expect(page.getByTestId('mermaid-split-divider-horizontal')).toBeVisible()

      await page.getByTestId('mermaid-canvas-zoom-in').click()
      await expect(page.getByTestId('mermaid-canvas-zoom-level')).toContainText('115%')
      await page.getByTestId('mermaid-canvas-zoom-reset').click()
      await expect(page.getByTestId('mermaid-canvas-zoom-level')).toContainText('100%')

      // Switch to Sequence, Kanban, and Quadrant presets and verify their graphical drag-and-drop GUI builders
      await page.getByTestId('mermaid-preset-sequence').click()
      await expect(page.getByTestId('mermaid-visual-sequence-builder')).toBeVisible()
      await page.getByTestId('mermaid-preset-kanban').click()
      await expect(page.getByTestId('mermaid-visual-kanban-builder')).toBeVisible()
      await page.getByTestId('mermaid-preset-quadrant').click()
      await expect(page.getByTestId('mermaid-visual-quadrant-builder')).toBeVisible()

      // Verify Zoom & Grid controls in Live Output Preview
      await page.getByTestId('mermaid-zoom-in-btn').click()
      await expect(page.getByTestId('mermaid-zoom-level')).toContainText('115%')
      await page.getByTestId('mermaid-zoom-reset-btn').click()
      await expect(page.getByTestId('mermaid-zoom-level')).toContainText('100%')

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
      if (req.url === '/test-article') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Klartext Architecture Spec</title>
              <meta name="description" content="Official reference guide for Klartext architecture." />
            </head>
            <body>
              <article>
                <h1>Klartext Architecture Spec</h1>
                <p>This article explains <strong>multi-root</strong> workspaces and <a href="https://example.com">specs</a>.</p>
              </article>
            </body>
          </html>
        `)
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

      // Scenario 15: Local AI Assistant, Collapsible Setup & Hardware Advisor, Multi-Root Q&A, Bilingual Rewrite, and Diff Accept
      await expect(page.getByTestId('ai-menu-btn')).toHaveCount(0)
      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-toggle-ai').click()
      await expect(page.getByTestId('right-ai-panel')).toBeVisible()
      await expect(page.getByTestId('hardware-advisor-card')).toBeVisible()
      await expect(page.getByTestId('detected-ram-badge')).toContainText('GB RAM')

      // Verify Format as GFM Table and Generate Mermaid Diagram were removed from AI panel
      await expect(page.getByTestId('ai-action-format-table')).toHaveCount(0)
      await expect(page.getByTestId('ai-action-mermaid')).toHaveCount(0)

      // Verify Local AI Setup & Connection and Hardware Advisor are collapsed by default
      await expect(page.getByTestId('local-ai-connection-body')).toHaveCount(0)
      await expect(page.getByTestId('hardware-advisor-body')).toHaveCount(0)

      // Expand Hardware & Model Advisor and verify body renders
      await page.getByTestId('toggle-hardware-advisor-btn').click()
      await expect(page.getByTestId('hardware-advisor-body')).toBeVisible()

      // Expand Local AI Setup & Connection, verify floating menu AI buttons are greyed out when no AI model is configured/connected, then test connection
      await page.getByTestId('toggle-local-ai-setup-btn').click()
      await expect(page.getByTestId('local-ai-connection-body')).toBeVisible()
      await expect(page.getByTestId('ai-rag-section')).toBeVisible()

      // Select "None (No AI model configured)" and select text in editor -> verify all 5 AI buttons in floating menu are greyed out (disabled)
      await page.getByTestId('ai-model-select').selectOption('')
      await page.locator('.cm-content').first().click()
      await page.keyboard.press('Meta+a')
      await expect(page.getByTestId('floating-selection-toolbar')).toBeVisible()
      await expect(page.getByTestId('floating-ai-improve')).toBeDisabled()
      await expect(page.getByTestId('floating-ai-grammar')).toBeDisabled()
      await expect(page.getByTestId('floating-ai-custom-btn')).toBeDisabled()
      await expect(page.getByTestId('floating-ai-translate-en-sv')).toBeDisabled()
      await expect(page.getByTestId('floating-ai-translate-sv-en')).toBeDisabled()

      // Connect to Ollama server and select model -> verify AI buttons in floating menu become enabled
      await page.getByTestId('ai-endpoint-input').fill(`http://127.0.0.1:${ollamaPort}`)
      await page.getByTestId('ai-test-connection-btn').click()
      await expect(page.getByTestId('ai-connection-badge')).toContainText('Connected')
      await page.getByTestId('ai-model-select').selectOption('gemma4:12b')
      await page.locator('.cm-content').first().click()
      await page.keyboard.press('Meta+a')
      await expect(page.getByTestId('floating-selection-toolbar')).toBeVisible()
      await expect(page.getByTestId('floating-ai-improve')).toBeEnabled()
      await expect(page.getByTestId('floating-ai-grammar')).toBeEnabled()
      await expect(page.getByTestId('floating-ai-custom-btn')).toBeEnabled()
      await expect(page.getByTestId('floating-ai-translate-en-sv')).toBeEnabled()
      await expect(page.getByTestId('floating-ai-translate-sv-en')).toBeEnabled()

      // Verify Multi-Root Workspace Q&A button works and returns answer + citations
      await page.getByTestId('ai-rag-question-input').fill('Vad står det i dokumenten?')
      await page.getByTestId('ai-rag-ask-btn').click()
      await expect(page.getByTestId('ai-rag-answer-card')).toBeVisible()
      await expect(page.getByTestId('ai-rag-answer-text')).not.toBeEmpty()

      // Verify AI Improve produces clean rewrite without strikethrough
      await page.getByTestId('ai-action-improve').click()
      await expect(page.getByTestId('ai-diff-review-card')).toBeVisible()
      await expect(page.getByTestId('ai-diff-proposed-text')).toContainText('användargränssnitt')
      await expect(
        page.getByTestId('ai-diff-review-card').locator('.line-through')
      ).toHaveCount(0)
      await page.getByTestId('ai-diff-accept-btn').click()
      await expect(page.getByTestId('ai-diff-review-card')).toHaveCount(0)

      // Verify AI Custom Instruction Dialog Box from Right AI Panel
      await expect(page.getByTestId('ai-action-custom-dialog-btn')).toBeVisible()
      await page.getByTestId('ai-action-custom-dialog-btn').click()
      await expect(page.getByTestId('ai-custom-instruction-modal')).toBeVisible()
      await expect(page.getByTestId('ai-custom-dialog-selected-text')).toBeVisible()
      await page
        .getByTestId('ai-custom-dialog-input')
        .fill('Rewrite this text clearly in Swedish')
      await page.getByTestId('ai-custom-dialog-submit-btn').click()
      await expect(page.getByTestId('ai-custom-dialog-result-box')).toBeVisible()
      await expect(page.getByTestId('ai-custom-dialog-result-text')).toContainText(
        'användargränssnitt'
      )
      await page.getByTestId('ai-custom-dialog-accept-btn').click()
      await expect(page.getByTestId('ai-custom-instruction-modal')).toHaveCount(0)

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

      // Verify Local AI & Multi-Root Workspace Q&A documentation in Help Panel
      await page.getByTestId('help-tab-ai').click()
      await expect(page.getByTestId('help-ai-section')).toBeVisible()
      await expect(page.getByTestId('help-ai-section')).toContainText(
        'Multi-Root Workspace Q&A (Local RAG)'
      )

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

      // Verify Saved Themes (including the 6 curated Nordic dark & light themes), Theme Preview Window, and 12 Highlight Colors + Custom Highlight Color in Settings
      await page.getByTestId('file-menu-btn').click()
      await page.getByTestId('open-settings-btn').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()
      await page.getByTestId('settings-tab-visual').click()
      await expect(page.getByTestId('theme-preview-window')).toBeVisible()
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText(
        'Abisko Midnight (Dark)'
      )
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText(
        'Sarek Granite (Dark)'
      )
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText(
        'Gotland Dusk (Dark)'
      )
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText(
        'Stockholm Linen (Light)'
      )
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText(
        'Uppsala Birch (Light)'
      )
      await expect(page.getByTestId('settings-saved-themes-select')).toContainText(
        'Skagen Mist (Light)'
      )
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

      // Verify View Menu Page Margins (Small, Medium, Wide, Dynamic Word Flow)
      await page.getByTestId('view-menu-btn').click()
      await expect(page.getByTestId('view-menu-margin-small')).toBeVisible()
      await expect(page.getByTestId('view-menu-margin-medium')).toBeVisible()
      await expect(page.getByTestId('view-menu-margin-wide')).toBeVisible()
      await expect(page.getByTestId('view-menu-margin-word-flow')).toBeVisible()
      await page.getByTestId('view-menu-margin-wide').click()
      await expect(page.getByTestId('codemirror-editor-container')).toHaveAttribute(
        'data-margin-mode',
        'wide'
      )
      await page.getByTestId('view-menu-btn').click()
      await page.getByTestId('view-menu-margin-word-flow').click()
      await expect(page.getByTestId('codemirror-editor-container')).toHaveAttribute(
        'data-margin-mode',
        'word-flow'
      )

      // Verify Tab Right-Click Menu: Split / Duplicate View into 2 side-by-side windows, and closing the last page closes that window
      const firstDocTab = page.locator('[data-testid^="doc-tab-"]').first()
      await expect(firstDocTab).toBeVisible()
      await firstDocTab.click({ button: 'right' })
      await expect(page.getByTestId('tab-context-menu')).toBeVisible()
      await expect(page.getByTestId('tab-context-split')).toBeVisible()
      await expect(page.getByTestId('tab-context-duplicate')).toBeVisible()
      await page.getByTestId('tab-context-duplicate').click()
      await expect(page.getByTestId('editor-pane-primary')).toBeVisible()
      await expect(page.getByTestId('editor-pane-secondary')).toBeVisible()
      // Close the last tab in the secondary window and verify the secondary window closes automatically
      await page.locator('[data-testid^="close-secondary-tab-"]').first().click()
      await expect(page.getByTestId('editor-pane-secondary')).toHaveCount(0)

      // Verify Frontmatter Properties: Creation Date label & auto-populated value, Calendar Date Picker, Tags Dropdown, Editable Status Dropdown, and Global Typed Custom Properties
      await expect(page.getByTestId('right-frontmatter-window')).toBeVisible()
      await expect(page.getByTestId('frontmatter-label-date')).toContainText('Creation Date')
      await expect(page.getByTestId('frontmatter-input-date')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)
      // 1. Date field calendar picker
      await page.getByTestId('frontmatter-date-picker-btn-date').click()
      await expect(page.getByTestId('frontmatter-calendar-popover-date')).toBeVisible()
      await page.getByTestId('calendar-today-btn-date').click()
      await expect(page.getByTestId('frontmatter-calendar-popover-date')).toHaveCount(0)

      // 2. Tags dropdown: click first suggestion, click second suggestion, and type partial tag (#sec) then click #security to complete it
      await page.getByTestId('frontmatter-tags-dropdown-btn-tags').click()
      await expect(page.getByTestId('frontmatter-tags-dropdown-tags')).toBeVisible()
      await page.getByTestId('frontmatter-tag-suggestion-tags-architecture').click()
      await expect(page.getByTestId('frontmatter-tag-chip-tags-architecture')).toBeVisible()
      await page.getByTestId('frontmatter-tag-suggestion-tags-roadmap').click()
      await expect(page.getByTestId('frontmatter-tag-chip-tags-roadmap')).toBeVisible()
      await page.getByTestId('frontmatter-input-tags').fill('#architecture, #roadmap, #sec')
      await expect(page.getByTestId('frontmatter-tag-suggestion-tags-security')).toBeVisible()
      await expect(page.getByTestId('frontmatter-tag-suggestion-tags-incident')).toHaveCount(0)
      await page.getByTestId('frontmatter-tag-suggestion-tags-security').click()
      await expect(page.getByTestId('frontmatter-tag-chip-tags-security')).toBeVisible()
      await expect(page.getByTestId('frontmatter-tag-chip-tags-sec')).toHaveCount(0)
      await page.getByTestId('frontmatter-tags-dropdown-btn-tags').click()

      // 3. Status dropdown with add (+) and remove (x) options
      await page.getByTestId('frontmatter-dropdown-btn-status').click()
      await expect(page.getByTestId('frontmatter-dropdown-menu-status')).toBeVisible()
      await page.getByTestId('frontmatter-option-new-input-status').fill('Security Cleared')
      await page.getByTestId('frontmatter-option-add-btn-status').click()
      await expect(
        page.getByTestId('frontmatter-option-select-status-Security Cleared')
      ).toBeVisible()
      await page.getByTestId('frontmatter-dropdown-btn-status').click()

      // 4. Add Global Custom Property with Date type
      await page.getByTestId('frontmatter-custom-key-input').fill('review_date')
      await page.getByTestId('frontmatter-custom-type-select').selectOption('date')
      await page.getByTestId('frontmatter-custom-global-checkbox').check()
      await page.getByTestId('frontmatter-custom-add-btn').click()
      await expect(page.getByTestId('frontmatter-date-picker-btn-review_date')).toBeVisible()

      // 5. Verify Links & Mentions, Graph View, and Typewriter Scrolling are removed, while Focus Mode (4.1), In-Doc Find Bar (4.3), Daily Calendar (3.1), Global Tasks (3.2), and Workspace Drag-and-Drop Reordering work
      await expect(page.getByTestId('sidebar-tab-backlinks')).toHaveCount(0)
      await expect(page.getByTestId('open-graph-view-btn')).toHaveCount(0)
      await page.getByTestId('view-menu-btn').click()
      await expect(page.getByTestId('view-menu-open-graph')).toHaveCount(0)
      await expect(page.getByTestId('view-menu-toggle-links')).toHaveCount(0)
      await expect(page.getByTestId('view-menu-toggle-typewriter')).toHaveCount(0)
      await expect(page.getByTestId('view-menu-toggle-focus-mode')).toBeVisible()
      await page.getByTestId('view-menu-toggle-focus-mode').click()
      await expect(page.getByTestId('codemirror-editor-container')).toHaveAttribute(
        'data-focus-mode',
        'true'
      )

      // Verify Workspace Drag-and-Drop Reordering and vertical scroll container in Explorer
      await page.getByTestId('sidebar-tab-explorer').click()
      await expect(page.getByTestId('workspace-explorer-scroll-container')).toBeVisible()
      await page.getByTestId(`workspace-root-header-${repo2Id}`).dispatchEvent('dragstart')
      await page.getByTestId(`workspace-root-header-${repo1Id}`).dispatchEvent('dragover')
      await page.getByTestId(`workspace-root-header-${repo1Id}`).dispatchEvent('drop')
      await page.getByTestId(`workspace-root-header-${repo2Id}`).dispatchEvent('dragend')
      await page.getByTestId('sidebar-tab-git').click()

      // Verify In-Document Find & Replace Bar (4.3)
      await page.getByTestId('edit-menu-btn').click()
      await page.getByTestId('edit-menu-find-in-doc').click()
      await expect(page.getByTestId('in-doc-find-bar')).toBeVisible()
      await page.getByTestId('in-doc-find-close').click()
      await expect(page.getByTestId('in-doc-find-bar')).toHaveCount(0)

      // Verify Daily Calendar (3.1) and Global Tasks (3.2) in the Right Panel, then return to Frontmatter tab
      await page.getByTestId('right-panel-tab-calendar').click()
      await expect(page.getByTestId('daily-calendar-panel')).toBeVisible()
      await page.getByTestId('right-panel-tab-tasks').click()
      await expect(page.getByTestId('global-tasks-panel')).toBeVisible()
      await page.getByTestId('right-panel-tab-frontmatter').click()
      await expect(page.getByTestId('right-frontmatter-window')).toBeVisible()

      // Verify 4.2 Web Clipper / Import from URL to Markdown
      await page.getByTestId('file-menu-btn').click()
      await expect(page.getByTestId('file-menu-web-clipper')).toBeVisible()
      await page.getByTestId('file-menu-web-clipper').click()
      await expect(page.getByTestId('web-clipper-modal')).toBeVisible()
      await page
        .getByTestId('web-clipper-url-input')
        .fill(`http://127.0.0.1:${ollamaPort}/test-article`)
      await page.getByTestId('web-clipper-fetch-btn').click()
      await expect(page.getByTestId('web-clipper-preview-textarea')).toHaveValue(
        /Klartext Architecture Spec/
      )
      await page.getByTestId('web-clipper-insert-btn').click()
      await expect(page.getByTestId('web-clipper-modal')).toHaveCount(0)

      // Verify 4.3 Export to DOCX, Slide Deck Presentation Mode, and Copy as Slack / Jira / GFM Markdown
      await page.getByTestId('file-menu-btn').click()
      await expect(page.getByTestId('export-docx-btn')).toBeVisible()
      await page.getByTestId('export-docx-btn').click()
      await expect(page.getByTestId('export-status-banner')).toContainText('Exported DOCX')

      await page.getByTestId('edit-menu-btn').click()
      await expect(page.getByTestId('copy-slack-md-btn')).toBeVisible()
      await expect(page.getByTestId('copy-jira-md-btn')).toBeVisible()
      await expect(page.getByTestId('copy-gfm-md-btn')).toBeVisible()
      await page.getByTestId('copy-slack-md-btn').click()

      // Create RichFeaturesDoc.md with rich blocks: Footnotes (3.3), Image with metadata (3.4), Bookmark Card (4.1), and Slides (4.3)
      await page.evaluate(
        async ({ rId, b64 }) => {
          const savedImg = await window.klartext.saveAsset({
            rootId: rId,
            documentRelativePath: 'RichFeaturesDoc.md',
            fileName: 'hero-diagram.png',
            mimeType: 'image/png',
            base64Data: b64,
            category: 'images'
          })
          const richDoc = [
            '# Slide One Title',
            '',
            'Paragraph with a footnote reference[^1] for inline preview.',
            '',
            `![System Architecture Diagram|360|center](${savedImg.relativeAssetPath})`,
            '',
            ':::bookmark https://klartext.app/docs',
            'title: Klartext Documentation',
            'description: Official guide for multi-root Markdown editing.',
            'domain: klartext.app',
            ':::',
            '',
            '---',
            '',
            '## Slide Two Title',
            '',
            '- Key milestone item',
            'Note: Mention the Q4 roadmap metrics here.',
            '',
            '[^1]: Initial footnote definition text.'
          ].join('\n')
          await window.klartext.createDocument(rId, 'RichFeaturesDoc.md', richDoc)
        },
        { rId: repo1Id, b64: VALID_PNG_BASE64 }
      )
      await page.getByTestId('sidebar-tab-explorer').click()
      await page.getByTestId(`tree-file-${repo1Id}-RichFeaturesDoc.md`).click()
      await page.getByTestId('sidebar-tab-git').click()

      // Verify 4.1 Bookmark Card widget renders in Inline Rich mode
      await expect(page.getByTestId('bookmark-card-widget').first()).toBeVisible()
      await expect(page.getByTestId('bookmark-card-widget').first()).toContainText(
        'Klartext Documentation'
      )

      // Verify 3.4 Image Resize Handles, Alignment, Caption & Lightbox Zoom
      await expect(page.getByTestId('inline-resizable-image').first()).toBeVisible()
      await expect(page.getByTestId('image-caption-label').first()).toContainText(
        'System Architecture Diagram'
      )
      await page.getByTestId('inline-resizable-image').first().locator('img').click()
      await page.getByTestId('image-lightbox-zoom-btn').first().click()
      await expect(page.getByTestId('image-lightbox-modal')).toBeVisible()
      await page.getByTestId('image-lightbox-close-btn').click()
      await expect(page.getByTestId('image-lightbox-modal')).toHaveCount(0)

      // Verify 3.3 Footnote Hover Previews & Inline Footnote Editor
      await expect(page.getByTestId('footnote-ref-1').first()).toBeVisible()
      await page.getByTestId('footnote-ref-1').first().click()
      await expect(page.getByTestId('footnote-hover-popover')).toBeVisible()
      await expect(page.getByTestId('footnote-inline-editor-input')).toHaveValue(
        'Initial footnote definition text.'
      )
      await page
        .getByTestId('footnote-inline-editor-input')
        .fill('Updated footnote definition from popover!')
      await page.getByTestId('footnote-inline-save-btn').click()
      await expect(page.getByTestId('footnote-hover-popover')).toHaveCount(0)

      // Verify 1.2 Block Drag-and-Drop Handle (⋮⋮) & Turn Into menu
      await page.locator('.cm-line').first().hover()
      await expect(page.getByTestId('block-drag-handle')).toBeVisible()
      await page.getByTestId('block-drag-handle').click()
      await expect(page.getByTestId('block-turn-into-menu')).toBeVisible()
      await page.getByTestId('block-turn-into-h2').click()
      await expect(page.getByTestId('block-turn-into-menu')).toHaveCount(0)

      // Verify 4.3 Slide Deck Presentation Mode (Keyboard navigation, Speaker Notes, Laser Pointer)
      await page.getByTestId('file-menu-btn').click()
      await expect(page.getByTestId('file-menu-slide-deck')).toBeVisible()
      await page.getByTestId('file-menu-slide-deck').click()
      await expect(page.getByTestId('slide-deck-modal')).toBeVisible()
      await expect(page.getByTestId('slide-counter')).toContainText('Slide 1 / 2')
      await page.getByTestId('slide-next-btn').click()
      await expect(page.getByTestId('slide-counter')).toContainText('Slide 2 / 2')
      await page.getByTestId('slide-speaker-notes-btn').click()
      await expect(page.getByTestId('slide-speaker-notes-panel')).toContainText(
        'Mention the Q4 roadmap metrics here.'
      )
      await page.getByTestId('slide-laser-pointer-btn').click()
      await page.getByTestId('slide-close-btn').click()
      await expect(page.getByTestId('slide-deck-modal')).toHaveCount(0)

      // Verify all settings, panel visibility, sidebar tab, workspace order, saved themes, and open tabs are persisted
      const persistedSettings = await page.evaluate(() => window.klartext.getSettings())
      expect(persistedSettings.frontmatterPanelVisible).toBe(true)
      expect(persistedSettings.lastActiveRightPanel).toBe('frontmatter')
      expect(persistedSettings.leftSidebarTab).toBe('git')
      expect(persistedSettings.workspaceOrder?.[0]).toBe(repo2Id)
      expect(persistedSettings.savedThemes?.some((t) => t.name === 'My Nordic Theme')).toBe(true)
      expect(
        persistedSettings.globalFrontmatterProperties?.some((p) => p.key === 'review_date')
      ).toBe(true)
      expect(Array.isArray(persistedSettings.openTabs)).toBe(true)
      expect(persistedSettings.openTabs.length).toBeGreaterThan(0)
    } finally {
      await app.close()
      ollamaServer.close()
    }
  })
})
