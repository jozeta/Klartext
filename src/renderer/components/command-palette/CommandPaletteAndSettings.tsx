import React, { useState } from 'react'
import { Command, FileText, X } from 'lucide-react'
import type { AppSettings, WorkspaceRoot } from '../../../shared/types'
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
    label: 'Editorial Serif (Georgia / Charter)',
    value: 'Charter, Georgia, Cambria, "Times New Roman", serif'
  },
  {
    label: 'Humanist Sans (Avenir / Gill Sans)',
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
    label: 'Menlo / Monaco / Consolas',
    value: 'Menlo, Monaco, Consolas, "Courier New", monospace'
  },
  {
    label: 'System UI Monospace',
    value: 'ui-monospace, SFMono-Regular, monospace'
  }
]

export const CommandPaletteModal: React.FC<{
  mode: 'commands' | 'files'
  actions: CommandActionItem[]
  files: Array<{ rootId: string; rootName: string; relativePath: string }>
  onSelectFile: (rootId: string, relativePath: string) => void
  onClose: () => void
}> = ({ mode, actions, files, onSelectFile, onClose }) => {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20"
      data-testid={mode === 'commands' ? 'command-palette-modal' : 'quick-switcher-modal'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-panel border border-subtle rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary border-b border-subtle">
          <Command className="w-4 h-4 text-accent" />
          <input
            type="text"
            autoFocus
            data-testid="palette-search-input"
            placeholder={
              mode === 'commands'
                ? 'Type a command (e.g., Sync All Repositories, Zen Mode, Theme)...'
                : 'Switch to file across any root folder...'
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
                }
              }
            }}
            className="flex-1 bg-transparent text-sm text-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-panel text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5 text-xs">
          {mode === 'commands'
            ? filteredActions.map((act) => (
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
              ))
            : filteredFiles.map((file) => (
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

  const [settingsTab, setSettingsTab] = useState<'general' | 'visual'>('general')

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      data-testid="settings-modal"
    >
      <div className="w-full max-w-3xl bg-panel border border-subtle rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-subtle">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-sm text-primary">
              Klartext Settings & Customization
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
