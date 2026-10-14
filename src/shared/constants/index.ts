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

  // Documents & File Operations
  DOC_READ: 'doc:read',
  DOC_WRITE: 'doc:write',
  DOC_CREATE: 'doc:create',
  DOC_DELETE: 'doc:delete',
  DOC_RENAME: 'doc:rename',
  DOC_MOVE_CROSS_ROOT: 'doc:move-cross-root',
  DOC_CHECK_CROSS_ROOT_ASSETS: 'doc:check-cross-root-assets',

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
  EVENT_GIT_STATUS_CHANGED: 'event:git-status-changed'
} as const

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  'commandPalette.toggle': 'Mod+K',
  'quickSwitcher.toggle': 'Mod+P',
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
