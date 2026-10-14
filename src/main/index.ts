import fs from 'fs'
import path from 'path'
import { app, BrowserWindow, protocol, safeStorage, shell } from 'electron'
import { MultiRootRegistry } from './workspace/multi-root-registry'
import { AssetAndDocumentService } from './assets/asset-service'
import { RecoveryService } from './recovery/recovery-service'
import { MultiRootWatcher } from './watcher/multi-root-watcher'
import { MultiRootSearchService } from './search/search-service'
import { MultiRepoManager } from './git/multi-repo-manager'
import { LocalAIOrchestrator } from './ai/orchestrator'
import { SettingsAndCredentialService } from './settings/settings-service'
import { ExportService } from './export/export-service'
import { registerAllIpcHandlers } from './ipc/handlers'

// Register custom scheme privileges before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'klartext-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function createDefaultStarterWorkspace(registry: MultiRootRegistry, userDataDir: string): void {
  if (registry.getState().roots.length > 0) return

  const starterDir = path.join(userDataDir, 'Starter-Workspace')
  fs.mkdirSync(path.join(starterDir, 'assets', 'images'), { recursive: true })
  fs.mkdirSync(path.join(starterDir, 'assets', 'drawings'), { recursive: true })

  const welcomeFile = path.join(starterDir, 'Welcome.md')
  if (!fs.existsSync(welcomeFile)) {
    const starterContent = `---
title: Welcome to Klartext
author: Technical Nordic Workspace
tags:
  - local-first
  - markdown
  - multi-root
---

# Welcome to Klartext

Klartext is a fast, local-first Markdown editor with **Multi-Root Workspaces**, **Concurrent Multi-Repository Git**, **Excalidraw & Mermaid diagrams**, and **Optional Local AI** (English & Svenska).

> [!TIP] Progressive Complexity
> Press \`Cmd/Ctrl + K\` to open the Command Palette, \`Cmd/Ctrl + P\` for Quick File Switcher, or \`Cmd/Ctrl + Shift + F\` for Zen Mode.

## Supported Markdown Features

| Capability | Engine | Status |
| :--- | :--- | :--- |
| Live Inline Rich Editing | CodeMirror 6 Decorations | Active |
| Mathematical Expressions | KaTeX ($E = mc^2$) | Active |
| Interactive Diagrams | Mermaid + \`.excalidraw.svg\` | Active |

- [x] Single-root & Multi-root workspaces
- [x] Per-root portable assets (\`assets/\`)
- [x] Multi-repository Git sync & conflict resolution

\`\`\`mermaid
flowchart LR
    A["Multi-Root Workspace"] --> B["CodeMirror 6 Live Preview"]
    B --> C["Multi-Repo Git Sync"]
    B --> D["Local AI (SV / EN)"]
\`\`\`
`
    fs.writeFileSync(welcomeFile, starterContent, 'utf-8')
  }

  registry.addRoot({
    id: 'root-starter',
    name: 'Starter Notes',
    path: starterDir,
    assetDir: 'assets'
  })
}

function createWindow(preloadPath: string): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 760,
    minHeight: 500,
    title: 'Klartext',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 12, y: 10 } }
      : {
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#687580',
            height: 36
          }
        }),
    backgroundColor: '#F5F6F7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  // Block arbitrary navigation and open validated external links in system browser
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = win.webContents.getURL()
    if (navigationUrl !== currentUrl) {
      event.preventDefault()
      try {
        const parsed = new URL(navigationUrl)
        if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
          shell.openExternal(navigationUrl)
        }
      } catch {
        // Ignore invalid URL
      }
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        shell.openExternal(url)
      }
    } catch {
      // Ignore
    }
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  const userDataDir = process.env.KLARTEXT_USER_DATA_DIR || app.getPath('userData')
  const registry = new MultiRootRegistry(userDataDir)
  createDefaultStarterWorkspace(registry, userDataDir)

  const assetService = new AssetAndDocumentService(registry)
  const recoveryService = new RecoveryService(userDataDir)
  const watcher = new MultiRootWatcher()
  const searchService = new MultiRootSearchService(registry)
  const gitManager = new MultiRepoManager(registry, recoveryService)
  const settingsService = new SettingsAndCredentialService(userDataDir, safeStorage)
  const aiOrchestrator = new LocalAIOrchestrator(() => settingsService.getSettings(), searchService)
  const exportService = new ExportService(registry)

  // Register secure klartext-asset://<rootId>/<relativePath> protocol handler
  protocol.handle('klartext-asset', async (request) => {
    try {
      const parsed = new URL(request.url)
      const rootId = decodeURIComponent(parsed.hostname)
      const relPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
      const absPath = registry.pathGuard.resolveScopedPath(rootId, relPath)
      const data = await fs.promises.readFile(absPath)
      const ext = path.extname(absPath).toLowerCase()
      const mime =
        ext === '.svg'
          ? 'image/svg+xml'
          : ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.gif'
                ? 'image/gif'
                : ext === '.webp'
                  ? 'image/webp'
                  : 'application/octet-stream'

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
        }
      })
    } catch {
      return new Response('Forbidden or Not Found', { status: 403 })
    }
  })

  registerAllIpcHandlers(
    {
      registry,
      assetService,
      recoveryService,
      watcher,
      searchService,
      gitManager,
      aiOrchestrator,
      settingsService,
      exportService
    },
    () => mainWindow
  )

  const preloadPath = path.join(__dirname, '../preload/index.js')
  mainWindow = createWindow(preloadPath)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(preloadPath)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
