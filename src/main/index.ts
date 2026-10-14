import fs from 'fs'
import path from 'path'
import { app, BrowserWindow, Menu, protocol, safeStorage, shell } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
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
import { seedShowcaseDirectory } from '../shared/showcase/seed-showcase'

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
  const starterDir = path.join(userDataDir, 'Starter-Workspace')
  seedShowcaseDirectory(starterDir, false)

  if (registry.getState().roots.length > 0) return

  registry.addRoot({
    id: 'root-starter',
    name: 'Starter Notes',
    path: starterDir,
    assetDir: 'assets'
  })
}

function createWindow(
  preloadPath: string,
  settingsService: SettingsAndCredentialService
): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const savedBounds = settingsService.getSettings().windowBounds

  const win = new BrowserWindow({
    ...(typeof savedBounds?.x === 'number' && typeof savedBounds?.y === 'number'
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
    width: savedBounds?.width && savedBounds.width >= 760 ? savedBounds.width : 1360,
    height: savedBounds?.height && savedBounds.height >= 500 ? savedBounds.height : 860,
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

  if (savedBounds?.isMaximized) {
    win.maximize()
  }
  if (savedBounds?.isFullScreen) {
    win.setFullScreen(true)
  }

  let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null
  const persistWindowBoundsNow = () => {
    if (win.isDestroyed()) return
    try {
      const isMaximized = win.isMaximized()
      const isFullScreen = win.isFullScreen()
      const normalBounds =
        isMaximized || isFullScreen ? win.getNormalBounds() : win.getBounds()
      settingsService.updateSettings({
        windowBounds: {
          x: normalBounds.x,
          y: normalBounds.y,
          width: Math.max(760, normalBounds.width),
          height: Math.max(500, normalBounds.height),
          isMaximized,
          isFullScreen
        }
      })
    } catch {
      // Ignore if window state is unavailable during shutdown
    }
  }

  const schedulePersistWindowBounds = () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
    saveBoundsTimer = setTimeout(persistWindowBoundsNow, 120)
  }

  win.on('resize', schedulePersistWindowBounds)
  win.on('move', schedulePersistWindowBounds)
  win.on('maximize', schedulePersistWindowBounds)
  win.on('unmaximize', schedulePersistWindowBounds)
  win.on('enter-full-screen', schedulePersistWindowBounds)
  win.on('leave-full-screen', schedulePersistWindowBounds)
  win.on('close', () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
    persistWindowBoundsNow()
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
  if (process.env.KLARTEXT_SEED_STARTER === '1') {
    createDefaultStarterWorkspace(registry, userDataDir)
  }

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
      const rawRootId = decodeURIComponent(parsed.hostname)
      const matchedRoot = registry
        .getState()
        .roots.find((r) => r.id.toLowerCase() === rawRootId.toLowerCase())
      const rootId = matchedRoot ? matchedRoot.id : rawRootId
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
                  : ext === '.pdf'
                    ? 'application/pdf'
                    : 'application/octet-stream'

      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'no-cache'
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
  mainWindow = createWindow(preloadPath, settingsService)

  const sendMenuAction = (action: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_MENU_ACTION, action)
    }
  }

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-folder')
        },
        { type: 'separator' },
        {
          label: 'Export to Standalone HTML...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendMenuAction('export-html')
        },
        {
          label: 'Export to PDF...',
          accelerator: 'CmdOrCtrl+Alt+E',
          click: () => sendMenuAction('export-pdf')
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendMenuAction('redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Switch Light / Dark Mode',
          click: () => sendMenuAction('toggle-theme')
        },
        {
          label: 'Toggle Formatting Toolbar Row',
          click: () => sendMenuAction('toggle-toolbar')
        },
        {
          label: 'Toggle Bottom Status Row',
          click: () => sendMenuAction('toggle-status-bar')
        },
        {
          label: 'Toggle Right Frontmatter Window',
          click: () => sendMenuAction('toggle-frontmatter')
        },
        {
          label: 'Toggle Spellcheck Underlines',
          click: () => sendMenuAction('toggle-spellcheck')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(preloadPath, settingsService)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
