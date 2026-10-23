import React, { useState } from 'react'
import {
  Command,
  FileText,
  X,
  Smile,
  Palette,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  Check,
  Sparkles,
  Folder
} from '../icons/untitled-icons'
import { searchUntitledIcons } from '../icons/untitled-icons'
import { PRESET_HIGHLIGHT_COLORS } from '../../../shared/constants'
import { DEFAULT_FRONTMATTER_PROPERTIES } from '../../../shared/schemas'
import { evaluateTemplateVariables } from '../../../shared/templates/template-engine'
import type {
  AppSettings,
  DefaultFrontmatterPropertyDef,
  FrontmatterFieldType,
  SavedTheme,
  WorkspaceRoot
} from '../../../shared/types'
import {
  SPELL_LANGUAGE_LABELS,
  type SupportedSpellLanguage
} from '../../features/editor/spellcheck-extension'

export interface CommandActionItem {
  id: string
  label: string
  category: string
  shortcut?: string
  run: () => void
}

const FONT_FAMILY_OPTIONS = [
  {
    label: 'Technical Nordic Sans (Inter / System)',
    value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  {
    label: 'Arctic Geometric Sans (Avenir Next / Nunito Sans)',
    value: '"Avenir Next", Avenir, "Nunito Sans", -apple-system, sans-serif'
  },
  {
    label: 'Scandinavian Grotesque (Helvetica Neue)',
    value: '"Helvetica Neue", Helvetica, Arial, sans-serif'
  },
  {
    label: 'Nordic Display Humanist (Optima / Avenir)',
    value: 'Optima, "Avenir Next", sans-serif'
  },
  {
    label: 'Nordic Classic Sans (Gill Sans / Avenir)',
    value: '"Gill Sans", "Avenir Next", sans-serif'
  },
  {
    label: 'Editorial Serif (Charter / Georgia)',
    value: 'Charter, "Bitstream Charter", Georgia, serif'
  },
  {
    label: 'Classic Book Serif (Palatino / Book Antiqua)',
    value: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'
  },
  {
    label: 'Sober Literary Serif (Baskerville / Georgia)',
    value: 'Baskerville, Georgia, serif'
  },
  {
    label: 'Humanist Sans (Avenir / Segoe UI)',
    value: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
  },
  {
    label: 'Monospace (JetBrains Mono / SF Mono)',
    value: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace'
  }
]

const CODE_FONT_OPTIONS = [
  {
    label: 'JetBrains Mono / Fira Code / SF Mono',
    value: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace'
  },
  {
    label: 'SF Mono / Menlo / Monaco',
    value: '"SF Mono", Menlo, Monaco, Consolas, monospace'
  },
  {
    label: 'IBM Plex Mono / JetBrains Mono',
    value: '"IBM Plex Mono", "JetBrains Mono", Menlo, monospace'
  },
  {
    label: 'Fira Code / JetBrains Mono',
    value: '"Fira Code", "JetBrains Mono", Monaco, monospace'
  },
  {
    label: 'Menlo / Monaco / Consolas',
    value: 'Menlo, Monaco, Consolas, "Courier New", monospace'
  },
  {
    label: 'System UI Monospace',
    value: 'ui-monospace, SFMono-Regular, monospace'
  }
]

export const CommandPaletteModal: React.FC<{
  mode: 'commands' | 'files' | 'icons'
  actions: CommandActionItem[]
  files: Array<{ rootId: string; rootName: string; relativePath: string }>
  onSelectFile: (rootId: string, relativePath: string) => void
  onSelectIcon?: (iconSyntax: string) => void
  onClose: () => void
}> = ({ mode, actions, files, onSelectFile, onSelectIcon, onClose }) => {
  const [query, setQuery] = useState('')

  const lower = query.toLowerCase().trim()
  const filteredActions = actions.filter(
    (a) =>
      !lower ||
      a.label.toLowerCase().includes(lower) ||
      a.category.toLowerCase().includes(lower)
  )
  const filteredFiles = files.filter(
    (f) =>
      !lower ||
      f.relativePath.toLowerCase().includes(lower) ||
      f.rootName.toLowerCase().includes(lower)
  )
  const filteredIcons = mode === 'icons' ? searchUntitledIcons(query, 96) : []

  const modalTestId =
    mode === 'commands'
      ? 'command-palette-modal'
      : mode === 'files'
        ? 'quick-switcher-modal'
        : 'icon-picker-modal'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20"
      data-testid={modalTestId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-panel border border-subtle rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary border-b border-subtle">
          {mode === 'icons' ? (
            <Smile className="w-4 h-4 text-accent" />
          ) : (
            <Command className="w-4 h-4 text-accent" />
          )}
          <input
            type="text"
            autoFocus
            data-testid="palette-search-input"
            placeholder={
              mode === 'commands'
                ? 'Type a command (e.g., Sync All Repositories, Insert Icon, Zen Mode, Theme)...'
                : mode === 'files'
                  ? 'Switch to file across any root folder...'
                  : 'Search Untitled UI Free Icons to insert (e.g., rocket, check, star, folder, code)...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter') {
                if (mode === 'commands' && filteredActions[0]) {
                  filteredActions[0].run()
                  onClose()
                } else if (mode === 'files' && filteredFiles[0]) {
                  onSelectFile(filteredFiles[0].rootId, filteredFiles[0].relativePath)
                  onClose()
                } else if (mode === 'icons' && filteredIcons[0]) {
                  onSelectIcon?.(`:icon[${filteredIcons[0].id}]:`)
                  onClose()
                }
              }
            }}
            className="flex-1 bg-transparent text-sm text-primary focus:outline-none"
          />
          {mode === 'icons' && (
            <span className="px-2 py-0.5 rounded bg-app border border-subtle text-[10px] font-mono text-accent">
              Untitled UI Icons (⌘⇧I)
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-panel text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 text-xs">
          {mode === 'commands' ? (
            <div className="space-y-0.5">
              {filteredActions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  data-testid={`palette-action-${act.id}`}
                  onClick={() => {
                    act.run()
                    onClose()
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-secondary text-left"
                >
                  <div>
                    <span className="text-muted mr-2">[{act.category}]</span>
                    <span className="font-medium text-primary">{act.label}</span>
                  </div>
                  {act.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-app border border-subtle font-mono text-[10px] text-muted">
                      {act.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          ) : mode === 'files' ? (
            <div className="space-y-0.5">
              {filteredFiles.map((file) => (
                <button
                  key={`${file.rootId}::${file.relativePath}`}
                  type="button"
                  data-testid={`quick-file-${file.rootId}-${file.relativePath}`}
                  onClick={() => {
                    onSelectFile(file.rootId, file.relativePath)
                    onClose()
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-secondary text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-muted" />
                    <span className="font-medium text-primary">{file.relativePath}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-secondary border border-subtle text-[10px] text-accent font-medium">
                    {file.rootName}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-2 pb-2 text-[11px] text-muted">
                <span>
                  Click an icon or press <kbd className="px-1 py-0.5 rounded bg-app border border-subtle font-mono">Enter</kbd> to insert inline <code className="font-mono text-accent">:icon[IconName]:</code>
                </span>
                <span>{filteredIcons.length} icons shown</span>
              </div>
              <div
                data-testid="icon-picker-grid"
                className="grid grid-cols-4 gap-1.5"
              >
                {filteredIcons.map((iconItem) => {
                  const IconComp = iconItem.Component
                  return (
                    <button
                      key={iconItem.id}
                      type="button"
                      data-testid={`icon-picker-item-${iconItem.id}`}
                      onClick={() => {
                        onSelectIcon?.(`:icon[${iconItem.id}]:`)
                        onClose()
                      }}
                      className="flex items-center gap-2.5 p-2 rounded border border-subtle/60 bg-app/50 hover:bg-secondary hover:border-accent text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded bg-panel border border-subtle flex items-center justify-center shrink-0 text-primary group-hover:text-accent">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-primary truncate text-[11px]">
                          {iconItem.label}
                        </div>
                        <div className="font-mono text-[9px] text-muted truncate">
                          {iconItem.kebab}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const SettingsModal: React.FC<{
  settings: AppSettings
  roots: WorkspaceRoot[]
  onUpdateSettings: (partial: Partial<AppSettings>) => void
  onSaveWorkspaceManifest: (filePath: string) => void
  onLoadWorkspaceManifest: (filePath: string) => void
  onClose: () => void
}> = ({
  settings,
  onUpdateSettings,
  onSaveWorkspaceManifest,
  onLoadWorkspaceManifest,
  onClose
}) => {
  const [manifestPath, setManifestPath] = useState('')
  const [patInput, setPatInput] = useState('')
  const [hasGithubPat, setHasGithubPat] = useState(false)

  // Saved Themes & Highlight Palette state
  const [newThemeName, setNewThemeName] = useState('')
  const [isEditingSavedTheme, setIsEditingSavedTheme] = useState(false)
  const [editThemeName, setEditThemeName] = useState('')
  const [customHighlightHex, setCustomHighlightHex] = useState('#FF5E5B')
  const [showThemeJsonDrawer, setShowThemeJsonDrawer] = useState(false)
  const [themeJsonText, setThemeJsonText] = useState('')
  const [themeStatusMsg, setThemeStatusMsg] = useState<string | null>(null)

  React.useEffect(() => {
    window.klartext
      .hasCredential('github.pat')
      .then((r) => setHasGithubPat(r.exists))
      .catch(() => {})
  }, [])

  const headingLevels: Array<{
    key: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    label: string
    defaultEm: number
  }> = [
    { key: 'h1', label: 'Heading 1 (H1)', defaultEm: 1.85 },
    { key: 'h2', label: 'Heading 2 (H2)', defaultEm: 1.45 },
    { key: 'h3', label: 'Heading 3 (H3)', defaultEm: 1.2 },
    { key: 'h4', label: 'Heading 4 (H4)', defaultEm: 1.08 },
    { key: 'h5', label: 'Heading 5 (H5)', defaultEm: 1.0 },
    { key: 'h6', label: 'Heading 6 (H6)', defaultEm: 0.92 }
  ]

  const currentSpellLangs = settings.spellcheckLanguages || ['en-US', 'sv-SE']

  const toggleSpellLanguage = (lang: string) => {
    const exists = currentSpellLangs.includes(lang)
    const next = exists
      ? currentSpellLangs.filter((l) => l !== lang)
      : [...currentSpellLangs, lang]
    onUpdateSettings({
      spellcheckLanguages: next.length > 0 ? next : ['en-US']
    })
  }

  const [settingsTab, setSettingsTab] = useState<'general' | 'visual' | 'frontmatter'>('general')
  const [newFmKey, setNewFmKey] = useState('')
  const [newFmLabel, setNewFmLabel] = useState('')
  const [newFmType, setNewFmType] = useState<FrontmatterFieldType>('text')
  const [newFmDefaultValue, setNewFmDefaultValue] = useState('')
  const [focusedFmPropKey, setFocusedFmPropKey] = useState<string | null>(null)

  const defaultFrontmatterProps: DefaultFrontmatterPropertyDef[] = Array.isArray(
    settings.defaultFrontmatterProperties
  )
    ? settings.defaultFrontmatterProperties
    : DEFAULT_FRONTMATTER_PROPERTIES

  const handleUpdateDefaultFmProp = (
    key: string,
    patch: Partial<DefaultFrontmatterPropertyDef>
  ) => {
    const next = defaultFrontmatterProps.map((p) => (p.key === key ? { ...p, ...patch } : p))
    onUpdateSettings({ defaultFrontmatterProperties: next })
  }

  const handleRemoveDefaultFmProp = (key: string) => {
    const next = defaultFrontmatterProps.filter((p) => p.key !== key)
    onUpdateSettings({ defaultFrontmatterProperties: next })
  }

  const handleAddDefaultFmProp = () => {
    const cleanRaw = newFmKey.trim()
    if (!cleanRaw) return
    const cleanKey = cleanRaw.toLowerCase().replace(/\s+/g, '_')
    const label = newFmLabel.trim() || cleanRaw
    const options = newFmType === 'dropdown' ? ['Option 1', 'Option 2', 'Option 3'] : []
    const existingIdx = defaultFrontmatterProps.findIndex((p) => p.key === cleanKey)
    const newEntry: DefaultFrontmatterPropertyDef = {
      key: cleanKey,
      label,
      type: newFmType,
      defaultValue: newFmDefaultValue,
      options: existingIdx >= 0 ? defaultFrontmatterProps[existingIdx].options : options
    }
    const next =
      existingIdx >= 0
        ? defaultFrontmatterProps.map((p, idx) => (idx === existingIdx ? newEntry : p))
        : [...defaultFrontmatterProps, newEntry]
    onUpdateSettings({ defaultFrontmatterProperties: next })
    setNewFmKey('')
    setNewFmLabel('')
    setNewFmDefaultValue('')
    setNewFmType('text')
  }

  const savedThemes = settings.savedThemes || []
  const activeSavedThemeId = settings.activeSavedThemeId || ''
  const activeSavedTheme = savedThemes.find((t) => t.id === activeSavedThemeId) || null
  const activeHighlightColor = settings.highlightColor || '#4C78A8'
  const customHighlightColors = settings.customHighlightColors || []
  const customThemeColors = settings.customThemeColors || {}

  const handleSelectSavedTheme = (themeId: string) => {
    if (!themeId) {
      onUpdateSettings({
        activeSavedThemeId: '',
        customThemeColors: {}
      })
      setIsEditingSavedTheme(false)
      return
    }
    const found = savedThemes.find((t) => t.id === themeId)
    if (!found) return
    setEditThemeName(found.name)
    onUpdateSettings({
      activeSavedThemeId: found.id,
      theme: found.baseMode,
      highlightColor: found.highlightColor,
      lightPaperInDarkMode: Boolean(found.lightPaperInDarkMode),
      customThemeColors: found.customColors || {},
      ...(found.typography ? { typography: found.typography } : {})
    })
  }

  const handleSaveNewTheme = () => {
    const name = newThemeName.trim() || `Custom Theme ${savedThemes.length + 1}`
    const id = `theme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newTheme: SavedTheme = {
      id,
      name,
      baseMode: settings.theme,
      highlightColor: activeHighlightColor,
      lightPaperInDarkMode: Boolean(settings.lightPaperInDarkMode),
      customColors: { ...customThemeColors },
      typography: { ...settings.typography }
    }
    const nextThemes = [...savedThemes, newTheme]
    onUpdateSettings({
      savedThemes: nextThemes,
      activeSavedThemeId: id
    })
    setNewThemeName('')
    setEditThemeName(name)
    setThemeStatusMsg(`Saved theme "${name}"`)
  }

  const handleUpdateActiveTheme = () => {
    if (!activeSavedTheme) return
    const updatedName = editThemeName.trim() || activeSavedTheme.name
    const nextThemes = savedThemes.map((t) =>
      t.id === activeSavedTheme.id
        ? {
            ...t,
            name: updatedName,
            baseMode: settings.theme,
            highlightColor: activeHighlightColor,
            lightPaperInDarkMode: Boolean(settings.lightPaperInDarkMode),
            customColors: { ...customThemeColors },
            typography: { ...settings.typography }
          }
        : t
    )
    onUpdateSettings({
      savedThemes: nextThemes
    })
    setIsEditingSavedTheme(false)
    setThemeStatusMsg(`Updated theme "${updatedName}"`)
  }

  const handleDeleteActiveTheme = () => {
    if (!activeSavedTheme) return
    const deletedName = activeSavedTheme.name
    const nextThemes = savedThemes.filter((t) => t.id !== activeSavedTheme.id)
    onUpdateSettings({
      savedThemes: nextThemes,
      activeSavedThemeId: ''
    })
    setIsEditingSavedTheme(false)
    setThemeStatusMsg(`Deleted theme "${deletedName}"`)
  }

  const handleExportThemes = () => {
    const payload = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        themes:
          savedThemes.length > 0
            ? savedThemes
            : [
                {
                  id: 'exported-current-theme',
                  name: 'Current Klartext Theme',
                  baseMode: settings.theme,
                  highlightColor: activeHighlightColor,
                  lightPaperInDarkMode: Boolean(settings.lightPaperInDarkMode),
                  customColors: customThemeColors,
                  typography: settings.typography
                }
              ]
      },
      null,
      2
    )
    setThemeJsonText(payload)
    setShowThemeJsonDrawer(true)
    if (typeof navigator !== 'undefined' && !navigator.webdriver) {
      navigator.clipboard?.writeText(payload).catch(() => {})
    }
    setThemeStatusMsg('Exported themes JSON')
  }

  const handleImportThemesFromJson = (rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson)
      const incomingList: SavedTheme[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.themes)
          ? parsed.themes
          : parsed?.id && parsed?.name
            ? [parsed]
            : []
      if (incomingList.length === 0) {
        setThemeStatusMsg('No valid themes found in JSON')
        return
      }
      const sanitized: SavedTheme[] = incomingList.map((item, idx) => ({
        id: String(item.id || `imported-${Date.now()}-${idx}`),
        name: String(item.name || `Imported Theme ${idx + 1}`),
        baseMode:
          item.baseMode === 'dark' || item.baseMode === 'light' || item.baseMode === 'system'
            ? item.baseMode
            : 'light',
        highlightColor:
          typeof item.highlightColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(item.highlightColor)
            ? item.highlightColor
            : '#4C78A8',
        lightPaperInDarkMode: Boolean(item.lightPaperInDarkMode),
        customColors: item.customColors || {},
        typography: item.typography
      }))
      const existingIds = new Set(savedThemes.map((t) => t.id))
      const merged = [
        ...savedThemes,
        ...sanitized.map((t) =>
          existingIds.has(t.id) ? { ...t, id: `${t.id}-${Date.now()}` } : t
        )
      ]
      const firstImported = merged[merged.length - 1]
      onUpdateSettings({
        savedThemes: merged,
        activeSavedThemeId: firstImported.id,
        theme: firstImported.baseMode,
        highlightColor: firstImported.highlightColor,
        customThemeColors: firstImported.customColors || {}
      })
      setShowThemeJsonDrawer(false)
      setThemeStatusMsg(`Imported ${sanitized.length} theme(s)`)
    } catch {
      setThemeStatusMsg('Invalid Theme JSON format')
    }
  }

  const handleAddCustomHighlightColor = () => {
    const clean = customHighlightHex.trim()
    if (!/^#[0-9A-Fa-f]{6}$/.test(clean)) return
    const upper = clean.toUpperCase()
    const nextCustom = customHighlightColors.includes(upper)
      ? customHighlightColors
      : [...customHighlightColors, upper]
    onUpdateSettings({
      customHighlightColors: nextCustom,
      highlightColor: upper
    })
  }

  // Compute live preview colors for the Theme Preview Window
  const previewIsDark = settings.theme === 'dark'
  const previewBgApp =
    customThemeColors.bgApp || (previewIsDark ? '#14171A' : '#F6F7F8')
  const previewBgPanel =
    customThemeColors.bgPanel || (previewIsDark ? '#1B2025' : '#FFFFFF')
  const previewBgEditor =
    customThemeColors.bgEditor ||
    (previewIsDark && !settings.lightPaperInDarkMode ? '#1B2025' : '#FFFFFF')
  const previewTextPrimary =
    customThemeColors.textPrimary ||
    settings.typography.bodyColor ||
    (previewIsDark && !settings.lightPaperInDarkMode ? '#E4E8EC' : '#20272D')

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      data-testid="settings-modal"
    >
      <div className="w-full max-w-4xl bg-panel border border-subtle rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-subtle">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-sm text-primary">
              Klartext Settings &amp; Customization
            </span>
            <div className="flex items-center gap-1 bg-app p-0.5 rounded border border-subtle text-xs">
              <button
                type="button"
                data-testid="settings-tab-general"
                onClick={() => setSettingsTab('general')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  settingsTab === 'general'
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                General &amp; Workspace
              </button>
              <button
                type="button"
                data-testid="settings-tab-visual"
                onClick={() => setSettingsTab('visual')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  settingsTab === 'visual'
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Themes &amp; Visual
              </button>
              <button
                type="button"
                data-testid="settings-tab-frontmatter"
                onClick={() => setSettingsTab('frontmatter')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  settingsTab === 'frontmatter'
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Frontmatter
              </button>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-settings-btn"
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-panel border border-subtle text-xs"
          >
            Close
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 text-xs">
          {settingsTab === 'visual' ? (
            <>
              {/* Saved Themes Manager + Import/Export + Live Theme Preview Window */}
              <div
                className="p-3.5 rounded-lg bg-app border border-subtle space-y-3"
                data-testid="settings-saved-themes-section"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-accent" />
                    <span className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                      Saved Themes Library (Save, Edit, Delete, Import &amp; Export)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="export-themes-btn"
                      onClick={handleExportThemes}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle text-primary hover:border-accent"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Themes</span>
                    </button>
                    <button
                      type="button"
                      data-testid="import-themes-btn"
                      onClick={() => {
                        setShowThemeJsonDrawer((v) => !v)
                        setThemeJsonText('')
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle text-primary hover:border-accent"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Themes</span>
                    </button>
                  </div>
                </div>

                {themeStatusMsg && (
                  <div
                    data-testid="theme-status-banner"
                    className="px-2.5 py-1 rounded bg-panel border border-subtle text-[11px] text-accent flex items-center justify-between"
                  >
                    <span>{themeStatusMsg}</span>
                    <button
                      type="button"
                      onClick={() => setThemeStatusMsg(null)}
                      className="text-muted hover:text-primary"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2.5 items-end">
                  <div className="col-span-5">
                    <label className="block text-muted mb-1">Active Saved Theme</label>
                    <select
                      data-testid="settings-saved-themes-select"
                      value={activeSavedThemeId}
                      onChange={(e) => handleSelectSavedTheme(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-panel border border-subtle text-primary font-medium"
                    >
                      <option value="">Nordic Default (Unsaved Preset)</option>
                      {savedThemes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.baseMode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-muted mb-1">Save Current as New Theme</label>
                    <input
                      type="text"
                      data-testid="save-new-theme-input"
                      placeholder="e.g., Midnight Fjord, Solarized Snow..."
                      value={newThemeName}
                      onChange={(e) => setNewThemeName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-panel border border-subtle text-primary"
                    />
                  </div>

                  <div className="col-span-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="save-theme-btn"
                      onClick={handleSaveNewTheme}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-accent text-white font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Theme</span>
                    </button>
                    {activeSavedTheme && (
                      <>
                        <button
                          type="button"
                          data-tooltip="Edit Saved Theme"
                          data-testid="edit-theme-btn"
                          onClick={() => {
                            setEditThemeName(activeSavedTheme.name)
                            setIsEditingSavedTheme((v) => !v)
                          }}
                          className="p-1.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-tooltip="Delete Saved Theme"
                          data-testid="delete-theme-btn"
                          onClick={handleDeleteActiveTheme}
                          className="p-1.5 rounded bg-panel border border-subtle text-danger hover:border-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit Saved Theme Drawer */}
                {isEditingSavedTheme && activeSavedTheme && (
                  <div
                    data-testid="edit-saved-theme-drawer"
                    className="p-3 rounded bg-panel border border-subtle space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary text-[11px]">
                        Editing Saved Theme: {activeSavedTheme.name}
                      </span>
                      <button
                        type="button"
                        data-testid="update-saved-theme-btn"
                        onClick={handleUpdateActiveTheme}
                        className="px-2.5 py-1 rounded bg-accent text-white font-medium text-[11px]"
                      >
                        Save Theme Changes
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="col-span-2">
                        <label className="block text-muted mb-1 text-[10px]">Theme Name</label>
                        <input
                          type="text"
                          data-testid="edit-theme-name-input"
                          value={editThemeName}
                          onChange={(e) => setEditThemeName(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-app border border-subtle text-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-muted mb-1 text-[10px]">App Surface</label>
                        <input
                          type="color"
                          data-testid="edit-theme-bg-app"
                          value={previewBgApp}
                          onChange={(e) =>
                            onUpdateSettings({
                              customThemeColors: {
                                ...customThemeColors,
                                bgApp: e.target.value
                              }
                            })
                          }
                          className="w-full h-7 rounded border border-subtle cursor-pointer bg-app"
                        />
                      </div>
                      <div>
                        <label className="block text-muted mb-1 text-[10px]">Panel Surface</label>
                        <input
                          type="color"
                          data-testid="edit-theme-bg-panel"
                          value={previewBgPanel}
                          onChange={(e) =>
                            onUpdateSettings({
                              customThemeColors: {
                                ...customThemeColors,
                                bgPanel: e.target.value
                              }
                            })
                          }
                          className="w-full h-7 rounded border border-subtle cursor-pointer bg-app"
                        />
                      </div>
                      <div>
                        <label className="block text-muted mb-1 text-[10px]">Editor Surface</label>
                        <input
                          type="color"
                          data-testid="edit-theme-bg-editor"
                          value={previewBgEditor}
                          onChange={(e) =>
                            onUpdateSettings({
                              customThemeColors: {
                                ...customThemeColors,
                                bgEditor: e.target.value
                              }
                            })
                          }
                          className="w-full h-7 rounded border border-subtle cursor-pointer bg-app"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Import / Export Themes JSON Drawer */}
                {showThemeJsonDrawer && (
                  <div
                    data-testid="themes-import-export-drawer"
                    className="p-3 rounded bg-panel border border-subtle space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary text-[11px]">
                        Import or Export Themes JSON
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="px-2 py-1 rounded bg-secondary border border-subtle text-[11px] cursor-pointer hover:border-accent">
                          <span>Load .json File</span>
                          <input
                            type="file"
                            accept=".json,application/json"
                            data-testid="import-themes-file-input"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = () => {
                                const text = String(reader.result || '')
                                setThemeJsonText(text)
                                handleImportThemesFromJson(text)
                              }
                              reader.readAsText(file)
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          data-testid="apply-import-themes-btn"
                          onClick={() => handleImportThemesFromJson(themeJsonText)}
                          className="px-2.5 py-1 rounded bg-accent text-white font-medium text-[11px]"
                        >
                          Apply Imported JSON
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={4}
                      data-testid="themes-json-textarea"
                      placeholder='Paste exported theme JSON here (e.g., {"themes": [...]})'
                      value={themeJsonText}
                      onChange={(e) => setThemeJsonText(e.target.value)}
                      className="w-full p-2 rounded bg-app border border-subtle font-mono text-[11px] text-primary"
                    />
                  </div>
                )}
              </div>

              {/* Highlight Color Palette (12 Pre-Configured Bright Colors + Custom Colors) */}
              <div
                className="p-3.5 rounded-lg bg-app border border-subtle space-y-3"
                data-testid="highlight-color-palette"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                      App Highlight &amp; Accent Color Palette (12 Bright Presets + Custom Colors)
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      Controls the primary accent color across buttons, active icons, badges, selection highlights, and inline <code className="font-mono">==highlight==</code> marks.
                    </div>
                  </div>
                  <span
                    data-testid="active-highlight-color-badge"
                    style={{ backgroundColor: activeHighlightColor }}
                    className="px-2.5 py-1 rounded text-white font-mono text-[11px] font-semibold shadow-sm"
                  >
                    {activeHighlightColor.toUpperCase()}
                  </span>
                </div>

                {/* 12 Pre-Configured Bright Colors */}
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_HIGHLIGHT_COLORS.map((preset) => {
                    const isSelected =
                      activeHighlightColor.toLowerCase() === preset.hex.toLowerCase()
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-testid={`highlight-color-swatch-${preset.id}`}
                        data-color={preset.hex}
                        onClick={() => onUpdateSettings({ highlightColor: preset.hex })}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-all ${
                          isSelected
                            ? 'bg-panel border-accent ring-2 ring-accent/40 font-semibold'
                            : 'bg-panel/70 border-subtle hover:border-accent/60'
                        }`}
                      >
                        <span
                          style={{ backgroundColor: preset.hex }}
                          className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center border border-black/10"
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="truncate text-[11px] text-primary">{preset.name}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Custom Highlight Colors + Add New Custom Color */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-subtle/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted mr-1">Custom Colors:</span>
                    {customHighlightColors.length === 0 && (
                      <span className="text-[11px] text-muted italic">None added yet</span>
                    )}
                    {customHighlightColors.map((hex) => {
                      const isSelected =
                        activeHighlightColor.toLowerCase() === hex.toLowerCase()
                      return (
                        <button
                          key={hex}
                          type="button"
                          data-testid={`custom-highlight-swatch-${hex}`}
                          onClick={() => onUpdateSettings({ highlightColor: hex })}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono ${
                            isSelected
                              ? 'bg-panel border-accent ring-2 ring-accent/40 font-semibold'
                              : 'bg-panel border-subtle'
                          }`}
                        >
                          <span
                            style={{ backgroundColor: hex }}
                            className="w-3.5 h-3.5 rounded-full border border-black/10"
                          />
                          <span>{hex}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      data-testid="custom-highlight-color-input"
                      value={
                        /^#[0-9A-Fa-f]{6}$/.test(customHighlightHex)
                          ? customHighlightHex
                          : '#FF5E5B'
                      }
                      onChange={(e) => setCustomHighlightHex(e.target.value.toUpperCase())}
                      className="w-7 h-7 rounded border border-subtle cursor-pointer bg-panel"
                    />
                    <input
                      type="text"
                      data-testid="custom-highlight-hex-input"
                      value={customHighlightHex}
                      onChange={(e) => setCustomHighlightHex(e.target.value)}
                      placeholder="#FF5E5B"
                      className="w-24 px-2 py-1 rounded bg-panel border border-subtle font-mono text-[11px] text-primary"
                    />
                    <button
                      type="button"
                      data-testid="add-custom-highlight-color-btn"
                      onClick={handleAddCustomHighlightColor}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-white font-medium text-[11px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Color</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Theme Preview Window */}
              <div
                data-testid="theme-preview-window"
                style={{
                  backgroundColor: previewBgApp,
                  color: previewTextPrimary
                }}
                className="rounded-lg border border-subtle overflow-hidden shadow-md"
              >
                <div
                  style={{ backgroundColor: previewBgPanel }}
                  className="flex items-center justify-between px-3 py-1.5 border-b border-subtle/60 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    <span className="font-semibold ml-1">
                      Theme Preview — {activeSavedTheme ? activeSavedTheme.name : `Nordic ${settings.theme}`}
                    </span>
                  </div>
                  <span
                    style={{ backgroundColor: activeHighlightColor }}
                    className="px-2 py-0.5 rounded text-white text-[10px] font-medium flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Accent Button</span>
                  </span>
                </div>
                <div className="grid grid-cols-12 min-h-[120px]">
                  <div
                    style={{ backgroundColor: previewBgApp }}
                    className="col-span-3 p-2.5 border-r border-subtle/50 space-y-1.5 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Folder
                        className="w-3.5 h-3.5"
                        style={{ color: activeHighlightColor }}
                      />
                      <span>Workspace Root</span>
                    </div>
                    <div
                      style={{
                        backgroundColor: `${activeHighlightColor}22`,
                        borderLeft: `3px solid ${activeHighlightColor}`
                      }}
                      className="px-2 py-1 rounded text-[10px] font-medium"
                    >
                      Architecture-Overview.md
                    </div>
                    <div className="px-2 py-1 text-[10px] opacity-70">
                      Release-Checklist.md
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: previewBgEditor,
                      fontFamily: settings.typography.bodyFontFamily
                    }}
                    className="col-span-9 p-3.5 space-y-2"
                  >
                    <div
                      style={{
                        fontFamily:
                          settings.typography.headings?.h1?.fontFamily ||
                          settings.typography.bodyFontFamily,
                        color:
                          settings.typography.headings?.h1?.color || previewTextPrimary
                      }}
                      className="text-base font-bold"
                    >
                      # Technical Nordic Markdown Studio
                    </div>
                    <p className="text-xs leading-relaxed">
                      Live typography preview with{' '}
                      <span
                        style={{
                          backgroundColor: `${activeHighlightColor}38`,
                          borderBottom: `2px solid ${activeHighlightColor}`
                        }}
                        className="px-1 py-0.5 rounded font-medium"
                      >
                        ==highlighted key insights==
                      </span>{' '}
                      and inline Untitled UI icons{' '}
                      <span
                        style={{ color: activeHighlightColor }}
                        className="inline-flex items-center gap-0.5 font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> :icon[Sparkles]:
                      </span>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Theme & General Editor Appearance */}
              <div className="space-y-3" data-testid="settings-visual-panel">
                <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                  Technical Nordic Theme &amp; Ordinary Text Typography
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-muted mb-1">Theme Mode</label>
                    <select
                      data-testid="settings-theme-select"
                      value={settings.theme}
                      onChange={(e) =>
                        onUpdateSettings({ theme: e.target.value as AppSettings['theme'] })
                      }
                      className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary"
                    >
                      <option value="system">Follow OS</option>
                      <option value="light">Nordic Light</option>
                      <option value="dark">Nordic Dark</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted mb-1">Ordinary Text Font</label>
                    <select
                      data-testid="settings-body-font-select"
                      value={settings.typography.bodyFontFamily}
                      onChange={(e) =>
                        onUpdateSettings({
                          typography: {
                            ...settings.typography,
                            bodyFontFamily: e.target.value
                          }
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary"
                    >
                      {FONT_FAMILY_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted mb-1">Ordinary Font Size (px)</label>
                    <input
                      type="number"
                      data-testid="settings-fontsize-input"
                      min={12}
                      max={24}
                      value={settings.typography.fontSizePx}
                      onChange={(e) =>
                        onUpdateSettings({
                          typography: {
                            ...settings.typography,
                            fontSizePx: Number(e.target.value) || 16
                          }
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-muted mb-1">Ordinary Text Color</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        data-testid="settings-body-color-input"
                        value={settings.typography.bodyColor || '#20272D'}
                        onChange={(e) =>
                          onUpdateSettings({
                            typography: {
                              ...settings.typography,
                              bodyColor: e.target.value
                            }
                          })
                        }
                        className="w-8 h-7 rounded border border-subtle cursor-pointer bg-app"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            typography: { ...settings.typography, bodyColor: '' }
                          })
                        }
                        className="px-2 py-1 rounded bg-app border border-subtle text-[10px] text-muted hover:text-primary"
                      >
                        Default
                      </button>
                    </div>
                  </div>
                </div>

                {/* Code Block Font Family & Size */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="col-span-2">
                    <label className="block text-muted mb-1">Code Block Font Family</label>
                    <select
                      data-testid="settings-code-font-select"
                      value={settings.typography.monoFontFamily}
                      onChange={(e) =>
                        onUpdateSettings({
                          typography: {
                            ...settings.typography,
                            monoFontFamily: e.target.value
                          }
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary font-mono"
                    >
                      {CODE_FONT_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted mb-1">Code Block Size (px)</label>
                    <input
                      type="number"
                      data-testid="settings-code-fontsize-input"
                      min={10}
                      max={24}
                      value={settings.typography.codeFontSizePx ?? 14}
                      onChange={(e) =>
                        onUpdateSettings({
                          typography: {
                            ...settings.typography,
                            codeFontSizePx: Number(e.target.value) || 14
                          }
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-primary font-medium">Page Tabs Position</span>
                    <select
                      data-testid="settings-page-tabs-position-select"
                      value={settings.pageTabsPosition || 'editor'}
                      onChange={(e) =>
                        onUpdateSettings({
                          pageTabsPosition: e.target.value as AppSettings['pageTabsPosition']
                        })
                      }
                      className="px-2.5 py-1 rounded bg-app border border-subtle text-primary"
                    >
                      <option value="editor">Above Writing Area (Default)</option>
                      <option value="top-menu">Top Menu Row (Right of Last Menu Item)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-primary">
                    <input
                      type="checkbox"
                      data-testid="settings-show-linenumbers-checkbox"
                      checked={Boolean(settings.showLineNumbers)}
                      onChange={(e) => onUpdateSettings({ showLineNumbers: e.target.checked })}
                      className="accent-accent"
                    />
                    <span>Show Row / Line Numbers in Editor</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-primary">
                    <input
                      type="checkbox"
                      data-testid="settings-wordwrap-checkbox"
                      checked={settings.wordWrap !== false}
                      onChange={(e) => onUpdateSettings({ wordWrap: e.target.checked })}
                      className="accent-accent"
                    />
                    <span>Enable Word Wrap (uncheck for Infinite Horizontal Workspace)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-primary">
                    <input
                      type="checkbox"
                      data-testid="settings-lightpaper-checkbox"
                      checked={Boolean(settings.lightPaperInDarkMode)}
                      onChange={(e) => onUpdateSettings({ lightPaperInDarkMode: e.target.checked })}
                      className="accent-accent"
                    />
                    <span>Display Document Background as White in Dark Mode</span>
                  </label>
                </div>
              </div>

              {/* Per-Headline (H1–H6) Font, Size, and Color Customization */}
              <div className="space-y-2.5 pt-3 border-t border-subtle">
                <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                  Headline Typography (Font, Size, and Color for H1 – H6)
                </div>
                <div className="space-y-2">
                  {headingLevels.map(({ key, label, defaultEm }) => {
                    const currentH = settings.typography.headings?.[key] || {}
                    return (
                      <div
                        key={key}
                        data-testid={`settings-heading-row-${key}`}
                        className="grid grid-cols-12 items-center gap-2 p-2 rounded bg-app border border-subtle"
                      >
                        <span className="col-span-3 font-semibold text-primary">{label}</span>
                        <div className="col-span-4">
                          <select
                            data-testid={`settings-heading-font-${key}`}
                            value={currentH.fontFamily || ''}
                            onChange={(e) =>
                              onUpdateSettings({
                                typography: {
                                  ...settings.typography,
                                  headings: {
                                    ...settings.typography.headings,
                                    [key]: { ...currentH, fontFamily: e.target.value || undefined }
                                  }
                                }
                              })
                            }
                            className="w-full px-2 py-1 rounded bg-panel border border-subtle text-primary"
                          >
                            <option value="">Inherit Ordinary Font</option>
                            {FONT_FAMILY_OPTIONS.map((opt) => (
                              <option key={opt.label} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                          <input
                            type="number"
                            step="0.05"
                            min={0.8}
                            max={3.5}
                            data-testid={`settings-heading-size-${key}`}
                            value={currentH.fontSizeEm ?? defaultEm}
                            onChange={(e) =>
                              onUpdateSettings({
                                typography: {
                                  ...settings.typography,
                                  headings: {
                                    ...settings.typography.headings,
                                    [key]: {
                                      ...currentH,
                                      fontSizeEm: Number(e.target.value) || defaultEm
                                    }
                                  }
                                }
                              })
                            }
                            className="w-full px-1.5 py-1 rounded bg-panel border border-subtle text-primary"
                          />
                          <span className="text-[10px] text-muted">em</span>
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1.5">
                          <input
                            type="color"
                            data-testid={`settings-heading-color-${key}`}
                            value={currentH.color || '#20272D'}
                            onChange={(e) =>
                              onUpdateSettings({
                                typography: {
                                  ...settings.typography,
                                  headings: {
                                    ...settings.typography.headings,
                                    [key]: { ...currentH, color: e.target.value }
                                  }
                                }
                              })
                            }
                            className="w-7 h-6 rounded border border-subtle cursor-pointer bg-panel"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSettings({
                                typography: {
                                  ...settings.typography,
                                  headings: {
                                    ...settings.typography.headings,
                                    [key]: { ...currentH, color: undefined }
                                  }
                                }
                              })
                            }
                            className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] text-muted hover:text-primary"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : settingsTab === 'frontmatter' ? (
            <div className="space-y-4" data-testid="settings-frontmatter-panel">
              {/* Top Info & Dynamic Variable Insertion Bar */}
              <div className="p-3.5 rounded-lg bg-app border border-subtle space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                      Default Frontmatter Properties &amp; Dynamic Variables
                    </div>
                    <div className="text-[11px] text-muted leading-relaxed">
                      Configure the default YAML properties and values automatically evaluated whenever you create a new Markdown document. Supports all{' '}
                      <code className="px-1 py-0.5 rounded bg-panel border border-subtle text-accent font-mono text-[10px]">
                        &lt;% ... %&gt;
                      </code>{' '}
                      dynamic variables.
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-fm-reset-defaults-btn"
                    onClick={() =>
                      onUpdateSettings({
                        defaultFrontmatterProperties: DEFAULT_FRONTMATTER_PROPERTIES
                      })
                    }
                    className="h-8 px-3 rounded-md bg-panel border border-subtle text-[11px] font-medium text-muted hover:text-primary hover:border-accent shrink-0 flex items-center justify-center transition-colors"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="pt-2 border-t border-subtle/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-muted font-semibold uppercase tracking-wider mr-1">
                    Insert Variable
                    {focusedFmPropKey && defaultFrontmatterProps.some((p) => p.key === focusedFmPropKey)
                      ? ` → ${focusedFmPropKey}:`
                      : ' → New Property:'}
                  </span>
                  {[
                    '<% creation_date %>',
                    '<% date %>',
                    '<% datetime %>',
                    '<% time %>',
                    '<% title %>',
                    '<% author %>',
                    '<% folder_name %>',
                    '<% workspace %>',
                    '<% git_branch %>',
                    '<% uuid %>'
                  ].map((token) => (
                    <button
                      key={token}
                      type="button"
                      title={
                        focusedFmPropKey &&
                        defaultFrontmatterProps.some((p) => p.key === focusedFmPropKey)
                          ? `Insert ${token} into "${focusedFmPropKey}" default value`
                          : `Insert ${token} into New Property default value`
                      }
                      onClick={() => {
                        const targetProp = focusedFmPropKey
                          ? defaultFrontmatterProps.find((p) => p.key === focusedFmPropKey)
                          : null
                        if (targetProp) {
                          const cur = targetProp.defaultValue || ''
                          handleUpdateDefaultFmProp(targetProp.key, {
                            defaultValue: cur ? `${cur} ${token}` : token
                          })
                        } else {
                          setNewFmDefaultValue((prev) => (prev ? `${prev} ${token}` : token))
                        }
                        if (typeof navigator !== 'undefined' && !navigator.webdriver) {
                          navigator.clipboard?.writeText(token).catch(() => {})
                        }
                      }}
                      className="h-6 px-2 rounded-md bg-panel border border-subtle text-accent font-mono text-[10px] hover:border-accent hover:bg-accent/10 flex items-center transition-colors"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aligned Table of Default Frontmatter Properties */}
              <div className="rounded-lg border border-subtle bg-app overflow-hidden shadow-xs">
                <div className="grid grid-cols-12 items-center gap-2.5 px-3.5 py-2 bg-secondary border-b border-subtle text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <div className="col-span-3">Property &amp; YAML Key</div>
                  <div className="col-span-2">Field Type</div>
                  <div className="col-span-4">Default Value / Variable</div>
                  <div className="col-span-2">Evaluated Preview</div>
                  <div className="col-span-1 text-right">Remove</div>
                </div>

                <div className="divide-y divide-subtle/60" data-testid="settings-fm-properties-list">
                  {defaultFrontmatterProps.map((prop) => {
                    const displayLabel =
                      prop.key === 'date' || prop.key === 'creation_date'
                        ? 'Creation Date'
                        : prop.label || prop.key.replace(/_/g, ' ')
                    const previewEvaluated = prop.defaultValue
                      ? evaluateTemplateVariables(prop.defaultValue, {
                          fileTitle: 'Untitled',
                          folderName: 'Notes',
                          rootName: 'Workspace'
                        }).output
                      : ''
                    const isFocused = focusedFmPropKey === prop.key

                    return (
                      <div
                        key={prop.key}
                        data-testid={`settings-fm-prop-row-${prop.key}`}
                        className={`grid grid-cols-12 items-center gap-2.5 px-3.5 py-2.5 transition-colors ${
                          isFocused ? 'bg-accent/5' : 'bg-app hover:bg-panel/40'
                        }`}
                      >
                        <div className="col-span-3 flex items-center justify-between gap-2 min-w-0 pr-1">
                          <span
                            data-testid={`settings-fm-prop-label-${prop.key}`}
                            className="font-semibold text-primary capitalize truncate text-xs"
                            title={displayLabel}
                          >
                            {displayLabel}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] font-mono text-muted shrink-0"
                            title={`YAML frontmatter key: ${prop.key}`}
                          >
                            {prop.key}
                          </span>
                        </div>

                        <div className="col-span-2">
                          <select
                            data-testid={`settings-fm-type-select-${prop.key}`}
                            value={prop.type}
                            onChange={(e) =>
                              handleUpdateDefaultFmProp(prop.key, {
                                type: e.target.value as FrontmatterFieldType
                              })
                            }
                            className="w-full h-8 px-2 rounded-md bg-panel border border-subtle text-primary text-xs font-medium focus:outline-none focus:border-accent transition-colors"
                          >
                            <option value="text">Text</option>
                            <option value="date">Date</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="tags">Tags</option>
                            <option value="number">Number</option>
                            <option value="checkbox">Checkbox</option>
                          </select>
                        </div>

                        <div className="col-span-4">
                          <input
                            type="text"
                            data-testid={`settings-fm-default-input-${prop.key}`}
                            placeholder="Static value or <% variable %>..."
                            value={prop.defaultValue || ''}
                            onFocus={() => setFocusedFmPropKey(prop.key)}
                            onChange={(e) =>
                              handleUpdateDefaultFmProp(prop.key, {
                                defaultValue: e.target.value
                              })
                            }
                            className="w-full h-8 px-2.5 rounded-md bg-panel border border-subtle text-primary font-mono text-xs focus:outline-none focus:border-accent transition-colors"
                          />
                        </div>

                        <div className="col-span-2 min-w-0">
                          {prop.defaultValue && prop.defaultValue.includes('<%') ? (
                            <div
                              data-testid={`settings-fm-preview-${prop.key}`}
                              title={`Evaluates to: ${previewEvaluated}`}
                              className="w-full h-8 px-2.5 rounded-md bg-accent/10 border border-accent/30 flex items-center gap-1.5 text-[11px] font-mono text-accent truncate"
                            >
                              <span className="text-muted text-[10px] shrink-0">→</span>
                              <span className="truncate">{previewEvaluated}</span>
                            </div>
                          ) : prop.defaultValue ? (
                            <div
                              data-testid={`settings-fm-preview-${prop.key}`}
                              title={`Static default: ${prop.defaultValue}`}
                              className="w-full h-8 px-2.5 rounded-md bg-panel/70 border border-subtle flex items-center text-[11px] font-mono text-primary truncate"
                            >
                              <span className="truncate">{prop.defaultValue}</span>
                            </div>
                          ) : (
                            <div className="w-full h-8 px-2.5 rounded-md bg-panel/30 border border-dashed border-subtle flex items-center text-[10px] text-muted italic truncate">
                              Empty on create
                            </div>
                          )}
                        </div>

                        <div className="col-span-1 flex items-center justify-end">
                          <button
                            type="button"
                            title={`Remove default property "${displayLabel}"`}
                            data-testid={`settings-fm-remove-btn-${prop.key}`}
                            onClick={() => handleRemoveDefaultFmProp(prop.key)}
                            className="w-8 h-8 rounded-md bg-panel border border-subtle text-muted hover:text-danger hover:border-danger flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Add New Default Property Form (Aligned to the same 12-column grid) */}
              <div
                data-testid="settings-fm-add-section"
                className="p-3.5 rounded-lg bg-app border border-subtle space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                    Add New Default Frontmatter Property
                  </div>
                  <span className="text-[10px] text-muted">
                    Added properties appear automatically on all newly created notes
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-2.5 items-end">
                  <div className="col-span-3 space-y-1">
                    <label className="block text-[10px] font-medium text-muted">
                      Property Name / Key
                    </label>
                    <input
                      type="text"
                      data-testid="settings-fm-new-key-input"
                      placeholder="e.g. category, reviewer..."
                      value={newFmKey}
                      onFocus={() => setFocusedFmPropKey(null)}
                      onChange={(e) => setNewFmKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddDefaultFmProp()
                        }
                      }}
                      className="w-full h-8 px-2.5 rounded-md bg-panel border border-subtle text-primary text-xs focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="block text-[10px] font-medium text-muted">Field Type</label>
                    <select
                      data-testid="settings-fm-new-type-select"
                      value={newFmType}
                      onChange={(e) => setNewFmType(e.target.value as FrontmatterFieldType)}
                      className="w-full h-8 px-2 rounded-md bg-panel border border-subtle text-primary text-xs font-medium focus:outline-none focus:border-accent transition-colors"
                    >
                      <option value="text">Text</option>
                      <option value="date">Date</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="tags">Tags</option>
                      <option value="number">Number</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>
                  <div className="col-span-5 space-y-1">
                    <label className="block text-[10px] font-medium text-muted">
                      Default Value / Dynamic Variable
                    </label>
                    <input
                      type="text"
                      data-testid="settings-fm-new-default-input"
                      placeholder="e.g. <% folder_name %> or <% creation_date %>..."
                      value={newFmDefaultValue}
                      onFocus={() => setFocusedFmPropKey(null)}
                      onChange={(e) => setNewFmDefaultValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddDefaultFmProp()
                        }
                      }}
                      className="w-full h-8 px-2.5 rounded-md bg-panel border border-subtle text-primary font-mono text-xs focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      data-testid="settings-fm-add-btn"
                      onClick={handleAddDefaultFmProp}
                      className="w-full h-8 px-3 rounded-md bg-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Property</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Page Tabs Position */}
              <div className="flex items-center justify-between pb-3 border-b border-subtle">
                <div>
                  <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                    Page Tabs Bar Location
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    Choose whether open document tabs appear above the writing area or on the top menu row to the right of the last menu item.
                  </div>
                </div>
                <select
                  data-testid="settings-page-tabs-position-select"
                  value={settings.pageTabsPosition || 'editor'}
                  onChange={(e) =>
                    onUpdateSettings({
                      pageTabsPosition: e.target.value as AppSettings['pageTabsPosition']
                    })
                  }
                  className="px-2.5 py-1.5 rounded bg-app border border-subtle text-primary shrink-0"
                >
                  <option value="editor">Above Writing Area (Default)</option>
                  <option value="top-menu">Top Menu Row (Right of Last Menu Item)</option>
                </select>
              </div>

              {/* Multi-Language Spellcheck Configuration */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                    Multi-Language Spellcheck (English, Svenska, Deutsch, Español, Français)
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-primary font-medium">
                    <input
                      type="checkbox"
                      data-testid="settings-spellcheck-enabled-checkbox"
                      checked={settings.spellcheckEnabled !== false}
                      onChange={(e) => onUpdateSettings({ spellcheckEnabled: e.target.checked })}
                      className="accent-accent"
                    />
                    <span>Show Red Squiggly Underlines for Misspelled Words</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(
                    Object.entries(SPELL_LANGUAGE_LABELS) as Array<[SupportedSpellLanguage, string]>
                  ).map(([code, label]) => {
                    const active = currentSpellLangs.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        data-testid={`settings-spellcheck-lang-${code}`}
                        onClick={() => toggleSpellLanguage(code)}
                        className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                          active
                            ? 'bg-accent text-white border-accent'
                            : 'bg-app border-subtle text-muted hover:text-primary'
                        }`}
                      >
                        {active ? '✓ ' : ''}
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Portable .klartext-workspace Manifest Save / Load */}
              <div className="space-y-2 pt-3 border-t border-subtle">
                <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                  Multi-Root Workspace Manifest (.klartext-workspace)
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    data-testid="manifest-filepath-input"
                    placeholder="/path/to/project.klartext-workspace"
                    value={manifestPath}
                    onChange={(e) => setManifestPath(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded bg-app border border-subtle text-primary font-mono"
                  />
                  <button
                    type="button"
                    data-testid="save-manifest-btn"
                    onClick={() =>
                      manifestPath.trim() && onSaveWorkspaceManifest(manifestPath.trim())
                    }
                    className="px-3 py-1.5 rounded bg-accent text-white font-medium"
                  >
                    Save Manifest
                  </button>
                  <button
                    type="button"
                    data-testid="load-manifest-btn"
                    onClick={() =>
                      manifestPath.trim() && onLoadWorkspaceManifest(manifestPath.trim())
                    }
                    className="px-3 py-1.5 rounded bg-secondary border border-subtle text-primary font-medium"
                  >
                    Load Manifest
                  </button>
                </div>
              </div>

              {/* OS Keychain GitHub Token Storage (safeStorage) */}
              <div className="space-y-2 pt-3 border-t border-subtle">
                <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                  GitHub Credentials (OS Keychain safeStorage)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    data-testid="github-pat-input"
                    placeholder="ghp_... Fine-Grained Personal Access Token"
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded bg-app border border-subtle text-primary font-mono"
                  />
                  <button
                    type="button"
                    data-testid="save-github-pat-btn"
                    onClick={async () => {
                      if (patInput.trim()) {
                        await window.klartext.setCredential('github.pat', patInput.trim())
                        setPatInput('')
                        setHasGithubPat(true)
                      }
                    }}
                    className="px-3 py-1.5 rounded bg-accent text-white font-medium"
                  >
                    Save to Keychain
                  </button>
                </div>
                {hasGithubPat && (
                  <div className="text-success text-[11px]" data-testid="github-pat-saved-badge">
                    Token encrypted in OS safeStorage (never stored in workspace manifests or logs).
                  </div>
                )}
              </div>

              {/* Customizable Keyboard Shortcuts with Conflict Detection */}
              <div className="space-y-2 pt-3 border-t border-subtle">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary uppercase tracking-wider text-[11px]">
                    Keyboard Shortcuts (keybindings.json)
                  </span>
                  <button
                    type="button"
                    data-testid="reset-keybindings-btn"
                    onClick={() =>
                      onUpdateSettings({
                        keybindings: {
                          'commandPalette.toggle': 'Mod+K',
                          'quickSwitcher.toggle': 'Mod+P',
                          'iconPicker.toggle': 'Mod+Shift+I',
                          'zenMode.toggle': 'Mod+Shift+F',
                          'search.inFile': 'Mod+F',
                          'search.global': 'Mod+Shift+H',
                          'ai.inlinePrompt': 'Mod+J',
                          'sidebar.left.toggle': 'Mod+B',
                          'file.save': 'Mod+S'
                        }
                      })
                    }
                    className="px-2 py-0.5 rounded bg-secondary border border-subtle text-[11px] hover:border-accent"
                  >
                    Reset to Defaults
                  </button>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {Object.entries(settings.keybindings || {}).map(([actionId, binding]) => {
                    const duplicateCount = Object.values(settings.keybindings || {}).filter(
                      (b) => b.toLowerCase() === binding.toLowerCase()
                    ).length
                    const hasConflict = duplicateCount > 1

                    return (
                      <div
                        key={actionId}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-app border border-subtle"
                      >
                        <span className="font-mono text-[11px] text-primary">{actionId}</span>
                        <div className="flex items-center gap-2">
                          {hasConflict && (
                            <span className="text-[10px] text-danger font-semibold">
                              Conflict
                            </span>
                          )}
                          <input
                            type="text"
                            value={binding}
                            onChange={(e) =>
                              onUpdateSettings({
                                keybindings: {
                                  ...settings.keybindings,
                                  [actionId]: e.target.value
                                }
                              })
                            }
                            className={`w-32 px-2 py-0.5 rounded bg-panel border text-right font-mono text-[11px] ${
                              hasConflict ? 'border-danger text-danger' : 'border-subtle text-primary'
                            }`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
