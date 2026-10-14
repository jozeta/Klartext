import React, { useState } from 'react'
import { Command, FileText, X } from 'lucide-react'
import type { AppSettings, WorkspaceRoot } from '../../../shared/types'

export interface CommandActionItem {
  id: string
  label: string
  category: string
  shortcut?: string
  run: () => void
}

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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      data-testid="settings-modal"
    >
      <div className="w-full max-w-2xl bg-panel border border-subtle rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-subtle">
          <span className="font-semibold text-sm text-primary">
            Klartext Settings & Customization
          </span>
          <button
            type="button"
            data-testid="close-settings-btn"
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-panel border border-subtle text-xs"
          >
            Close
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Theme & Appearance */}
          <div className="space-y-2">
            <div className="font-semibold text-primary uppercase tracking-wider text-[11px]">
              Technical Nordic Theme & Typography
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <label className="block text-muted mb-1">Editor Font Size (px)</label>
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
                <label className="block text-muted mb-1">Line Height</label>
                <input
                  type="number"
                  step="0.05"
                  min={1.3}
                  max={2.0}
                  value={settings.typography.lineHeight}
                  onChange={(e) =>
                    onUpdateSettings({
                      typography: {
                        ...settings.typography,
                        lineHeight: Number(e.target.value) || 1.65
                      }
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-app border border-subtle text-primary"
                />
              </div>
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
                onClick={() => manifestPath.trim() && onSaveWorkspaceManifest(manifestPath.trim())}
                className="px-3 py-1.5 rounded bg-accent text-white font-medium"
              >
                Save Manifest
              </button>
              <button
                type="button"
                data-testid="load-manifest-btn"
                onClick={() => manifestPath.trim() && onLoadWorkspaceManifest(manifestPath.trim())}
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
        </div>
      </div>
    </div>
  )
}
