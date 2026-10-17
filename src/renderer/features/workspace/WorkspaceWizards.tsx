import React, { useMemo, useState } from 'react'
import type {
  CustomFrontmatterFilterRule,
  DynamicFilterRule,
  DynamicFolderDef,
  DynamicWorkspaceDef
} from '../../../shared/types'
import {
  formatDynamicRuleSummary,
  matchesDynamicFilterRule,
  type DynamicCandidateDocument
} from '../../../shared/markdown/dynamic-workspace'
import {
  Check,
  Folder,
  FolderPlus,
  GitBranch,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X
} from '../../components/icons/untitled-icons'

export interface GitHubWorkspaceWizardModalProps {
  defaultParentDir: string
  onClose: () => void
  onCloneSuccess: (clonedRoot: { rootId: string }) => void
}

export const GitHubWorkspaceWizardModal: React.FC<GitHubWorkspaceWizardModalProps> = ({
  defaultParentDir,
  onClose,
  onCloneSuccess
}) => {
  const [step, setStep] = useState<1 | 2>(1)
  const [repoInput, setRepoInput] = useState('')
  const [personalAccessToken, setPersonalAccessToken] = useState('')
  const [saveTokenToKeychain, setSaveTokenToKeychain] = useState(true)
  const [parentDir, setParentDir] = useState(defaultParentDir || '/tmp')
  const [folderName, setFolderName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const normalizedRepoUrl = useMemo(() => {
    const raw = repoInput.trim()
    if (!raw) return ''
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(raw)) {
      const clean = raw.replace(/\.git$/i, '')
      return `https://github.com/${clean}.git`
    }
    return raw
  }, [repoInput])

  const inferredRepoBaseName = useMemo(() => {
    const raw = normalizedRepoUrl.trim()
    if (!raw) return 'github-workspace'
    const parts = raw.replace(/\.git$/i, '').split(/[/:]/)
    const last = parts[parts.length - 1]?.trim()
    return last || 'github-workspace'
  }, [normalizedRepoUrl])

  const handleNextStep = (): void => {
    setErrorMsg(null)
    if (!normalizedRepoUrl) {
      setErrorMsg('Please enter a GitHub repository URL or owner/repo shorthand.')
      return
    }
    if (!folderName.trim()) {
      setFolderName(inferredRepoBaseName)
    }
    if (!workspaceName.trim()) {
      setWorkspaceName(inferredRepoBaseName)
    }
    setStep(2)
  }

  const handleCloneSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMsg(null)
    if (!normalizedRepoUrl) {
      setErrorMsg('Repository URL is required.')
      return
    }
    const finalFolder = (folderName.trim() || inferredRepoBaseName).replace(/[/\\]+/g, '-')
    const finalName = workspaceName.trim() || finalFolder
    const cleanParent = parentDir.trim().replace(/\/+$/, '') || '/tmp'
    const targetDir = `${cleanParent}/${finalFolder}`

    let cloneUrlToUse = normalizedRepoUrl
    if (personalAccessToken.trim() && cloneUrlToUse.startsWith('https://github.com/')) {
      if (saveTokenToKeychain) {
        try {
          await window.klartext.setCredential('github.pat', personalAccessToken.trim())
        } catch {
          // non-fatal keychain error
        }
      }
      cloneUrlToUse = cloneUrlToUse.replace(
        'https://github.com/',
        `https://x-access-token:${encodeURIComponent(personalAccessToken.trim())}@github.com/`
      )
    }

    setIsCloning(true)
    try {
      const clonedRoot = await window.klartext.gitClone({
        remoteUrl: cloneUrlToUse,
        targetParentDir: cleanParent,
        folderName: finalFolder,
        alias: finalName
      })
      onCloneSuccess(clonedRoot)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <div
      data-testid="github-workspace-wizard-modal"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isCloning) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-panel border border-subtle shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-subtle flex items-center justify-between bg-secondary/40">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-primary">
              Add GitHub Workspace Wizard
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCloning}
            className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Header */}
        <div className="px-5 py-2.5 bg-app/50 border-b border-subtle flex items-center gap-4 text-[11px]">
          <button
            type="button"
            onClick={() => !isCloning && setStep(1)}
            className={`flex items-center gap-1.5 font-medium ${
              step === 1 ? 'text-accent' : 'text-secondary'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 1 ? 'bg-accent text-white' : 'bg-secondary text-primary'
              }`}
            >
              1
            </span>
            1. Repository & Auth
          </button>
          <span className="text-muted">→</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              step === 2 ? 'text-accent' : 'text-muted'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 2 ? 'bg-accent text-white' : 'bg-secondary text-muted'
              }`}
            >
              2
            </span>
            2. Local Folder & Workspace Name
          </span>
        </div>

        <form onSubmit={handleCloneSubmit} className="p-5 space-y-4 text-xs">
          {step === 1 ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  GitHub Repository (URL or <code className="font-mono">owner/repo</code>)
                </label>
                <input
                  type="text"
                  data-testid="github-wizard-repo-input"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="e.g. octocat/Hello-World or https://github.com/org/docs-repo.git"
                  autoFocus
                  className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                />
                {normalizedRepoUrl && (
                  <p className="mt-1 text-[10px] text-muted truncate">
                    Resolved remote: <code className="font-mono text-secondary">{normalizedRepoUrl}</code>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  GitHub Personal Access Token (Optional — for private HTTPS repos)
                </label>
                <input
                  type="password"
                  data-testid="github-wizard-pat-input"
                  value={personalAccessToken}
                  onChange={(e) => setPersonalAccessToken(e.target.value)}
                  placeholder="ghp_... or github_pat_..."
                  className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                />
                <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveTokenToKeychain}
                    onChange={(e) => setSaveTokenToKeychain(e.target.checked)}
                    className="rounded border-subtle"
                  />
                  Store token in macOS Keychain via Electron safeStorage
                </label>
              </div>

              {errorMsg && (
                <div
                  data-testid="github-wizard-error"
                  className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[11px]"
                >
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-subtle">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="github-wizard-next-btn"
                  onClick={handleNextStep}
                  className="px-4 py-1.5 rounded-md bg-accent text-white font-medium hover:opacity-95"
                >
                  Next: Destination →
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  Local Parent Directory
                </label>
                <input
                  type="text"
                  data-testid="github-wizard-target-dir-input"
                  value={parentDir}
                  onChange={(e) => setParentDir(e.target.value)}
                  placeholder="/Users/you/Documents"
                  className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Target Folder Name
                  </label>
                  <input
                    type="text"
                    data-testid="github-wizard-folder-name-input"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder={inferredRepoBaseName}
                    className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Workspace Display Name
                  </label>
                  <input
                    type="text"
                    data-testid="github-wizard-workspace-name-input"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder={inferredRepoBaseName}
                    className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-secondary/40 border border-subtle text-[11px] text-secondary">
                Cloning <code className="font-mono text-primary">{normalizedRepoUrl}</code> into{' '}
                <code className="font-mono text-primary">
                  {(parentDir.trim().replace(/\/+$/, '') || '/tmp') +
                    '/' +
                    (folderName.trim() || inferredRepoBaseName)}
                </code>
              </div>

              {errorMsg && (
                <div
                  data-testid="github-wizard-error"
                  className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[11px]"
                >
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-subtle">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isCloning}
                  className="px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isCloning}
                    className="px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="github-wizard-submit-btn"
                    disabled={isCloning}
                    className="px-4 py-1.5 rounded-md bg-accent text-white font-medium hover:opacity-95 disabled:opacity-50"
                  >
                    {isCloning ? 'Cloning Repository...' : 'Clone & Mount Workspace'}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

export interface DynamicWorkspaceWizardModalProps {
  /**
   * When targetWorkspace is provided, the wizard adds a new Dynamic Folder (or edits an existing folder/root rule)
   * inside that Dynamic Workspace. Otherwise it creates a new Dynamic Workspace container!
   */
  targetWorkspace?: DynamicWorkspaceDef | null
  editingFolder?: DynamicFolderDef | null
  editingRootRules?: boolean
  knownTags: string[]
  statusOptions: string[]
  candidateDocuments: DynamicCandidateDocument[]
  onClose: () => void
  onSaveWorkspace: (workspace: DynamicWorkspaceDef) => void
}

const EMPTY_RULES: DynamicFilterRule = {
  tagsPattern: '',
  titlePattern: '',
  authorPattern: '',
  statusPattern: '',
  dateFrom: '',
  dateTo: '',
  customFrontmatterFilters: []
}

export const DynamicWorkspaceWizardModal: React.FC<DynamicWorkspaceWizardModalProps> = ({
  targetWorkspace,
  editingFolder,
  editingRootRules,
  knownTags,
  statusOptions,
  candidateDocuments,
  onClose,
  onSaveWorkspace
}) => {
  const isAddingOrEditingFolderOnly = Boolean(targetWorkspace && !editingRootRules)
  const isEditingRootOnly = Boolean(targetWorkspace && editingRootRules)

  const [step, setStep] = useState<1 | 2>(
    isAddingOrEditingFolderOnly || isEditingRootOnly ? 2 : 1
  )
  const [workspaceName, setWorkspaceName] = useState(targetWorkspace?.name || '')
  const [mode, setMode] = useState<'dynamic-folders' | 'root-content'>(
    targetWorkspace?.mode || 'dynamic-folders'
  )
  const [folderName, setFolderName] = useState(
    editingFolder?.name || (targetWorkspace ? '' : 'Dynamic Folder 1')
  )

  const initialRules: DynamicFilterRule = useMemo(() => {
    if (editingFolder) {
      return {
        ...EMPTY_RULES,
        ...editingFolder.rules,
        customFrontmatterFilters: [...(editingFolder.rules.customFrontmatterFilters || [])]
      }
    }
    if (targetWorkspace && editingRootRules) {
      return {
        ...EMPTY_RULES,
        ...targetWorkspace.rootRules,
        customFrontmatterFilters: [...(targetWorkspace.rootRules?.customFrontmatterFilters || [])]
      }
    }
    return { ...EMPTY_RULES, customFrontmatterFilters: [] }
  }, [editingFolder, editingRootRules, targetWorkspace])

  const [rules, setRules] = useState<DynamicFilterRule>(initialRules)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const matchingDocs = useMemo(() => {
    return candidateDocuments.filter((doc) => matchesDynamicFilterRule(doc, rules))
  }, [candidateDocuments, rules])

  const handleAppendTagChip = (tag: string): void => {
    const existing = rules.tagsPattern
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (existing.includes(tag)) return
    const next = [...existing, tag].join(', ')
    setRules((prev) => ({ ...prev, tagsPattern: next }))
  }

  const handleAddCustomFilterRow = (): void => {
    setRules((prev) => ({
      ...prev,
      customFrontmatterFilters: [
        ...(prev.customFrontmatterFilters || []),
        { key: '', valuePattern: '' }
      ]
    }))
  }

  const handleUpdateCustomFilterRow = (
    idx: number,
    patch: Partial<CustomFrontmatterFilterRule>
  ): void => {
    setRules((prev) => ({
      ...prev,
      customFrontmatterFilters: (prev.customFrontmatterFilters || []).map((row, i) =>
        i === idx ? { ...row, ...patch } : row
      )
    }))
  }

  const handleRemoveCustomFilterRow = (idx: number): void => {
    setRules((prev) => ({
      ...prev,
      customFrontmatterFilters: (prev.customFrontmatterFilters || []).filter((_, i) => i !== idx)
    }))
  }

  const handleNextStep = (): void => {
    setErrorMsg(null)
    if (!workspaceName.trim()) {
      setErrorMsg('Please enter a name for the Dynamic Workspace container.')
      return
    }
    if (mode === 'dynamic-folders' && !folderName.trim()) {
      setErrorMsg('Please enter a name for the first Dynamic Folder.')
      return
    }
    setStep(2)
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanedRules: DynamicFilterRule = {
      tagsPattern: rules.tagsPattern.trim(),
      titlePattern: rules.titlePattern.trim(),
      authorPattern: rules.authorPattern.trim(),
      statusPattern: rules.statusPattern.trim(),
      dateFrom: rules.dateFrom.trim(),
      dateTo: rules.dateTo.trim(),
      customFrontmatterFilters: (rules.customFrontmatterFilters || [])
        .map((f) => ({ key: f.key.trim(), valuePattern: f.valuePattern.trim() }))
        .filter((f) => f.key !== '' || f.valuePattern !== '')
    }

    if (targetWorkspace) {
      if (editingRootRules) {
        onSaveWorkspace({
          ...targetWorkspace,
          name: workspaceName.trim() || targetWorkspace.name,
          mode: 'root-content',
          rootRules: cleanedRules
        })
        return
      }

      if (!folderName.trim()) {
        setErrorMsg('Please enter a name for the Dynamic Folder.')
        return
      }

      const folderDef: DynamicFolderDef = {
        id: editingFolder?.id || `dyn-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: folderName.trim(),
        icon: editingFolder?.icon,
        color: editingFolder?.color,
        rules: cleanedRules
      }

      const updatedFolders = editingFolder
        ? targetWorkspace.folders.map((f) => (f.id === editingFolder.id ? folderDef : f))
        : [...targetWorkspace.folders, folderDef]

      onSaveWorkspace({
        ...targetWorkspace,
        mode: 'dynamic-folders',
        folders: updatedFolders
      })
      return
    }

    // Creating a brand-new Dynamic Workspace container
    const wsId = `dyn-ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const finalWsName = workspaceName.trim() || 'Dynamic Workspace'

    if (mode === 'root-content') {
      onSaveWorkspace({
        id: wsId,
        name: finalWsName,
        mode: 'root-content',
        rootRules: cleanedRules,
        folders: []
      })
    } else {
      const firstFolder: DynamicFolderDef = {
        id: `dyn-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: folderName.trim() || 'Dynamic Folder 1',
        rules: cleanedRules
      }
      onSaveWorkspace({
        id: wsId,
        name: finalWsName,
        mode: 'dynamic-folders',
        rootRules: EMPTY_RULES,
        folders: [firstFolder]
      })
    }
  }

  return (
    <div
      data-testid="dynamic-workspace-wizard-modal"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-panel border border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-5 py-3.5 border-b border-subtle flex items-center justify-between bg-secondary/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-primary">
              {targetWorkspace
                ? editingFolder
                  ? `Edit Dynamic Folder: ${editingFolder.name}`
                  : editingRootRules
                    ? `Edit Dynamic Rules: ${targetWorkspace.name}`
                    : `New Dynamic Folder in ${targetWorkspace.name}`
                : 'Create a New Dynamic Workspace'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!targetWorkspace && (
          <div className="px-5 py-2.5 bg-app/50 border-b border-subtle flex items-center gap-4 text-[11px]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 font-medium ${
                step === 1 ? 'text-accent' : 'text-secondary'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 1 ? 'bg-accent text-white' : 'bg-secondary text-primary'
                }`}
              >
                1
              </span>
              1. Workspace Container & Mode
            </button>
            <span className="text-muted">→</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                step === 2 ? 'text-accent' : 'text-muted'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 2 ? 'bg-accent text-white' : 'bg-secondary text-muted'
                }`}
              >
                2
              </span>
              2. Frontmatter & Wildcard Filter Rules
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {step === 1 && !targetWorkspace ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  Dynamic Workspace Container Name
                </label>
                <input
                  type="text"
                  data-testid="dynamic-wizard-workspace-name-input"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. Security & Compliance Hub, Sprint Tracker, Executive Notes"
                  autoFocus
                  className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent text-xs"
                />
                <p className="mt-1 text-[10px] text-muted">
                  Creates a workspace container in the left sidebar just like a local folder workspace.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-secondary">
                  How should this Dynamic Workspace organize dynamic content?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="dynamic-wizard-mode-folders"
                    onClick={() => setMode('dynamic-folders')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      mode === 'dynamic-folders'
                        ? 'border-accent bg-accent/10 text-primary'
                        : 'border-subtle bg-app/60 text-secondary hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                      <FolderPlus className="w-3.5 h-3.5 text-accent" />
                      <span>Dynamic Folders (Recommended)</span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Creates your first Dynamic Folder inside the workspace container. Each folder has its own frontmatter & wildcard query rules, and you can add more dynamic folders anytime.
                    </p>
                  </button>

                  <button
                    type="button"
                    data-testid="dynamic-wizard-mode-root"
                    onClick={() => setMode('root-content')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      mode === 'root-content'
                        ? 'border-accent bg-accent/10 text-primary'
                        : 'border-subtle bg-app/60 text-secondary hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                      <Folder className="w-3.5 h-3.5 text-accent" />
                      <span>Dynamic Content in Root</span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Populates matching files directly inside the Dynamic Workspace root container without subfolders.
                    </p>
                  </button>
                </div>
              </div>

              {mode === 'dynamic-folders' && (
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    First Dynamic Folder Name
                  </label>
                  <input
                    type="text"
                    data-testid="dynamic-wizard-folder-name-input"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. Critical Incidents, Active RFCs, 2026 Security Audits"
                    className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[11px]">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-subtle">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="dynamic-wizard-next-btn"
                  onClick={handleNextStep}
                  className="px-4 py-1.5 rounded-md bg-accent text-white font-medium hover:opacity-95"
                >
                  Next: Configure Dynamic Rules →
                </button>
              </div>
            </>
          ) : (
            <>
              {isAddingOrEditingFolderOnly && (
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Dynamic Folder Name
                  </label>
                  <input
                    type="text"
                    data-testid="dynamic-wizard-folder-name-input"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. Active Security Audits"
                    autoFocus
                    className="w-full px-3 py-2 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/25 text-[11px] text-secondary flex items-center justify-between">
                <span>
                  Supports wildcards (<code className="font-mono text-primary">*</code> and{' '}
                  <code className="font-mono text-primary">?</code>) across all Frontmatter fields.
                  Leave a field blank to match any value.
                </span>
                <span className="font-mono text-[10px] text-accent font-semibold shrink-0 ml-2">
                  {matchingDocs.length} matching file{matchingDocs.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Tags (comma-separated, supports <code className="font-mono">*</code>)
                  </label>
                  <input
                    type="text"
                    data-testid="dynamic-wizard-tags-input"
                    value={rules.tagsPattern}
                    onChange={(e) => setRules((prev) => ({ ...prev, tagsPattern: e.target.value }))}
                    placeholder="e.g. sec*, *incident*, rfc"
                    className="w-full px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                  />
                  {knownTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {knownTags.slice(0, 7).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAppendTagChip(tag)}
                          className="px-1.5 py-0.5 rounded bg-secondary hover:bg-accent/20 text-[10px] text-secondary hover:text-primary flex items-center gap-0.5"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Title / Filename Pattern (supports <code className="font-mono">*</code>)
                  </label>
                  <input
                    type="text"
                    data-testid="dynamic-wizard-title-input"
                    value={rules.titlePattern}
                    onChange={(e) =>
                      setRules((prev) => ({ ...prev, titlePattern: e.target.value }))
                    }
                    placeholder="e.g. *Roadmap*, RFC-*, *2026*"
                    className="w-full px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Author Pattern (supports <code className="font-mono">*</code>)
                  </label>
                  <input
                    type="text"
                    data-testid="dynamic-wizard-author-input"
                    value={rules.authorPattern}
                    onChange={(e) =>
                      setRules((prev) => ({ ...prev, authorPattern: e.target.value }))
                    }
                    placeholder="e.g. *Alex*, sec-team*, *"
                    className="w-full px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Status Pattern (supports <code className="font-mono">*</code>)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      data-testid="dynamic-wizard-status-input"
                      value={rules.statusPattern}
                      onChange={(e) =>
                        setRules((prev) => ({ ...prev, statusPattern: e.target.value }))
                      }
                      placeholder="e.g. In Progress, *Review*, Approved"
                      className="flex-1 px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                    />
                    <select
                      aria-label="Preset Status"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setRules((prev) => ({ ...prev, statusPattern: e.target.value }))
                        }
                      }}
                      className="px-2 py-1.5 rounded-md bg-app border border-subtle text-secondary text-[11px]"
                    >
                      <option value="">Presets</option>
                      {statusOptions.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Frontmatter Date From (Inclusive)
                  </label>
                  <input
                    type="date"
                    data-testid="dynamic-wizard-date-from-input"
                    value={rules.dateFrom}
                    onChange={(e) => setRules((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Frontmatter Date To (Inclusive)
                  </label>
                  <input
                    type="date"
                    data-testid="dynamic-wizard-date-to-input"
                    value={rules.dateTo}
                    onChange={(e) => setRules((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary focus:outline-none focus:border-accent font-mono text-xs"
                  />
                </div>
              </div>

              {/* Custom Frontmatter Key/Value Wildcard Filters */}
              <div className="border-t border-subtle pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[11px] font-semibold text-secondary">
                      Any Frontmatter Property Filters (Wildcards Supported)
                    </span>
                    <p className="text-[10px] text-muted">
                      Match any frontmatter key (e.g. <code className="font-mono">tlp</code>,{' '}
                      <code className="font-mono">severity</code>,{' '}
                      <code className="font-mono">sprint</code>, or{' '}
                      <code className="font-mono">*</code>) and value pattern.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="dynamic-wizard-add-custom-filter-btn"
                    onClick={handleAddCustomFilterRow}
                    className="px-2.5 py-1 rounded bg-secondary hover:bg-accent hover:text-white text-primary text-[11px] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Frontmatter Filter
                  </button>
                </div>

                {(rules.customFrontmatterFilters || []).length > 0 && (
                  <div className="space-y-2">
                    {(rules.customFrontmatterFilters || []).map((cf, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          data-testid={`dynamic-wizard-custom-key-${idx}`}
                          value={cf.key}
                          onChange={(e) =>
                            handleUpdateCustomFilterRow(idx, { key: e.target.value })
                          }
                          placeholder="Frontmatter key (e.g. severity, tlp, *)"
                          className="w-44 px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary font-mono text-xs"
                        />
                        <span className="text-muted font-mono">=</span>
                        <input
                          type="text"
                          data-testid={`dynamic-wizard-custom-val-${idx}`}
                          value={cf.valuePattern}
                          onChange={(e) =>
                            handleUpdateCustomFilterRow(idx, { valuePattern: e.target.value })
                          }
                          placeholder="Value pattern (e.g. P1*, *AMBER*, *)"
                          className="flex-1 px-2.5 py-1.5 rounded-md bg-app border border-subtle text-primary font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomFilterRow(idx)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Matching Files Preview */}
              <div
                data-testid="dynamic-wizard-live-preview"
                className="border border-subtle rounded-lg bg-app/60 p-2.5"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-secondary mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3 h-3 text-accent" />
                    Live Preview ({matchingDocs.length} matching document
                    {matchingDocs.length === 1 ? '' : 's'})
                  </span>
                  <span className="text-[10px] font-mono text-muted truncate max-w-[280px]">
                    {formatDynamicRuleSummary(rules)}
                  </span>
                </div>
                {matchingDocs.length === 0 ? (
                  <p className="text-[11px] text-muted italic py-1">
                    No currently mounted files match these rules yet. Files will populate automatically as soon as their frontmatter matches.
                  </p>
                ) : (
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {matchingDocs.slice(0, 15).map((doc) => (
                      <div
                        key={`${doc.rootId}::${doc.relativePath}`}
                        className="flex items-center justify-between text-[11px] py-0.5 px-1.5 rounded bg-panel/70"
                      >
                        <span className="text-primary font-medium truncate">
                          {doc.relativePath}
                        </span>
                        <span className="text-[10px] text-muted font-mono shrink-0 ml-2">
                          {doc.rootName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-[11px]">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-subtle">
                {!targetWorkspace ? (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary"
                  >
                    ← Back
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="dynamic-wizard-submit-btn"
                    className="px-4 py-1.5 rounded-md bg-accent text-white font-medium hover:opacity-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {targetWorkspace
                      ? editingFolder || editingRootRules
                        ? 'Save Dynamic Rules'
                        : 'Create Dynamic Folder'
                      : 'Create Dynamic Workspace'}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
