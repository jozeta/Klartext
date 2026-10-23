import { z } from 'zod'
import { DEFAULT_NORDIC_SAVED_THEMES } from '../constants'

export const EditModeSchema = z.enum(['source', 'inline', 'split'])
export type EditMode = z.infer<typeof EditModeSchema>

export const ThemeModeSchema = z.enum(['light', 'dark', 'system'])
export type ThemeMode = z.infer<typeof ThemeModeSchema>

export const GitPullStrategySchema = z.enum(['rebase', 'merge'])
export type GitPullStrategy = z.infer<typeof GitPullStrategySchema>

export const GitAutoSyncModeSchema = z.enum([
  'manual',
  'auto-fetch',
  'auto-pull-clean',
  'auto-commit-sync'
])
export type GitAutoSyncMode = z.infer<typeof GitAutoSyncModeSchema>

export const GitSyncPolicySchema = z.object({
  autoFetch: z.boolean().default(true),
  fetchIntervalSec: z.number().int().min(15).max(86400).default(180),
  pullStrategy: GitPullStrategySchema.default('rebase'),
  autoSyncMode: GitAutoSyncModeSchema.default('auto-fetch')
})
export type GitSyncPolicy = z.infer<typeof GitSyncPolicySchema>

export const WorkspaceRootSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(200),
  path: z.string().min(1),
  assetDir: z.string().min(1).default('assets').refine((val) => !val.includes('..'), {
    message: 'assetDir must not contain path traversal segments'
  }),
  gitSyncPolicy: GitSyncPolicySchema.optional()
})
export type WorkspaceRoot = z.infer<typeof WorkspaceRootSchema>

export const WorkspaceManifestSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(200),
  roots: z.array(WorkspaceRootSchema),
  settings: z
    .object({
      defaultEditMode: EditModeSchema.default('inline'),
      theme: ThemeModeSchema.default('system')
    })
    .optional()
})
export type WorkspaceManifest = z.infer<typeof WorkspaceManifestSchema>

export const PerRootConfigSchema = z.object({
  assetDir: z
    .string()
    .min(1)
    .refine((val) => !val.includes('..'))
    .optional(),
  defaultEditMode: EditModeSchema.optional(),
  lintingEnabled: z.boolean().optional()
})
export type PerRootConfig = z.infer<typeof PerRootConfigSchema>

export const HeadingStyleOverrideSchema = z.object({
  fontFamily: z.string().optional(),
  fontSizeEm: z.number().min(0.8).max(4.0).optional(),
  color: z.string().optional()
})
export type HeadingStyleOverride = z.infer<typeof HeadingStyleOverrideSchema>

export const TypographySettingsSchema = z.object({
  bodyFontFamily: z.string().default('Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
  bodyColor: z.string().default(''),
  monoFontFamily: z.string().default('"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace'),
  codeFontSizePx: z.number().min(10).max(24).default(14),
  fontSizePx: z.number().min(12).max(24).default(16),
  lineHeight: z.number().min(1.3).max(2.0).default(1.65),
  maxLineWidthCh: z.number().min(60).max(200).default(82),
  fullWidth: z.boolean().default(false),
  typewriterScrolling: z.boolean().default(false),
  headings: z
    .object({
      h1: HeadingStyleOverrideSchema.default({ fontSizeEm: 1.85 }),
      h2: HeadingStyleOverrideSchema.default({ fontSizeEm: 1.45 }),
      h3: HeadingStyleOverrideSchema.default({ fontSizeEm: 1.2 }),
      h4: HeadingStyleOverrideSchema.default({ fontSizeEm: 1.08 }),
      h5: HeadingStyleOverrideSchema.default({ fontSizeEm: 1.0 }),
      h6: HeadingStyleOverrideSchema.default({ fontSizeEm: 0.92 })
    })
    .default({})
})
export type TypographySettings = z.infer<typeof TypographySettingsSchema>

export const AISettingsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['ollama', 'openai-compatible']).default('ollama'),
  endpoint: z.string().url().default('http://127.0.0.1:11434'),
  allowNonLoopback: z.boolean().default(false),
  activeModel: z.string().default('gemma4:12b'),
  fastModel: z.string().optional(),
  keepAlive: z.string().default('5m')
})
export type AISettings = z.infer<typeof AISettingsSchema>

export const CustomThemeColorsSchema = z.object({
  bgApp: z.string().optional(),
  bgPanel: z.string().optional(),
  bgEditor: z.string().optional(),
  textPrimary: z.string().optional()
})
export type CustomThemeColors = z.infer<typeof CustomThemeColorsSchema>

export const SavedThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  baseMode: ThemeModeSchema.default('dark'),
  highlightColor: z.string().default('#3B82F6'),
  customColors: CustomThemeColorsSchema.optional(),
  lightPaperInDarkMode: z.boolean().default(false),
  typography: TypographySettingsSchema.optional(),
  updatedAt: z.number().optional()
})
export type SavedTheme = z.infer<typeof SavedThemeSchema>

export const WorkspaceSortOrderSchema = z.enum(['name-asc', 'name-desc', 'custom'])
export type WorkspaceSortOrder = z.infer<typeof WorkspaceSortOrderSchema>

export const EditorMarginModeSchema = z.enum(['small', 'medium', 'wide', 'word-flow'])
export type EditorMarginMode = z.infer<typeof EditorMarginModeSchema>

export const CustomFrontmatterFilterRuleSchema = z.object({
  key: z.string(),
  valuePattern: z.string()
})
export type CustomFrontmatterFilterRule = z.infer<typeof CustomFrontmatterFilterRuleSchema>

export const DynamicFilterRuleSchema = z.object({
  tagsPattern: z.string().default(''),
  titlePattern: z.string().default(''),
  authorPattern: z.string().default(''),
  statusPattern: z.string().default(''),
  dateFrom: z.string().default(''),
  dateTo: z.string().default(''),
  customFrontmatterFilters: z.array(CustomFrontmatterFilterRuleSchema).default([])
})
export type DynamicFilterRule = z.infer<typeof DynamicFilterRuleSchema>

export const DynamicFolderDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
  rules: DynamicFilterRuleSchema.default({})
})
export type DynamicFolderDef = z.infer<typeof DynamicFolderDefSchema>

export const DynamicWorkspaceDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(['root-content', 'dynamic-folders']).default('dynamic-folders'),
  rootRules: DynamicFilterRuleSchema.default({}),
  folders: z.array(DynamicFolderDefSchema).default([])
})
export type DynamicWorkspaceDef = z.infer<typeof DynamicWorkspaceDefSchema>

export const DefaultFrontmatterPropertyDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(['text', 'date', 'dropdown', 'tags', 'number', 'checkbox']).default('text'),
  defaultValue: z.string().default(''),
  options: z.array(z.string()).default([])
})
export type DefaultFrontmatterPropertyDef = z.infer<typeof DefaultFrontmatterPropertyDefSchema>

export const DEFAULT_FRONTMATTER_PROPERTIES: DefaultFrontmatterPropertyDef[] = [
  {
    key: 'title',
    label: 'Title',
    type: 'text',
    defaultValue: '<% title %>',
    options: []
  },
  {
    key: 'author',
    label: 'Author',
    type: 'text',
    defaultValue: '',
    options: []
  },
  {
    key: 'date',
    label: 'Creation Date',
    type: 'date',
    defaultValue: '<% creation_date %>',
    options: []
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'tags',
    defaultValue: '',
    options: []
  },
  {
    key: 'status',
    label: 'Status',
    type: 'dropdown',
    defaultValue: 'Draft',
    options: ['Draft', 'In Progress', 'In Review', 'Approved', 'Published', 'Archived']
  }
]

export const UpdateCheckIntervalSchema = z.enum(['startup', 'daily', 'weekly', 'monthly'])
export type UpdateCheckInterval = z.infer<typeof UpdateCheckIntervalSchema>

export const AppSettingsSchema = z.object({
  theme: ThemeModeSchema.default('system'),
  accentColorOverride: z.string().optional(),
  highlightColor: z.string().optional(),
  customHighlightColors: z.array(z.string()).default([]),
  savedThemes: z.array(SavedThemeSchema).default(DEFAULT_NORDIC_SAVED_THEMES),
  activeSavedThemeId: z.string().nullable().default(null),
  customThemeColors: CustomThemeColorsSchema.optional(),
  dynamicWorkspaces: z.array(DynamicWorkspaceDefSchema).default([]),
  defaultEditMode: EditModeSchema.default('inline'),
  floatingToolbarEnabled: z.boolean().default(true),
  formattingToolbarVisible: z.boolean().default(false),
  frontmatterPanelVisible: z.boolean().default(false),
  showOutlineTab: z.boolean().default(true),
  showBacklinksTab: z.boolean().default(true),
  spellcheckEnabled: z.boolean().default(true),
  spellcheckLanguages: z.array(z.string()).default(['en-US', 'sv-SE']),
  customDictionaryWords: z.array(z.string()).default([]),
  showLineNumbers: z.boolean().default(false),
  wordWrap: z.boolean().default(true),
  editorMarginMode: EditorMarginModeSchema.default('medium'),
  focusMode: z.boolean().default(false),
  typewriterScrolling: z.boolean().default(false),
  lightPaperInDarkMode: z.boolean().default(false),
  autosaveDelayMs: z.number().min(200).max(60000).default(1000),
  allowRawHtml: z.boolean().default(false),
  autoUpdateCheck: z.boolean().default(true),
  updateCheckInterval: UpdateCheckIntervalSchema.default('weekly'),
  lastUpdateCheckAt: z.number().optional(),
  leftSidebarOpen: z.boolean().default(true),
  leftSidebarWidth: z.number().min(160).max(600).default(260),
  leftSidebarTab: z
    .enum(['explorer', 'search', 'outline', 'git'])
    .catch('explorer')
    .default('explorer'),
  frontmatterSidebarWidth: z.number().min(160).max(600).default(288),
  rightSidebarOpen: z.boolean().default(false),
  rightSidebarWidth: z.number().min(160).max(600).default(320),
  templatesPanelVisible: z.boolean().default(false),
  templatesSidebarWidth: z.number().min(180).max(600).default(300),
  helpPanelVisible: z.boolean().default(false),
  helpSidebarWidth: z.number().min(200).max(760).default(380),
  calendarPanelVisible: z.boolean().default(false),
  tasksPanelVisible: z.boolean().default(false),
  lastActiveRightPanel: z
    .enum(['frontmatter', 'ai', 'templates', 'help', 'calendar', 'tasks'])
    .default('frontmatter'),
  workspaceOrder: z.array(z.string()).default([]),
  workspaceSortOrder: WorkspaceSortOrderSchema.default('name-asc'),
  workspaceFoldersOnTop: z.boolean().default(true),
  workspaceCustomOrder: z.record(z.string(), z.array(z.string())).default({}),
  stickyItems: z.record(z.string(), z.boolean()).default({}),
  folderIcons: z.record(z.string(), z.string()).default({}),
  folderColors: z.record(z.string(), z.string()).default({}),
  collapsedDirs: z.record(z.string(), z.boolean()).default({}),
  collapsedRoots: z.record(z.string(), z.boolean()).default({}),
  selectedFolder: z
    .object({
      rootId: z.string(),
      relativePath: z.string()
    })
    .nullable()
    .default(null),
  customTemplates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        content: z.string(),
        updatedAt: z.number()
      })
    )
    .optional(),
  defaultFrontmatterProperties: z
    .array(DefaultFrontmatterPropertyDefSchema)
    .default(DEFAULT_FRONTMATTER_PROPERTIES),
  frontmatterStatusOptions: z
    .array(z.string())
    .default(['Draft', 'In Progress', 'In Review', 'Approved', 'Published', 'Archived']),
  frontmatterKnownTags: z
    .array(z.string())
    .default([
      '#meeting',
      '#notes',
      '#daily',
      '#rfc',
      '#security',
      '#architecture',
      '#incident',
      '#audit',
      '#todo',
      '#roadmap'
    ]),
  globalFrontmatterProperties: z
    .array(
      z.object({
        key: z.string(),
        type: z.enum(['text', 'date', 'dropdown', 'tags', 'number', 'checkbox']).default('text'),
        options: z.array(z.string()).default([])
      })
    )
    .default([]),
  localFrontmatterPropertyTypes: z
    .record(
      z.string(),
      z.object({
        key: z.string(),
        type: z.enum(['text', 'date', 'dropdown', 'tags', 'number', 'checkbox']).default('text'),
        options: z.array(z.string()).default([])
      })
    )
    .default({}),
  splitViewPercent: z.number().min(20).max(80).default(50),
  statusBarVisible: z.boolean().default(true),
  sidebarControlBarVisible: z.boolean().default(true),
  pageTabsPosition: z.enum(['editor', 'top-menu']).default('editor'),
  zenMode: z.boolean().default(false),
  openTabs: z
    .array(
      z.object({
        rootId: z.string(),
        relativePath: z.string()
      })
    )
    .default([]),
  activeTabKey: z.string().nullable().optional(),
  windowBounds: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().min(400).default(1360),
      height: z.number().min(300).default(860),
      isMaximized: z.boolean().default(false),
      isFullScreen: z.boolean().default(false)
    })
    .optional(),
  typography: TypographySettingsSchema.default({}),
  ai: AISettingsSchema.default({}),
  keybindings: z.record(z.string(), z.string()).default({})
})
export type FrontmatterFieldType = 'text' | 'date' | 'dropdown' | 'tags' | 'number' | 'checkbox'
export interface CustomFrontmatterPropertyDef {
  key: string
  label?: string
  defaultValue?: string
  type: FrontmatterFieldType
  options: string[]
}
export type AppSettings = z.infer<typeof AppSettingsSchema>

// IPC Request Schemas
export const RootScopedPathSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().min(1)
})

export const DocWriteRequestSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().min(1),
  content: z.string()
})

export const DocRenameRequestSchema = z.object({
  rootId: z.string().min(1),
  oldRelativePath: z.string().min(1),
  newRelativePath: z.string().min(1)
})

export const CrossRootMoveRequestSchema = z.object({
  sourceRootId: z.string().min(1),
  sourceRelativePath: z.string().min(1),
  targetRootId: z.string().min(1),
  targetRelativePath: z.string().min(1),
  migrateAssets: z.boolean().default(true)
})

export const AssetSaveRequestSchema = z.object({
  rootId: z.string().min(1),
  documentRelativePath: z.string().default(''),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64Data: z.string().min(1),
  category: z.enum(['images', 'attachments', 'drawings']).default('images')
})

export const ExcalidrawSaveRequestSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().min(1),
  sceneJson: z.string().min(2),
  svgString: z.string().min(10)
})

export const SearchQueryRequestSchema = z.object({
  query: z.string().min(1),
  rootIds: z.array(z.string()).optional(),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(false),
  isRegex: z.boolean().default(false),
  includeGlob: z.string().optional(),
  excludeGlob: z.string().optional()
})

export const SearchReplaceRequestSchema = z.object({
  search: SearchQueryRequestSchema,
  replacement: z.string(),
  confirmedFiles: z.array(
    z.object({
      rootId: z.string().min(1),
      relativePath: z.string().min(1)
    })
  )
})

export const GitActionRequestSchema = z.object({
  rootId: z.string().min(1),
  files: z.array(z.string()).optional(),
  message: z.string().optional(),
  branch: z.string().optional(),
  createBranch: z.boolean().optional(),
  strategy: GitPullStrategySchema.optional()
})

export const GitConflictResolveRequestSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().min(1),
  hunkIndex: z.number().int().min(0).optional(),
  resolution: z.enum(['current', 'incoming', 'both', 'custom']),
  customContent: z.string().optional()
})

export const AIStreamRequestSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum([
    'draft',
    'improve',
    'grammar',
    'tone',
    'translate-sv-en',
    'translate-en-sv',
    'translate-sv',
    'format-table',
    'format-list',
    'mermaid',
    'summarize',
    'custom'
  ]),
  prompt: z.string().default(''),
  selectedText: z.string().default(''),
  tone: z.enum(['technical', 'concise', 'executive', 'friendly']).optional(),
  modelOverride: z.string().optional()
})

export const AIRagQueryRequestSchema = z.object({
  question: z.string().min(1),
  rootIds: z.array(z.string()).optional(),
  modelOverride: z.string().optional()
})

export const ExportRequestSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().min(1),
  markdown: z.string(),
  title: z.string().default('Document'),
  inlineAssets: z.boolean().default(true),
  targetFilePath: z.string().optional()
})
