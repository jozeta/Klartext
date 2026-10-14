import type {
  AppSettings,
  EditMode,
  GitPullStrategy,
  ThemeMode,
  WorkspaceManifest,
  WorkspaceRoot
} from '../schemas'

export type { AppSettings, EditMode, GitPullStrategy, ThemeMode, WorkspaceManifest, WorkspaceRoot }

export interface FileTreeNode {
  name: string
  relativePath: string
  rootId: string
  isDirectory: boolean
  children?: FileTreeNode[]
  size?: number
  updatedAt?: number
}

export type GitRepoStateType =
  | 'Synced'
  | 'Modified'
  | 'Untracked'
  | 'Staged'
  | 'Ahead'
  | 'Behind'
  | 'Diverged'
  | 'Syncing'
  | 'Merge Conflict'
  | 'Stash Conflict'
  | 'Auth Required'
  | 'Offline'
  | 'Not a Git Repo'
  | 'Error'

export interface GitFileStatus {
  relativePath: string
  index: string
  workingDir: string
  isConflicted: boolean
}

export interface ConflictHunk {
  index: number
  startLine: number
  endLine: number
  currentHeader: string
  incomingHeader: string
  currentContent: string
  baseContent?: string
  incomingContent: string
}

export interface GitRepoStatus {
  rootId: string
  rootName: string
  isGitRepo: boolean
  state: GitRepoStateType
  branch: string
  tracking?: string
  ahead: number
  behind: number
  files: GitFileStatus[]
  conflictedFiles: string[]
  lastSyncAt?: number
  errorMessage?: string
}

export interface GitCommitLogEntry {
  hash: string
  date: string
  message: string
  authorName: string
  authorEmail: string
  rootId: string
  rootName: string
}

export interface SearchMatchLine {
  lineNumber: number
  lineText: string
  matchStart: number
  matchEnd: number
}

export interface SearchFileResult {
  rootId: string
  rootName: string
  relativePath: string
  matches: SearchMatchLine[]
}

export interface BacklinkItem {
  sourceRootId: string
  sourceRootName: string
  sourceRelativePath: string
  lineNumber: number
  excerpt: string
  isCrossRoot: boolean
}

export interface HardwareModelRecommendation {
  tag: string
  label: string
  downloadSize: string
  isTopPick?: boolean
  suitabilitySvEn: string
}

export interface HardwareTierAdvice {
  detectedRamGb: number
  cpuArch: string
  cpuModel: string
  platform: string
  tierId: 1 | 2 | 3 | 4
  tierName: string
  summary: string
  recommendedModels: HardwareModelRecommendation[]
  embeddingModels: HardwareModelRecommendation[]
}

export interface LocalAIModelInfo {
  name: string
  sizeBytes?: number
  family?: string
  parameterSize?: string
  quantizationLevel?: string
}

export interface AIStreamChunkEvent {
  requestId: string
  chunk: string
  done: boolean
  cleanedFullText?: string
  error?: string
}

export interface WatcherChangeEvent {
  rootId: string
  relativePath: string
  eventType: 'add' | 'change' | 'unlink'
  timestamp: number
}

export interface RecoverySnapshot {
  key: string
  rootId: string
  relativePath: string
  content: string
  savedAt: number
  reason: 'autosave-buffer' | 'pre-merge'
}
