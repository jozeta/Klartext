export const IPC_CHANNELS = {
  // Workspace & Multi-Root
  WORKSPACE_GET_STATE: 'workspace:get-state',
  WORKSPACE_ADD_ROOT: 'workspace:add-root',
  WORKSPACE_OPEN_DIALOG: 'workspace:open-dialog',
  WORKSPACE_REMOVE_ROOT: 'workspace:remove-root',
  WORKSPACE_REORDER_ROOTS: 'workspace:reorder-roots',
  WORKSPACE_RENAME_ROOT: 'workspace:rename-root',
  WORKSPACE_SAVE_MANIFEST: 'workspace:save-manifest',
  WORKSPACE_LOAD_MANIFEST: 'workspace:load-manifest',
  WORKSPACE_LIST_FILES: 'workspace:list-files',
  WORKSPACE_OPEN_IN_FINDER: 'workspace:open-in-finder',

  // Documents & File Operations
  DOC_READ: 'doc:read',
  DOC_WRITE: 'doc:write',
  DOC_CREATE: 'doc:create',
  DOC_CREATE_DIR: 'doc:create-dir',
  DOC_DELETE: 'doc:delete',
  DOC_RENAME: 'doc:rename',
  DOC_MOVE_CROSS_ROOT: 'doc:move-cross-root',
  DOC_CHECK_CROSS_ROOT_ASSETS: 'doc:check-cross-root-assets',
  SYSTEM_GET_ENV_INFO: 'system:get-env-info',
  TEMPLATE_EVALUATE_POWER: 'template:evaluate-power',

  // Assets & Diagrams
  ASSET_SAVE: 'asset:save',
  ASSET_RESOLVE_URL: 'asset:resolve-url',
  ASSET_LIST_ORPHANS: 'asset:list-orphans',
  EXCALIDRAW_SAVE_SVG: 'excalidraw:save-svg',
  EXCALIDRAW_LOAD_SVG: 'excalidraw:load-svg',

  // Crash Recovery
  RECOVERY_SAVE_SNAPSHOT: 'recovery:save-snapshot',
  RECOVERY_LIST_SNAPSHOTS: 'recovery:list-snapshots',
  RECOVERY_CLEAR_SNAPSHOT: 'recovery:clear-snapshot',

  // Multi-Root Search & Backlinks
  SEARCH_QUERY: 'search:query',
  SEARCH_REPLACE: 'search:replace',
  SEARCH_BACKLINKS: 'search:backlinks',

  // Multi-Repo Git & Conflict Resolution
  GIT_GET_ALL_STATUS: 'git:get-all-status',
  GIT_GET_REPO_STATUS: 'git:get-repo-status',
  GIT_INIT: 'git:init',
  GIT_CLONE: 'git:clone',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_DIFF: 'git:diff',
  GIT_COMMIT: 'git:commit',
  GIT_FETCH: 'git:fetch',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_SYNC_ALL: 'git:sync-all',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_LOG: 'git:log',
  GIT_RESOLVE_CONFLICT: 'git:resolve-conflict',
  GIT_ABORT_MERGE: 'git:abort-merge',

  // Credentials & Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  CREDS_SET: 'creds:set',
  CREDS_HAS: 'creds:has',
  CREDS_DELETE: 'creds:delete',

  // Local AI & Hardware Advisor
  AI_GET_HARDWARE_ADVICE: 'ai:get-hardware-advice',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_LIST_MODELS: 'ai:list-models',
  AI_PULL_MODEL: 'ai:pull-model',
  AI_STREAM_START: 'ai:stream-start',
  AI_STREAM_CANCEL: 'ai:stream-cancel',
  AI_RAG_QUERY: 'ai:rag-query',

  // Export
  EXPORT_HTML: 'export:html',
  EXPORT_PDF: 'export:pdf',

  // Window & Shell
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Events pushed from Main -> Renderer
  EVENT_WATCHER_CHANGE: 'event:watcher-change',
  EVENT_AI_STREAM_CHUNK: 'event:ai-stream-chunk',
  EVENT_GIT_STATUS_CHANGED: 'event:git-status-changed',
  EVENT_MENU_ACTION: 'event:menu-action'
} as const

export const PRESET_HIGHLIGHT_COLORS: Array<{
  id: string
  name: string
  label: string
  hex: string
}> = [
  { id: 'electric-blue', name: 'Electric Blue', label: 'Electric Blue', hex: '#3B82F6' },
  { id: 'cyber-cyan', name: 'Cyber Cyan', label: 'Cyber Cyan', hex: '#06B6D4' },
  { id: 'nordic-teal', name: 'Nordic Teal', label: 'Nordic Teal', hex: '#14B8A6' },
  { id: 'emerald-mint', name: 'Emerald Mint', label: 'Emerald Mint', hex: '#10B981' },
  { id: 'lime-neon', name: 'Lime Neon', label: 'Lime Neon', hex: '#84CC16' },
  { id: 'amber-gold', name: 'Amber Gold', label: 'Amber Gold', hex: '#F59E0B' },
  { id: 'sunset-orange', name: 'Sunset Orange', label: 'Sunset Orange', hex: '#F97316' },
  { id: 'coral-red', name: 'Coral Red', label: 'Coral Red', hex: '#EF4444' },
  { id: 'hot-rose', name: 'Hot Rose', label: 'Hot Rose', hex: '#F43F5E' },
  { id: 'vivid-pink', name: 'Vivid Pink', label: 'Vivid Pink', hex: '#EC4899' },
  { id: 'neon-purple', name: 'Neon Purple', label: 'Neon Purple', hex: '#A855F7' },
  { id: 'electric-indigo', name: 'Electric Indigo', label: 'Electric Indigo', hex: '#6366F1' }
]

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  'commandPalette.toggle': 'Mod+K',
  'quickSwitcher.toggle': 'Mod+P',
  'iconPicker.toggle': 'Mod+Shift+I',
  'zenMode.toggle': 'Mod+Shift+F',
  'search.inFile': 'Mod+F',
  'search.global': 'Mod+Shift+H',
  'ai.inlinePrompt': 'Mod+J',
  'sidebar.left.toggle': 'Mod+B',
  'sidebar.right.toggle': 'Mod+Alt+B',
  'statusBar.toggle': 'Mod+/',
  'editor.mode.source': 'Mod+1',
  'editor.mode.inline': 'Mod+2',
  'editor.mode.split': 'Mod+3',
  'file.save': 'Mod+S',
  'file.new': 'Mod+N',
  'format.bold': 'Mod+B',
  'format.italic': 'Mod+I'
}

export const DEFAULT_NORDIC_SAVED_THEMES = [
  {
    id: 'nordic-dark-abisko',
    name: 'Abisko Midnight (Dark)',
    baseMode: 'dark' as const,
    highlightColor: '#5E81AC',
    lightPaperInDarkMode: false,
    customColors: {
      bgApp: '#11161D',
      bgPanel: '#161C24',
      bgEditor: '#131920',
      textPrimary: '#D8DEE9'
    },
    typography: {
      bodyFontFamily: '"Avenir Next", Avenir, "Nunito Sans", -apple-system, sans-serif',
      bodyColor: '#D8DEE9',
      monoFontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace',
      codeFontSizePx: 14,
      fontSizePx: 16,
      lineHeight: 1.65,
      maxLineWidthCh: 82,
      fullWidth: false,
      typewriterScrolling: false,
      headings: {
        h1: { fontFamily: 'Optima, "Avenir Next", sans-serif', color: '#88C0D0', fontSizeEm: 1.85 },
        h2: { fontFamily: 'Optima, "Avenir Next", sans-serif', color: '#81A1C1', fontSizeEm: 1.45 },
        h3: { color: '#8FBCBB', fontSizeEm: 1.2 },
        h4: { fontSizeEm: 1.08 },
        h5: { fontSizeEm: 1.0 },
        h6: { fontSizeEm: 0.92 }
      }
    },
    updatedAt: 1792258200001
  },
  {
    id: 'nordic-dark-sarek',
    name: 'Sarek Granite (Dark)',
    baseMode: 'dark' as const,
    highlightColor: '#7C9A82',
    lightPaperInDarkMode: false,
    customColors: {
      bgApp: '#141716',
      bgPanel: '#191D1B',
      bgEditor: '#161A18',
      textPrimary: '#DCE2DE'
    },
    typography: {
      bodyFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      bodyColor: '#DCE2DE',
      monoFontFamily: '"IBM Plex Mono", "JetBrains Mono", Menlo, monospace',
      codeFontSizePx: 14,
      fontSizePx: 16,
      lineHeight: 1.65,
      maxLineWidthCh: 82,
      fullWidth: false,
      typewriterScrolling: false,
      headings: {
        h1: { fontFamily: 'Baskerville, Georgia, serif', color: '#A3BE8C', fontSizeEm: 1.9 },
        h2: { fontFamily: 'Baskerville, Georgia, serif', color: '#8FA895', fontSizeEm: 1.45 },
        h3: { color: '#B5C4B9', fontSizeEm: 1.2 },
        h4: { fontSizeEm: 1.08 },
        h5: { fontSizeEm: 1.0 },
        h6: { fontSizeEm: 0.92 }
      }
    },
    updatedAt: 1792258200002
  },
  {
    id: 'nordic-dark-gotland',
    name: 'Gotland Dusk (Dark)',
    baseMode: 'dark' as const,
    highlightColor: '#B48EAD',
    lightPaperInDarkMode: false,
    customColors: {
      bgApp: '#16151A',
      bgPanel: '#1C1B22',
      bgEditor: '#18171D',
      textPrimary: '#E2DFEA'
    },
    typography: {
      bodyFontFamily: 'Charter, "Bitstream Charter", Georgia, serif',
      bodyColor: '#E2DFEA',
      monoFontFamily: '"Fira Code", "JetBrains Mono", Monaco, monospace',
      codeFontSizePx: 14,
      fontSizePx: 16,
      lineHeight: 1.7,
      maxLineWidthCh: 80,
      fullWidth: false,
      typewriterScrolling: false,
      headings: {
        h1: { fontFamily: 'Palatino, "Palatino Linotype", Georgia, serif', color: '#D0B8CE', fontSizeEm: 1.85 },
        h2: { fontFamily: 'Palatino, "Palatino Linotype", Georgia, serif', color: '#B48EAD', fontSizeEm: 1.45 },
        h3: { color: '#9E95B0', fontSizeEm: 1.2 },
        h4: { fontSizeEm: 1.08 },
        h5: { fontSizeEm: 1.0 },
        h6: { fontSizeEm: 0.92 }
      }
    },
    updatedAt: 1792258200003
  },
  {
    id: 'nordic-light-stockholm',
    name: 'Stockholm Linen (Light)',
    baseMode: 'light' as const,
    highlightColor: '#3B6E8C',
    lightPaperInDarkMode: false,
    customColors: {
      bgApp: '#F4F1EA',
      bgPanel: '#EBE7DF',
      bgEditor: '#FAF8F5',
      textPrimary: '#23282E'
    },
    typography: {
      bodyFontFamily: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      bodyColor: '#23282E',
      monoFontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace',
      codeFontSizePx: 14,
      fontSizePx: 16,
      lineHeight: 1.7,
      maxLineWidthCh: 80,
      fullWidth: false,
      typewriterScrolling: false,
      headings: {
        h1: { fontFamily: 'Optima, "Avenir Next", sans-serif', color: '#1F3A4D', fontSizeEm: 1.85 },
        h2: { fontFamily: 'Optima, "Avenir Next", sans-serif', color: '#2C5168', fontSizeEm: 1.45 },
        h3: { color: '#3B6E8C', fontSizeEm: 1.2 },
        h4: { fontSizeEm: 1.08 },
        h5: { fontSizeEm: 1.0 },
        h6: { fontSizeEm: 0.92 }
      }
    },
    updatedAt: 1792258200004
  },
  {
    id: 'nordic-light-uppsala',
    name: 'Uppsala Birch (Light)',
    baseMode: 'light' as const,
    highlightColor: '#4A6B5D',
    lightPaperInDarkMode: false,
    customColors: {
      bgApp: '#F2F4F2',
      bgPanel: '#E6EAE6',
      bgEditor: '#F9FBF9',
      textPrimary: '#1E2622'
    },
    typography: {
      bodyFontFamily: '"Avenir Next", Avenir, "Nunito Sans", -apple-system, sans-serif',
      bodyColor: '#1E2622',
      monoFontFamily: '"IBM Plex Mono", "JetBrains Mono", Menlo, monospace',
      codeFontSizePx: 14,
      fontSizePx: 16,
      lineHeight: 1.65,
      maxLineWidthCh: 82,
      fullWidth: false,
      typewriterScrolling: false,
      headings: {
        h1: { fontFamily: '"Gill Sans", "Avenir Next", sans-serif', color: '#294237', fontSizeEm: 1.85 },
        h2: { fontFamily: '"Gill Sans", "Avenir Next", sans-serif', color: '#3A594B', fontSizeEm: 1.45 },
        h3: { color: '#4A6B5D', fontSizeEm: 1.2 },
        h4: { fontSizeEm: 1.08 },
        h5: { fontSizeEm: 1.0 },
        h6: { fontSizeEm: 0.92 }
      }
    },
    updatedAt: 1792258200005
  },
  {
    id: 'nordic-light-skagen',
    name: 'Skagen Mist (Light)',
    baseMode: 'light' as const,
    highlightColor: '#8C5A3C',
    lightPaperInDarkMode: false,
    customColors: {
      bgApp: '#F3F4F6',
      bgPanel: '#E8ECEF',
      bgEditor: '#FFFFFF',
      textPrimary: '#1F242B'
    },
    typography: {
      bodyFontFamily: 'Baskerville, Georgia, serif',
      bodyColor: '#1F242B',
      monoFontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
      codeFontSizePx: 14,
      fontSizePx: 16,
      lineHeight: 1.68,
      maxLineWidthCh: 80,
      fullWidth: false,
      typewriterScrolling: false,
      headings: {
        h1: { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', color: '#2A3441', fontSizeEm: 1.85 },
        h2: { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', color: '#5A4638', fontSizeEm: 1.45 },
        h3: { color: '#8C5A3C', fontSizeEm: 1.2 },
        h4: { fontSizeEm: 1.08 },
        h5: { fontSizeEm: 1.0 },
        h6: { fontSizeEm: 0.92 }
      }
    },
    updatedAt: 1792258200006
  }
]

