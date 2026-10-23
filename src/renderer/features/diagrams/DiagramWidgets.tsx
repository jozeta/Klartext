import React, { useEffect, useRef, useState } from 'react'
import {
  MousePointer,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Type,
  Trash2,
  GitCommit,
  Check
} from '../../components/icons/untitled-icons'
import {
  createDefaultExcalidrawScene,
  serializeExcalidrawSvg,
  sanitizeSvgContent,
  type ExcalidrawElementItem,
  type ExcalidrawSceneData
} from '../../../shared/serialization/excalidraw-svg'
import {
  DIAGRAM_PALETTE_ITEMS,
  StructuredMermaidVisualBuilder
} from './MermaidVisualParsers'

let mermaidModulePromise: Promise<typeof import('mermaid').default> | null = null
let lastMermaidConfigKey: string | null = null
const mermaidSvgCache = new Map<string, string>()

export type MermaidPreviewTheme = 'auto' | 'default' | 'neutral' | 'dark' | 'forest' | 'base'

/**
 * Sanitizes Mermaid-rendered SVG while preserving `<foreignObject>` HTML labels
 * used by Mermaid flowcharts, mindmaps, kanban boards, architecture, and class diagrams.
 */
export function sanitizeMermaidSvg(svgString: string): string {
  return svgString
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(?:href|xlink:href)\s*=\s*(?:"\s*(?:javascript:|vbscript:|data:text\/html)[^"]*"|'\s*(?:javascript:|vbscript:|data:text\/html)[^']*')/gi,
      ''
    )
}

export function getCachedMermaidSvgSync(
  code: string,
  theme: 'light' | 'dark',
  overrideMermaidTheme: MermaidPreviewTheme = 'auto'
): string | undefined {
  const effectiveTheme =
    overrideMermaidTheme === 'auto'
      ? theme === 'dark'
        ? 'dark'
        : 'neutral'
      : overrideMermaidTheme
  return mermaidSvgCache.get(`${effectiveTheme}::${code.trim()}`)
}

export async function renderCachedMermaidSvg(
  code: string,
  theme: 'light' | 'dark',
  overrideMermaidTheme: MermaidPreviewTheme = 'auto'
): Promise<string> {
  const trimmed = code.trim()
  const effectiveTheme =
    overrideMermaidTheme === 'auto'
      ? theme === 'dark'
        ? 'dark'
        : 'neutral'
      : overrideMermaidTheme
  const cacheKey = `${effectiveTheme}::${trimmed}`
  const cached = mermaidSvgCache.get(cacheKey)
  if (cached) return cached

  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((m) => m.default || (m as any))
  }
  const mermaid = await mermaidModulePromise
  if (lastMermaidConfigKey !== effectiveTheme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: effectiveTheme as any,
      fontFamily: 'Inter, -apple-system, sans-serif'
    })
    lastMermaidConfigKey = effectiveTheme
  }
  const id = `klartext-mermaid-${Math.random().toString(36).slice(2, 10)}`
  const { svg } = await mermaid.render(id, trimmed)
  const sanitized = sanitizeMermaidSvg(svg)
  if (mermaidSvgCache.size > 250) {
    const firstKey = mermaidSvgCache.keys().next().value
    if (firstKey) mermaidSvgCache.delete(firstKey)
  }
  mermaidSvgCache.set(cacheKey, sanitized)
  return sanitized
}

export const MermaidDiagramWidget: React.FC<{
  code: string
  theme: 'light' | 'dark'
  onUpdateCode?: (newCode: string) => void
  onOpenVisualBuilder?: (currentCode: string) => void
}> = ({ code, theme, onUpdateCode, onOpenVisualBuilder }) => {
  const [svgHtml, setSvgHtml] = useState<string>(
    () => getCachedMermaidSvgSync(code, theme) || ''
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [editingSource, setEditingSource] = useState(false)
  const [draftCode, setDraftCode] = useState(code)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setDraftCode(code)
  }, [code])

  useEffect(() => {
    const syncHit = getCachedMermaidSvgSync(code, theme)
    if (syncHit) {
      setSvgHtml(syncHit)
      setErrorMsg(null)
      return
    }
    let cancelled = false
    renderCachedMermaidSvg(code, theme)
      .then((sanitized) => {
        if (!cancelled) {
          setSvgHtml(sanitized)
          setErrorMsg(null)
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Invalid Mermaid syntax')
        }
      })
    return () => {
      cancelled = true
    }
  }, [code, theme])

  return (
    <div
      className={`my-3 rounded-md border border-subtle bg-panel overflow-hidden ${
        expanded ? 'fixed inset-6 z-50 flex flex-col shadow-xl' : ''
      }`}
      data-testid="mermaid-widget"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary border-b border-subtle text-xs">
        <span className="font-medium text-muted">Mermaid Diagram</span>
        <div className="flex items-center gap-2">
          {onOpenVisualBuilder && (
            <button
              type="button"
              data-testid="mermaid-open-visual-builder"
              onClick={() => onOpenVisualBuilder(code)}
              className="px-2 py-0.5 rounded bg-accent text-white font-medium hover:opacity-90"
            >
              Visual Builder
            </button>
          )}
          <button
            type="button"
            data-testid="mermaid-toggle-source"
            onClick={() => setEditingSource((v) => !v)}
            className="px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary"
          >
            {editingSource ? 'Hide Source' : 'Edit Source'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary"
          >
            {expanded ? 'Minimize' : 'Expand'}
          </button>
        </div>
      </div>

      {editingSource && (
        <div className="p-2.5 bg-app border-b border-subtle">
          <textarea
            data-testid="mermaid-source-textarea"
            value={draftCode}
            onChange={(e) => {
              setDraftCode(e.target.value)
              onUpdateCode?.(e.target.value)
            }}
            rows={4}
            className="w-full p-2 text-xs font-mono bg-panel text-primary border border-subtle rounded focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {errorMsg && (
        <div
          data-testid="mermaid-error-banner"
          className="px-3 py-2 text-xs bg-secondary border-b border-subtle text-danger font-mono"
        >
          Mermaid Syntax Diagnostic: {errorMsg}
        </div>
      )}

      <div
        className="p-4 flex justify-center items-center overflow-auto"
        data-testid="mermaid-svg-container"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  )
}

/* ============================================================================
 * VISUAL MERMAID DIAGRAM STUDIO (Mermaid Live Editor + 2D Visual Node Builder)
 * ============================================================================ */

export type VisualMermaidNodeShape =
  | 'rect'
  | 'round'
  | 'diamond'
  | 'cylinder'
  | 'circle'
  | 'subroutine'
  | 'hexagon'
export type VisualMermaidEdgeStyle = '-->' | '-.->' | '==>' | '<-->' | '---'

export interface VisualMermaidNode {
  id: string
  label: string
  shape: VisualMermaidNodeShape
  x: number
  y: number
}

export interface VisualMermaidEdge {
  id: string
  from: string
  to: string
  style: VisualMermaidEdgeStyle
  label: string
}

export interface MermaidDiagramPreset {
  id: string
  label: string
  category: 'Flow & Architecture' | 'Network & Systems' | 'Data & Modeling' | 'Planning & Charts'
  description: string
  code: string
  snippets: { label: string; snippet: string }[]
}

export const MERMAID_DIAGRAM_PRESETS: MermaidDiagramPreset[] = [
  {
    id: 'flowchart',
    label: 'Flowchart',
    category: 'Flow & Architecture',
    description: 'Directed process graph with shapes, decisions, and labeled links.',
    code: `flowchart LR
    A["Client Request"] --> B{"Authenticated?"}
    B -->|"Yes"| C("API Gateway")
    B -->|"No"| D["401 Unauthorized"]
    C --> E[("Primary DB")]`,
    snippets: [
      { label: '+ Subgraph', snippet: '\n    subgraph Group["Service Boundary"]\n        G1["Worker Node"]\n    end' },
      { label: '+ Decision', snippet: '\n    DEC{"Check Condition?"} -->|"Pass"| OK["Continue"]' },
      { label: '+ Database', snippet: '\n    DB[("PostgreSQL Replica")]' }
    ]
  },
  {
    id: 'sequence',
    label: 'Sequence',
    category: 'Network & Systems',
    description: 'Time-ordered message exchange between actors, services, and databases.',
    code: `sequenceDiagram
    autonumber
    actor User
    participant App as Klartext Desktop
    participant Git as Remote Git Host
    participant AI as Local Ollama (127.0.0.1)

    User->>+App: Trigger AI Improve (Cmd+J)
    App->>+AI: POST /api/chat (Stream)
    AI-->>-App: NDJSON Token Stream
    App-->>-User: Render Inline Diff Proposal
    opt Accepted by User
        User->>App: Commit & Sync Workspace
        App->>Git: git pull --rebase && git push
        Git-->>App: 200 OK (Synced)
    end`,
    snippets: [
      { label: '+ Participant', snippet: '\n    participant Svc as Auth Service' },
      { label: '+ Sync Call', snippet: '\n    App->>+Svc: Request Token\n    Svc-->>-App: JWT Response' },
      { label: '+ Alt / Else Block', snippet: '\n    alt Valid Session\n        App->>User: Access Granted\n    else Expired\n        App->>User: Prompt Login\n    end' },
      { label: '+ Note', snippet: '\n    Note over App,AI: Strict loopback privacy' }
    ]
  },
  {
    id: 'architecture',
    label: 'Architecture',
    category: 'Flow & Architecture',
    description: 'Cloud & infrastructure topology with groups, services, databases, and edges.',
    code: `architecture-beta
    group edge(cloud)[Edge Network]
    group core(server)[Core Platform]

    service cdn(internet)[Cloudflare WAF] in edge
    service api(server)[API Gateway] in core
    service worker(server)[Sync Worker] in core
    service db(database)[Primary Store] in core
    service cache(disk)[Redis Cache] in core

    cdn:R --> L:api
    api:R --> L:db
    api:B --> T:cache
    worker:T --> B:db`,
    snippets: [
      { label: '+ Group', snippet: '\n    group sec(cloud)[Security Zone]' },
      { label: '+ Service', snippet: '\n    service auth(server)[Auth Node] in core' },
      { label: '+ Edge Link', snippet: '\n    api:R --> L:auth' }
    ]
  },
  {
    id: 'block',
    label: 'Block Diagram',
    category: 'Flow & Architecture',
    description: 'Grid-aligned system architecture blocks with column spans and arrows.',
    code: `block-beta
    columns 3
    UI["Renderer UI (React 19)"]:3
    space:3
    IPC["Typed Preload IPC"] Main["Electron Main Process"] Sec["Path Jail & Guard"]
    space:3
    FS[("Local Markdown FS")] Git[("Multi-Repo Git")] AI[("Local Ollama / LM Studio")]

    UI --> IPC
    IPC --> Main
    Main --> Sec
    Main --> FS
    Main --> Git
    Main --> AI`,
    snippets: [
      { label: '+ Row Space', snippet: '\n    space:3' },
      { label: '+ Spanning Block', snippet: '\n    Bus["Event Bus Layer"]:3' },
      { label: '+ Block Link', snippet: '\n    Main --> Bus' }
    ]
  },
  {
    id: 'kanban',
    label: 'Kanban Board',
    category: 'Planning & Charts',
    description: 'Agile workflow columns with task cards, assignees, and priority badges.',
    code: `kanban
  Backlog
    [Audit Zero-Trust Policies]@{ assigned: "sec-team", priority: "High" }
    [Add WebAuthn Hardware Key Support]@{ priority: "Normal" }
  In Progress
    [Multi-Root Dynamic Workspaces]@{ assigned: "anna", priority: "Very High" }
    [Mermaid Live Diagram Studio]@{ assigned: "erik", priority: "High" }
  Review
    [Nordic Theme Library]@{ assigned: "linnea", priority: "Normal" }
  Done
    [Offline KaTeX & GFM Engine]@{ assigned: "erik", priority: "Low" }`,
    snippets: [
      { label: '+ Column', snippet: '\n  QA Verification\n    [Run Playwright Suite]@{ priority: "High" }' },
      { label: '+ High Priority Card', snippet: '\n    [Security Patch]@{ assigned: "ops", priority: "Very High" }' }
    ]
  },
  {
    id: 'er',
    label: 'ER Diagram',
    category: 'Data & Modeling',
    description: 'Database entity-relationship schema with crow-foot cardinality and keys.',
    code: `erDiagram
    WORKSPACE ||--o{ DOCUMENT : contains
    WORKSPACE ||--o{ DYNAMIC_FOLDER : filters
    DOCUMENT ||--o{ ASSET : references
    DOCUMENT }o--o{ TAG : labeled_with

    WORKSPACE {
        string id PK
        string name
        string root_path
        boolean is_git_repo
    }
    DOCUMENT {
        string relative_path PK
        string title
        string status
        date updated_at
    }
    ASSET {
        string file_name PK
        string mime_type
        int byte_size
    }`,
    snippets: [
      { label: '+ Entity Table', snippet: '\n    AUTHOR {\n        string id PK\n        string email UK\n        string role\n    }' },
      { label: '+ 1-to-Many Relation', snippet: '\n    AUTHOR ||--o{ DOCUMENT : writes' }
    ]
  },
  {
    id: 'state',
    label: 'State Diagram',
    category: 'Data & Modeling',
    description: 'Finite state machine transitions, composite states, and guards.',
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Fetching : git fetch
    Fetching --> Clean : Up to date
    Fetching --> Ahead : Local commits ready
    Fetching --> Diverged : Remote & local changed

    Ahead --> Synced : git push
    Diverged --> Rebasing : git pull --rebase
    Rebasing --> Synced : Auto-merged
    Rebasing --> Conflict : Unmerged paths
    Conflict --> Synced : Resolved in Klartext
    Synced --> Idle`,
    snippets: [
      { label: '+ Transition', snippet: '\n    Idle --> Auditing : Run Check' },
      { label: '+ Composite State', snippet: '\n    state Rebasing {\n        [*] --> ApplyingCommits\n        ApplyingCommits --> [*]\n    }' }
    ]
  },
  {
    id: 'class',
    label: 'Class Diagram',
    category: 'Data & Modeling',
    description: 'Object-oriented domain model with interfaces, methods, and inheritance.',
    code: `classDiagram
    class WorkspaceManager {
        +RootFolder[] roots
        +mountRoot(path: string) Promise~RootFolder~
        +removeRoot(id: string) void
        +evaluateDynamicFolder(rules: FilterRule[]) Document[]
    }
    class GitOrchestrator {
        +syncAllRepos(roots: RootFolder[]) Promise~SyncReport~
        +resolveConflict(rootId: string, file: string) Promise~void~
    }
    class LocalAiClient {
        +string endpoint
        +streamCompletion(prompt: string) AsyncIterable~string~
    }
    WorkspaceManager --> GitOrchestrator : coordinates
    WorkspaceManager --> LocalAiClient : indexes RAG`,
    snippets: [
      { label: '+ Class', snippet: '\n    class ThemeEngine {\n        +string highlightColor\n        +applyTheme(id: string) void\n    }' },
      { label: '+ Inheritance', snippet: '\n    WorkspaceManager <|-- DynamicWorkspaceManager' }
    ]
  },
  {
    id: 'mindmap',
    label: 'Mindmap',
    category: 'Planning & Charts',
    description: 'Hierarchical radial mindmap for brainstorming and architecture breakdown.',
    code: `mindmap
  root((Klartext Architecture))
    Multi-Root Workspace
      Local Folders
      GitHub Repositories
      Dynamic Smart Folders
    Hybrid Markdown Editor
      Inline Rich Rendering
      Source CodeMirror 6
      Side-by-Side Split View
    Security & Privacy
      Path Traversal Jail
      CSP Sandbox
      100% Local AI Loopback`,
    snippets: [
      { label: '+ Branch', snippet: '\n    Export Pipeline\n      Standalone HTML\n      Print-Ready PDF' },
      { label: '+ Cloud Node', snippet: '\n      )Cloud Sync Optional(' }
    ]
  },
  {
    id: 'timeline',
    label: 'Timeline',
    category: 'Planning & Charts',
    description: 'Chronological release roadmap, incident timeline, or historical milestones.',
    code: `timeline
    title Klartext Security & Platform Roadmap
    section Q1 - Foundation
        Core Engine : Multi-Root FS Jail
                    : Hybrid Markdown + KaTeX
    section Q2 - Collaboration
        Git Studio  : Multi-Repo Sync All
                    : Inline Conflict Resolver
    section Q3 - Intelligence
        Local AI    : Ollama & LM Studio Bridge
                    : Multi-Root Workspace Q&A
    section Q4 - Visuals
        Diagrams    : Mermaid Live Studio
                    : Native Excalidraw SVG`,
    snippets: [
      { label: '+ Section & Milestone', snippet: '\n    section Next Release\n        v2.0 Launch : Signed macOS Universal App\n                    : Dynamic Workspaces' }
    ]
  },
  {
    id: 'gitGraph',
    label: 'Git Graph',
    category: 'Network & Systems',
    description: 'Visual Git commit history with feature branches, merges, and release tags.',
    code: `gitGraph
    commit id: "init-core"
    commit id: " nordic-themes"
    branch feat/dynamic-workspaces
    checkout feat/dynamic-workspaces
    commit id: "frontmatter-query"
    commit id: "wildcard-matcher"
    checkout main
    branch feat/mermaid-studio
    checkout feat/mermaid-studio
    commit id: "packet-and-architecture"
    checkout main
    merge feat/dynamic-workspaces id: "merge-workspaces" tag: "v1.4.0"
    merge feat/mermaid-studio id: "merge-diagrams" tag: "v1.5.0"`,
    snippets: [
      { label: '+ Commit', snippet: '\n    commit id: "hotfix-security"' },
      { label: '+ Branch & Merge', snippet: '\n    branch hotfix\n    checkout hotfix\n    commit id: "patch-1"\n    checkout main\n    merge hotfix tag: "v1.5.1"' }
    ]
  },
  {
    id: 'gantt',
    label: 'Gantt Chart',
    category: 'Planning & Charts',
    description: 'Project schedule with sections, dependencies, critical path, and milestones.',
    code: `gantt
    title ISO 27001 Readiness & Rollout Schedule
    dateFormat YYYY-MM-DD
    section Access Control
        SSO & MFA Enforcement       :done,    sec1, 2026-10-01, 7d
        Least-Privilege IAM Audit   :active,  sec2, after sec1, 5d
    section Infrastructure
        Zero-Trust Network Policy   :         net1, 2026-10-08, 6d
        Automated Offsite Backups   :crit,    net2, after net1, 4d
    section Certification
        External Penetration Test   :         aud1, after sec2, 5d
        Final Sign-Off Milestone    :milestone, m1, after aud1, 0d`,
    snippets: [
      { label: '+ Task', snippet: '\n        Security Training           :         tr1, 2026-10-20, 4d' },
      { label: '+ Milestone', snippet: '\n        Production Go-Live          :milestone, m2, 2026-10-25, 0d' }
    ]
  },
  {
    id: 'quadrant',
    label: 'Quadrant Chart',
    category: 'Planning & Charts',
    description: '2×2 strategic matrix for effort vs. impact, risk vs. urgency, or positioning.',
    code: `quadrantChart
    title Security Initiative Prioritization (Effort vs Impact)
    x-axis Low Implementation Effort --> High Implementation Effort
    y-axis Low Security Impact --> High Security Impact
    quadrant-1 Strategic Investments
    quadrant-2 Quick Security Wins
    quadrant-3 Low Priority Hygiene
    quadrant-4 Complex Re-Architecture
    "Hardware MFA Keys": [0.22, 0.88]
    "Zero-Trust Microsegmentation": [0.78, 0.91]
    "Automated Dependency Patching": [0.18, 0.72]
    "Legacy Vault Migration": [0.82, 0.38]
    "Log Retention Tuning": [0.30, 0.35]`,
    snippets: [
      { label: '+ Data Point', snippet: '\n    "Endpoint Encryption": [0.28, 0.84]' }
    ]
  },
  {
    id: 'xychart',
    label: 'XY Chart',
    category: 'Planning & Charts',
    description: 'Combined bar and line chart for metrics, throughput, and latency trends.',
    code: `xychart-beta
    title "Monthly API Throughput (k req/s) & P95 Latency (ms)"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Score / Metric" 0 --> 120
    bar [48, 62, 75, 84, 96, 112]
    line [42, 38, 35, 29, 24, 19]`,
    snippets: [
      { label: '+ Line Series', snippet: '\n    line [50, 55, 60, 68, 74, 82]' }
    ]
  },
  {
    id: 'sankey',
    label: 'Sankey Flow',
    category: 'Planning & Charts',
    description: 'Proportional flow diagram for traffic, budget, or energy distribution.',
    code: `sankey-beta

Ingress Traffic,API Gateway,120
Ingress Traffic,Static CDN,80
API Gateway,Auth Service,120
Auth Service,Core Read Replica,85
Auth Service,Write Primary,25
Auth Service,Rate Limited (429),10`,
    snippets: [
      { label: '+ Flow Row', snippet: '\nCore Read Replica,Redis Hit,65' }
    ]
  },
  {
    id: 'journey',
    label: 'User Journey',
    category: 'Planning & Charts',
    description: 'Step-by-step user experience map with satisfaction scores (1–5).',
    code: `journey
    title Developer Incident Response Journey
    section Detection
      Receive Pager Alert: 3: OnCall
      Open Incident Runbook in Klartext: 5: OnCall
    section Mitigation
      Execute Diagnostic CLI Variable: 5: OnCall, SRE
      Roll Back Faulty Deployment: 4: SRE
    section Post-Mortem
      Draft Blameless PIR Template: 5: OnCall, Lead
      Sync Report to GitHub Repo: 5: OnCall`,
    snippets: [
      { label: '+ Journey Step', snippet: '\n      Verify Metrics Recovery: 5: OnCall' }
    ]
  },
  {
    id: 'pie',
    label: 'Pie Chart',
    category: 'Planning & Charts',
    description: 'Proportional breakdown chart with numeric data labels.',
    code: `pie showData
    title Workspace Document Distribution by Status
    "Published" : 45
    "In Review" : 25
    "Draft" : 20
    "Archived" : 10`,
    snippets: [
      { label: '+ Slice', snippet: '\n    "Security Approved" : 15' }
    ]
  }
]

/**
 * Crisp SVG Icon for Flowchart Node Shapes (Visio-style stencil icons)
 */
const ShapeStencilIcon: React.FC<{ shape: VisualMermaidNodeShape; className?: string }> = ({
  shape,
  className = 'w-4 h-3.5 shrink-0'
}) => {
  switch (shape) {
    case 'rect':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <rect
            x="2"
            y="2.5"
            width="20"
            height="13"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.14"
          />
        </svg>
      )
    case 'round':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <rect
            x="2"
            y="2.5"
            width="20"
            height="13"
            rx="6.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.14"
          />
        </svg>
      )
    case 'diamond':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <polygon
            points="12,1.5 22.5,9 12,16.5 1.5,9"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.14"
          />
        </svg>
      )
    case 'cylinder':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <path
            d="M4 5C4 3.34 7.58 2 12 2C16.42 2 20 3.34 20 5V13C20 14.66 16.42 16 12 16C7.58 16 4 14.66 4 13V5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="currentColor"
            fillOpacity="0.14"
          />
          <ellipse cx="12" cy="5" rx="8" ry="2.6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'circle':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <circle
            cx="12"
            cy="9"
            r="7"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.14"
          />
        </svg>
      )
    case 'subroutine':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <rect
            x="2"
            y="2.5"
            width="20"
            height="13"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="currentColor"
            fillOpacity="0.14"
          />
          <line x1="5.5" y1="2.5" x2="5.5" y2="15.5" stroke="currentColor" strokeWidth="1.8" />
          <line x1="18.5" y1="2.5" x2="18.5" y2="15.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'hexagon':
      return (
        <svg viewBox="0 0 24 18" fill="none" className={className}>
          <polygon
            points="6,2.5 18,2.5 22.5,9 18,15.5 6,15.5 1.5,9"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.14"
          />
        </svg>
      )
  }
}

/**
 * Crisp SVG Icon for Flowchart Connector / Arrow Styles
 */
const ArrowStyleIcon: React.FC<{ style: VisualMermaidEdgeStyle; className?: string }> = ({
  style,
  className = 'w-6 h-3.5 shrink-0'
}) => {
  switch (style) {
    case '-->':
      return (
        <svg viewBox="0 0 28 14" fill="none" className={className}>
          <line x1="2" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="2" />
          <polygon points="20,3 26.5,7 20,11" fill="currentColor" />
        </svg>
      )
    case '-.->':
      return (
        <svg viewBox="0 0 28 14" fill="none" className={className}>
          <line
            x1="2"
            y1="7"
            x2="21"
            y2="7"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3.5 2.5"
          />
          <polygon points="20,3 26.5,7 20,11" fill="currentColor" />
        </svg>
      )
    case '==>':
      return (
        <svg viewBox="0 0 28 14" fill="none" className={className}>
          <line x1="2" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="3.6" />
          <polygon points="19,2.2 27,7 19,11.8" fill="currentColor" />
        </svg>
      )
    case '<-->':
      return (
        <svg viewBox="0 0 28 14" fill="none" className={className}>
          <polygon points="7,3 1.5,7 7,11" fill="currentColor" />
          <line x1="6" y1="7" x2="22" y2="7" stroke="currentColor" strokeWidth="2" />
          <polygon points="21,3 26.5,7 21,11" fill="currentColor" />
        </svg>
      )
    case '---':
      return (
        <svg viewBox="0 0 28 14" fill="none" className={className}>
          <line x1="2" y1="7" x2="26" y2="7" stroke="currentColor" strokeWidth="2" />
          <circle cx="4" cy="7" r="2" fill="currentColor" />
          <circle cx="24" cy="7" r="2" fill="currentColor" />
        </svg>
      )
  }
}

/**
 * Strips YAML frontmatter (`---\n...\n---`) and `%%{init: ...}%%` directives
 * to inspect the first Mermaid diagram keyword.
 */
export function detectMermaidDiagramType(code?: string): string {
  if (!code || !code.trim()) return 'flowchart'
  const withoutFrontmatter = code
    .trim()
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/^%%\{[\s\S]*?\}%%\r?\n?/, '')
    .trim()
  const firstLine =
    withoutFrontmatter
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('%%')) || ''

  if (/^(?:flowchart|graph)\b/i.test(firstLine)) return 'flowchart'
  if (/^sequenceDiagram\b/i.test(firstLine)) return 'sequence'
  if (/^architecture(?:-beta)?\b/i.test(firstLine)) return 'architecture'
  if (/^block(?:-beta)?\b/i.test(firstLine)) return 'block'
  if (/^kanban\b/i.test(firstLine)) return 'kanban'
  if (/^erDiagram\b/i.test(firstLine)) return 'er'
  if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) return 'state'
  if (/^classDiagram\b/i.test(firstLine)) return 'class'
  if (/^mindmap\b/i.test(firstLine)) return 'mindmap'
  if (/^timeline\b/i.test(firstLine)) return 'timeline'
  if (/^gitGraph\b/i.test(firstLine)) return 'gitGraph'
  if (/^gantt\b/i.test(firstLine)) return 'gantt'
  if (/^quadrantChart\b/i.test(firstLine)) return 'quadrant'
  if (/^xychart(?:-beta)?\b/i.test(firstLine)) return 'xychart'
  if (/^sankey(?:-beta)?\b/i.test(firstLine)) return 'sankey'
  if (/^journey\b/i.test(firstLine)) return 'journey'
  if (/^pie\b/i.test(firstLine)) return 'pie'
  return 'custom'
}

export function generateMermaidFromVisualGraph(
  direction: 'LR' | 'TD',
  nodes: VisualMermaidNode[],
  edges: VisualMermaidEdge[]
): string {
  const lines: string[] = [`flowchart ${direction}`]
  for (const n of nodes) {
    const safeLabel = n.label.replace(/"/g, "'")
    let formatted = `${n.id}["${safeLabel}"]`
    if (n.shape === 'round') formatted = `${n.id}("${safeLabel}")`
    else if (n.shape === 'diamond') formatted = `${n.id}{"${safeLabel}"}`
    else if (n.shape === 'cylinder') formatted = `${n.id}[("${safeLabel}")]`
    else if (n.shape === 'circle') formatted = `${n.id}(("${safeLabel}"))`
    else if (n.shape === 'subroutine') formatted = `${n.id}[["${safeLabel}"]]`
    else if (n.shape === 'hexagon') formatted = `${n.id}{{"${safeLabel}"}}`
    lines.push(`    ${formatted}`)
  }
  for (const e of edges) {
    const cleanLabel = e.label.trim().replace(/"/g, "'")
    if (cleanLabel) {
      lines.push(`    ${e.from} ${e.style}|"${cleanLabel}"| ${e.to}`)
    } else {
      lines.push(`    ${e.from} ${e.style} ${e.to}`)
    }
  }
  return lines.join('\n')
}

function parseNodeToken(rawToken: string): {
  id: string
  label?: string
  shape?: VisualMermaidNodeShape
} | null {
  const token = rawToken.trim()
  if (!token) return null

  // Match ID[["Label"]] - subroutine
  const subMatch = token.match(/^([A-Za-z0-9_-]+)\s*\[\[\s*"?([^"]*?)"?\s*\]\]$/)
  if (subMatch) {
    return { id: subMatch[1], label: subMatch[2], shape: 'subroutine' }
  }

  // Match ID{{"Label"}} - hexagon
  const hexMatch = token.match(/^([A-Za-z0-9_-]+)\s*\{\{\s*"?([^"]*?)"?\s*\}\}$/)
  if (hexMatch) {
    return { id: hexMatch[1], label: hexMatch[2], shape: 'hexagon' }
  }

  // Match ID[("Label")] - cylinder
  const cylMatch = token.match(/^([A-Za-z0-9_-]+)\s*\[\(\s*"?([^"]*?)"?\s*\)\]$/)
  if (cylMatch) {
    return { id: cylMatch[1], label: cylMatch[2], shape: 'cylinder' }
  }

  // Match ID(("Label")) - circle
  const cirMatch = token.match(/^([A-Za-z0-9_-]+)\s*\(\(\s*"?([^"]*?)"?\s*\)\)$/)
  if (cirMatch) {
    return { id: cirMatch[1], label: cirMatch[2], shape: 'circle' }
  }

  // Match ID{"Label"} - diamond
  const diaMatch = token.match(/^([A-Za-z0-9_-]+)\s*\{\s*"?([^"]*?)"?\s*\}$/)
  if (diaMatch) {
    return { id: diaMatch[1], label: diaMatch[2], shape: 'diamond' }
  }

  // Match ID("Label") - round
  const rndMatch = token.match(/^([A-Za-z0-9_-]+)\s*\(\s*"?([^"]*?)"?\s*\)$/)
  if (rndMatch) {
    return { id: rndMatch[1], label: rndMatch[2], shape: 'round' }
  }

  // Match ID["Label"] - rect
  const rectMatch = token.match(/^([A-Za-z0-9_-]+)\s*\[\s*"?([^"]*?)"?\s*\]$/)
  if (rectMatch) {
    return { id: rectMatch[1], label: rectMatch[2], shape: 'rect' }
  }

  // Bare node ID
  const bareMatch = token.match(/^([A-Za-z0-9_-]+)$/)
  if (bareMatch) {
    return { id: bareMatch[1] }
  }

  return null
}

export function parseMermaidToVisualGraph(code?: string): {
  direction: 'LR' | 'TD'
  nodes: VisualMermaidNode[]
  edges: VisualMermaidEdge[]
} {
  const emptyGraph: {
    direction: 'LR' | 'TD'
    nodes: VisualMermaidNode[]
    edges: VisualMermaidEdge[]
  } = {
    direction: 'LR',
    nodes: [],
    edges: []
  }

  if (!code || !code.trim()) return emptyGraph
  if (detectMermaidDiagramType(code) !== 'flowchart') {
    return emptyGraph
  }

  let direction: 'LR' | 'TD' = 'LR'
  const nodeMap = new Map<
    string,
    { id: string; label: string; shape: VisualMermaidNodeShape }
  >()
  const edges: VisualMermaidEdge[] = []

  const upsertNode = (parsed: {
    id: string
    label?: string
    shape?: VisualMermaidNodeShape
  }) => {
    const existing = nodeMap.get(parsed.id)
    if (!existing) {
      nodeMap.set(parsed.id, {
        id: parsed.id,
        label: parsed.label || parsed.id,
        shape: parsed.shape || 'rect'
      })
    } else {
      if (parsed.label) existing.label = parsed.label
      if (parsed.shape) existing.shape = parsed.shape
    }
  }

  const lines = code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))

  for (const line of lines) {
    const dirMatch = line.match(/^(?:flowchart|graph)\s+(LR|TD|TB|RL|BT)/i)
    if (dirMatch) {
      const d = dirMatch[1].toUpperCase()
      direction = d === 'TD' || d === 'TB' || d === 'BT' ? 'TD' : 'LR'
      continue
    }

    // Check if line contains an edge arrow: <--> , --> , -.-> , ==> , --- with optional |"label"|
    const edgeMatch = line.match(
      /^(.+?)\s*(<-->|-->|-\.->|==>|---)\s*(?:\|\s*"?([^"|]*?)"?\s*\|\s*)?(.+)$/
    )
    if (edgeMatch) {
      const [, leftRaw, arrowRaw, edgeLabelRaw, rightRaw] = edgeMatch
      const leftNode = parseNodeToken(leftRaw)
      const rightNode = parseNodeToken(rightRaw)
      if (leftNode && rightNode) {
        upsertNode(leftNode)
        upsertNode(rightNode)
        edges.push({
          id: `E${edges.length + 1}`,
          from: leftNode.id,
          to: rightNode.id,
          style: arrowRaw as VisualMermaidEdgeStyle,
          label: (edgeLabelRaw || '').trim()
        })
        continue
      }
    }

    // Otherwise check standalone node definition
    const standalone = parseNodeToken(line)
    if (standalone) {
      upsertNode(standalone)
    }
  }

  if (nodeMap.size === 0) {
    return { ...emptyGraph, direction }
  }

  const nodeArray = Array.from(nodeMap.values())
  const positionedNodes: VisualMermaidNode[] = nodeArray.map((n, idx) => {
    if (direction === 'LR') {
      const col = idx % 3
      const row = Math.floor(idx / 3)
      return {
        ...n,
        x: 60 + col * 220,
        y: 60 + row * 115
      }
    } else {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      return {
        ...n,
        x: 140 + col * 250,
        y: 45 + row * 95
      }
    }
  })

  return {
    direction,
    nodes: positionedNodes,
    edges
  }
}

/**
 * Computes smart boundary anchor points between two 136x54 flowchart nodes
 * so edges connect cleanly to node edges (like Visio) instead of cutting through centers.
 */
function computeSmartEdgeEndpoints(
  fromNode: VisualMermaidNode,
  toNode: VisualMermaidNode,
  w = 136,
  h = 54
): { x1: number; y1: number; x2: number; y2: number; mx: number; my: number } {
  const cx1 = fromNode.x + w / 2
  const cy1 = fromNode.y + h / 2
  const cx2 = toNode.x + w / 2
  const cy2 = toNode.y + h / 2
  const dx = cx2 - cx1
  const dy = cy2 - cy1

  let x1 = cx1
  let y1 = cy1
  let x2 = cx2
  let y2 = cy2

  if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
    // Horizontal connection (Right -> Left or Left -> Right)
    if (dx >= 0) {
      x1 = fromNode.x + w
      y1 = cy1
      x2 = toNode.x
      y2 = cy2
    } else {
      x1 = fromNode.x
      y1 = cy1
      x2 = toNode.x + w
      y2 = cy2
    }
  } else {
    // Vertical connection (Bottom -> Top or Top -> Bottom)
    if (dy >= 0) {
      x1 = cx1
      y1 = fromNode.y + h
      x2 = cx2
      y2 = toNode.y
    } else {
      x1 = cx1
      y1 = fromNode.y
      x2 = cx2
      y2 = toNode.y + h
    }
  }

  return {
    x1,
    y1,
    x2,
    y2,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2
  }
}

export const VisualMermaidBuilderModal: React.FC<{
  initialCode?: string
  theme: 'light' | 'dark'
  onInsertOrUpdateMermaid: (mermaidCode: string) => void
  onClose: () => void
}> = ({ initialCode, theme, onInsertOrUpdateMermaid, onClose }) => {
  const initialDetectedType = detectMermaidDiagramType(initialCode)
  const initialGraph = parseMermaidToVisualGraph(initialCode)

  const [activePresetId, setActivePresetId] = useState<string>(initialDetectedType)
  const [direction, setDirection] = useState<'LR' | 'TD'>(initialGraph.direction)
  const [nodes, setNodes] = useState<VisualMermaidNode[]>(initialGraph.nodes)
  const [edges, setEdges] = useState<VisualMermaidEdge[]>(initialGraph.edges)

  // Live Mermaid source code (supports all 17 Mermaid diagram types, frontmatter, and directives)
  const [customCode, setCustomCode] = useState<string>(() => {
    if (initialCode && initialCode.trim()) {
      return initialCode.trim()
    }
    return generateMermaidFromVisualGraph(
      initialGraph.direction,
      initialGraph.nodes,
      initialGraph.edges
    )
  })
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState<boolean>(
    () => initialDetectedType !== 'flowchart'
  )

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialGraph.nodes[0]?.id || null
  )
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const [edgeStyleToCreate, setEdgeStyleToCreate] = useState<VisualMermaidEdgeStyle>('-->')

  // Visio-style 2D Visual Canvas Controls (Pan, Zoom, Tool Mode, Snap-to-Grid, Inline Editing)
  const [canvasTool, setCanvasTool] = useState<'select' | 'pan'>('select')
  const [canvasZoom, setCanvasZoom] = useState<number>(1)
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [inlineEditingNodeId, setInlineEditingNodeId] = useState<string | null>(null)
  const [inlineEditingEdgeId, setInlineEditingEdgeId] = useState<string | null>(null)
  const [rubberBandCursor, setRubberBandCursor] = useState<{ x: number; y: number } | null>(null)

  const canvasPanDragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  // Live Output Preview Controls (Pan, Zoom, Grid, Theme)
  const [previewSvg, setPreviewSvg] = useState<string>('')
  const [syntaxError, setSyntaxError] = useState<string | null>(null)
  const [previewGrid, setPreviewGrid] = useState<boolean>(true)
  const [previewZoom, setPreviewZoom] = useState<number>(1)
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [previewMermaidTheme, setPreviewMermaidTheme] = useState<MermaidPreviewTheme>('auto')
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false)
  const previewPanDragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  // Flexible Resizable Workspace Layout State:
  // 1. Main Modal Window Dimensions + Maximize Toggle
  const [isMaximized, setIsMaximized] = useState<boolean>(false)
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>(() => ({
    width: Math.min(1440, Math.max(920, window.innerWidth - 36)),
    height: Math.min(900, Math.max(620, window.innerHeight - 36))
  }))
  // 2. Horizontal Split Ratio between Visual Builder (left %) and Live Output Preview (right %)
  const [leftPanePercent, setLeftPanePercent] = useState<number>(52)
  // 3. Vertical Split Height & Collapse Toggle for Mermaid Code Drawer
  const [codeDrawerHeight, setCodeDrawerHeight] = useState<number>(125)
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState<boolean>(true)

  const workspaceContainerRef = useRef<HTMLDivElement | null>(null)
  const leftColumnRef = useRef<HTMLDivElement | null>(null)
  const splitDragRef = useRef<
    | { type: 'horizontal'; startX: number; startPercent: number }
    | { type: 'vertical'; startY: number; startHeight: number }
    | null
  >(null)

  const modalResizeRef = useRef<{
    dir: 'right' | 'left' | 'bottom' | 'top' | 'corner'
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (modalResizeRef.current) {
        const { dir, startX, startY, startW, startH } = modalResizeRef.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        setIsMaximized(false)
        setModalSize((prev) => ({
          width:
            dir === 'right' || dir === 'corner'
              ? Math.max(720, Math.min(window.innerWidth - 16, startW + dx * 2))
              : dir === 'left'
                ? Math.max(720, Math.min(window.innerWidth - 16, startW - dx * 2))
                : prev.width,
          height:
            dir === 'bottom' || dir === 'corner'
              ? Math.max(480, Math.min(window.innerHeight - 16, startH + dy * 2))
              : dir === 'top'
                ? Math.max(480, Math.min(window.innerHeight - 16, startH - dy * 2))
                : prev.height
        }))
      }
      if (splitDragRef.current) {
        if (splitDragRef.current.type === 'horizontal' && workspaceContainerRef.current) {
          const rect = workspaceContainerRef.current.getBoundingClientRect()
          const deltaX = e.clientX - splitDragRef.current.startX
          const deltaPct = (deltaX / Math.max(1, rect.width)) * 100
          setLeftPanePercent(
            Math.max(22, Math.min(78, Math.round(splitDragRef.current.startPercent + deltaPct)))
          )
        } else if (splitDragRef.current.type === 'vertical') {
          const deltaY = splitDragRef.current.startY - e.clientY
          setCodeDrawerHeight(
            Math.max(75, Math.min(360, Math.round(splitDragRef.current.startHeight + deltaY)))
          )
        }
      }
      if (previewPanDragRef.current) {
        const { startX, startY, originX, originY } = previewPanDragRef.current
        setPreviewPan({
          x: originX + (e.clientX - startX),
          y: originY + (e.clientY - startY)
        })
      }
      if (canvasPanDragRef.current) {
        const { startX, startY, originX, originY } = canvasPanDragRef.current
        setCanvasPan({
          x: originX + (e.clientX - startX),
          y: originY + (e.clientY - startY)
        })
      }
    }
    const onWindowMouseUp = () => {
      modalResizeRef.current = null
      splitDragRef.current = null
      previewPanDragRef.current = null
      canvasPanDragRef.current = null
    }
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [])

  useEffect(() => {
    const detected = detectMermaidDiagramType(initialCode)
    setActivePresetId(detected)
    const parsed = parseMermaidToVisualGraph(initialCode)
    setDirection(parsed.direction)
    setNodes(parsed.nodes)
    setEdges(parsed.edges)
    setSelectedNodeId(parsed.nodes[0]?.id || null)
    setSelectedEdgeId(null)
    if (initialCode && initialCode.trim()) {
      setCustomCode(initialCode.trim())
      setIsCodeManuallyEdited(detected !== 'flowchart')
    } else {
      setCustomCode(generateMermaidFromVisualGraph(parsed.direction, parsed.nodes, parsed.edges))
      setIsCodeManuallyEdited(false)
    }
  }, [initialCode])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const effectiveModalW = isMaximized ? window.innerWidth - 16 : modalSize.width
  const effectiveModalH = isMaximized ? window.innerHeight - 16 : modalSize.height

  // Dynamically expand drawing canvas based on node positions AND resizable pane size
  const maxNodeRight = nodes.reduce((acc, n) => Math.max(acc, n.x + 260), 820)
  const maxNodeBottom = nodes.reduce((acc, n) => Math.max(acc, n.y + 180), 480)
  const canvasWidth = Math.max(
    820,
    Math.round(effectiveModalW * (leftPanePercent / 100)),
    maxNodeRight
  )
  const canvasHeight = Math.max(
    460,
    Math.round(effectiveModalH - (isCodeDrawerOpen ? codeDrawerHeight + 210 : 190)),
    maxNodeBottom
  )

  const visualFlowchartCode = generateMermaidFromVisualGraph(direction, nodes, edges)
  const effectiveMermaidCode = isCodeManuallyEdited ? customCode : visualFlowchartCode

  // Sync visual graph edits into customCode whenever in visual flowchart mode
  useEffect(() => {
    if (!isCodeManuallyEdited) {
      setCustomCode(visualFlowchartCode)
    }
  }, [visualFlowchartCode, isCodeManuallyEdited])

  useEffect(() => {
    if (!effectiveMermaidCode.trim() || (!isCodeManuallyEdited && nodes.length === 0)) {
      setPreviewSvg('')
      setSyntaxError(null)
      return
    }
    let cancelled = false
    renderCachedMermaidSvg(effectiveMermaidCode, theme, previewMermaidTheme)
      .then((sanitized) => {
        if (!cancelled) {
          setPreviewSvg(sanitized)
          setSyntaxError(null)
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setSyntaxError(err?.message || 'Invalid Mermaid syntax')
        }
      })
    return () => {
      cancelled = true
    }
  }, [effectiveMermaidCode, isCodeManuallyEdited, nodes.length, theme, previewMermaidTheme])

  const selectDiagramPreset = (preset: MermaidDiagramPreset) => {
    setActivePresetId(preset.id)
    setPreviewZoom(1)
    setPreviewPan({ x: 0, y: 0 })
    setCanvasZoom(1)
    setCanvasPan({ x: 0, y: 0 })
    if (preset.id === 'flowchart') {
      const parsed = parseMermaidToVisualGraph(preset.code)
      setDirection(parsed.direction)
      setNodes(parsed.nodes)
      setEdges(parsed.edges)
      setSelectedNodeId(parsed.nodes[0]?.id || null)
      setSelectedEdgeId(null)
      setCustomCode(preset.code)
      setIsCodeManuallyEdited(false)
    } else {
      setCustomCode(preset.code)
      setIsCodeManuallyEdited(true)
    }
  }

  const handleCodeEditorChange = (nextCode: string) => {
    setCustomCode(nextCode)
    const detected = detectMermaidDiagramType(nextCode)
    setActivePresetId(detected)
    if (detected === 'flowchart') {
      const parsed = parseMermaidToVisualGraph(nextCode)
      if (parsed.nodes.length > 0) {
        setDirection(parsed.direction)
        setNodes(parsed.nodes)
        setEdges(parsed.edges)
      }
    }
    setIsCodeManuallyEdited(true)
  }

  const appendSnippetToCode = (snippet: string) => {
    const base = effectiveMermaidCode.trimEnd()
    const updated = `${base}${snippet}`
    handleCodeEditorChange(updated)
  }

  const toCanvasCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 60, y: 60 }
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = canvasWidth / Math.max(1, rect.width)
    const scaleY = canvasHeight / Math.max(1, rect.height)
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const snapCoord = (val: number) => (snapToGrid ? Math.round(val / 16) * 16 : Math.round(val))

  const addNode = (
    shape: VisualMermaidNodeShape,
    customX?: number,
    customY?: number,
    connectFromNodeId?: string
  ) => {
    const nextIdx = nodes.length + 1
    const id = `N${Date.now().toString(36).slice(-3).toUpperCase()}${nextIdx}`
    const defaultLabels: Record<VisualMermaidNodeShape, string> = {
      rect: `Process ${nextIdx}`,
      round: `Step ${nextIdx}`,
      diamond: `Decision ${nextIdx}?`,
      cylinder: `Database ${nextIdx}`,
      circle: `Event ${nextIdx}`,
      subroutine: `Subroutine ${nextIdx}`,
      hexagon: `Prepare ${nextIdx}`
    }
    const col = nodes.length % 3
    const row = Math.floor(nodes.length / 3)
    const rawX = customX !== undefined ? customX : 64 + col * 210
    const rawY = customY !== undefined ? customY : 64 + row * 110
    const newNode: VisualMermaidNode = {
      id,
      label: defaultLabels[shape],
      shape,
      x: Math.max(16, snapCoord(rawX)),
      y: Math.max(16, snapCoord(rawY))
    }
    setIsCodeManuallyEdited(false)
    setActivePresetId('flowchart')
    setNodes((prev) => [...prev, newNode])
    if (connectFromNodeId) {
      const newEdge: VisualMermaidEdge = {
        id: `E-${Date.now()}`,
        from: connectFromNodeId,
        to: id,
        style: edgeStyleToCreate,
        label: ''
      }
      setEdges((prev) => [...prev, newEdge])
    }
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }

  const autoLayoutNodes = (targetDir: 'LR' | 'TD' = direction) => {
    setIsCodeManuallyEdited(false)
    setDirection(targetDir)
    setNodes((prev) =>
      prev.map((n, idx) => {
        if (targetDir === 'LR') {
          const col = idx % 3
          const row = Math.floor(idx / 3)
          return { ...n, x: 64 + col * 224, y: 64 + row * 112 }
        } else {
          const col = idx % 2
          const row = Math.floor(idx / 2)
          return { ...n, x: 144 + col * 256, y: 48 + row * 104 }
        }
      })
    )
    setCanvasPan({ x: 0, y: 0 })
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pt = toCanvasCoords(e.clientX, e.clientY)
    if (connectSourceId) {
      setRubberBandCursor(pt)
    }
    if (!draggingNodeRef.current) return
    const { id, offsetX, offsetY } = draggingNodeRef.current
    setIsCodeManuallyEdited(false)
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              x: Math.max(16, snapCoord(pt.x - offsetX)),
              y: Math.max(16, snapCoord(pt.y - offsetY))
            }
          : n
      )
    )
  }

  const completeConnectionToNode = (targetNodeId: string) => {
    if (!connectSourceId || connectSourceId === targetNodeId) {
      setConnectSourceId(null)
      setRubberBandCursor(null)
      return
    }
    const newEdge: VisualMermaidEdge = {
      id: `E-${Date.now()}`,
      from: connectSourceId,
      to: targetNodeId,
      style: edgeStyleToCreate,
      label: ''
    }
    setIsCodeManuallyEdited(false)
    setEdges((prev) => [...prev, newEdge])
    setSelectedEdgeId(newEdge.id)
    setSelectedNodeId(null)
    setConnectSourceId(null)
    setRubberBandCursor(null)
  }

  const handleNodeClick = (nodeId: string) => {
    if (connectSourceId) {
      completeConnectionToNode(nodeId)
      return
    }
    setSelectedNodeId(nodeId)
    setSelectedEdgeId(null)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null
  const connectOriginNode = nodes.find((n) => n.id === connectSourceId) || null
  const currentPreset =
    MERMAID_DIAGRAM_PRESETS.find((p) => p.id === activePresetId) || MERMAID_DIAGRAM_PRESETS[0]
  const isFlowchartMode = activePresetId === 'flowchart'

  const shapeStencilButtons: {
    shape: VisualMermaidNodeShape
    testId: string
    label: string
    hint: string
  }[] = [
    { shape: 'rect', testId: 'mermaid-add-rect', label: 'Process', hint: 'Process Rectangle ["..."]' },
    { shape: 'round', testId: 'mermaid-add-round', label: 'Rounded', hint: 'Rounded Step ("...")' },
    { shape: 'diamond', testId: 'mermaid-add-diamond', label: 'Decision', hint: 'Decision Diamond {"..."}' },
    { shape: 'cylinder', testId: 'mermaid-add-cylinder', label: 'Database', hint: 'Database Cylinder [("...")]' },
    { shape: 'circle', testId: 'mermaid-add-circle', label: 'Circle', hint: 'Circle Event Node (("..."))' },
    { shape: 'subroutine', testId: 'mermaid-add-subroutine', label: 'Subroutine', hint: 'Subroutine [["..."]]' },
    { shape: 'hexagon', testId: 'mermaid-add-hexagon', label: 'Hexagon', hint: 'Preparation Hexagon {{"..."}}' }
  ]

  const arrowStyleButtons: {
    style: VisualMermaidEdgeStyle
    testId: string
    label: string
    hint: string
  }[] = [
    { style: '-->', testId: 'mermaid-arrow-solid', label: 'Solid', hint: 'Solid Directed Arrow (-->)' },
    { style: '-.->', testId: 'mermaid-arrow-dashed', label: 'Dashed', hint: 'Dashed Dotted Arrow (-.->)' },
    { style: '==>', testId: 'mermaid-arrow-thick', label: 'Thick', hint: 'Bold Thick Arrow (==>)' },
    { style: '<-->', testId: 'mermaid-arrow-bi', label: 'Two-Way', hint: 'Bi-directional Arrow (<-->)' },
    { style: '---', testId: 'mermaid-arrow-line', label: 'Line', hint: 'Undirected Line Link (---)' }
  ]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-2"
      data-testid="visual-mermaid-builder-modal"
    >
      <div
        data-testid="visual-mermaid-builder-window"
        style={{
          width: isMaximized ? 'calc(100vw - 16px)' : `${modalSize.width}px`,
          height: isMaximized ? 'calc(100vh - 16px)' : `${modalSize.height}px`,
          minWidth: '720px',
          minHeight: '480px',
          maxWidth: '99vw',
          maxHeight: '98vh',
          resize: 'both'
        }}
        className="relative bg-panel border border-subtle rounded-lg shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Professional Studio Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <GitCommit className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-primary">
                  Visual Diagram Studio
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-panel border border-subtle text-muted font-medium">
                  {MERMAID_DIAGRAM_PRESETS.length} Diagram Types • Visio-Style Canvas &amp; Live Output
                </span>
              </div>
            </div>
          </div>

          {/* Center Layout Split Presets */}
          <div className="hidden md:flex items-center gap-1 bg-panel border border-subtle rounded p-0.5 text-[11px]">
            <span className="px-2 text-muted font-medium">Layout:</span>
            <button
              type="button"
              onClick={() => setLeftPanePercent(68)}
              className={`px-2 py-0.5 rounded transition-colors ${
                leftPanePercent > 58
                  ? 'bg-accent text-white font-medium'
                  : 'text-primary hover:bg-secondary'
              }`}
              title="Expand Visual Canvas (68% / 32%)"
            >
              Focus Canvas
            </button>
            <button
              type="button"
              onClick={() => setLeftPanePercent(50)}
              className={`px-2 py-0.5 rounded transition-colors ${
                leftPanePercent >= 42 && leftPanePercent <= 58
                  ? 'bg-accent text-white font-medium'
                  : 'text-primary hover:bg-secondary'
              }`}
              title="Balanced Split View (50% / 50%)"
            >
              50 / 50 Split
            </button>
            <button
              type="button"
              onClick={() => setLeftPanePercent(32)}
              className={`px-2 py-0.5 rounded transition-colors ${
                leftPanePercent < 42
                  ? 'bg-accent text-white font-medium'
                  : 'text-primary hover:bg-secondary'
              }`}
              title="Expand Rendered Output Preview (32% / 68%)"
            >
              Focus Output
            </button>
            <button
              type="button"
              data-testid="mermaid-toggle-code-drawer"
              onClick={() => setIsCodeDrawerOpen((v) => !v)}
              className={`px-2 py-0.5 rounded border-l border-subtle ml-0.5 transition-colors ${
                isCodeDrawerOpen ? 'text-accent font-medium' : 'text-muted hover:text-primary'
              }`}
              title="Show or Hide the Mermaid Code Drawer to maximize canvas height"
            >
              {isCodeDrawerOpen ? 'Hide Code' : 'Show Code'}
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="mermaid-maximize-btn"
              onClick={() => setIsMaximized((v) => !v)}
              className="px-2.5 py-1 text-xs rounded bg-panel border border-subtle text-primary hover:border-accent"
              title={isMaximized ? 'Restore Window Size' : 'Maximize Diagram Studio Window'}
            >
              {isMaximized ? 'Restore Size' : 'Maximize'}
            </button>
            <button
              type="button"
              data-testid="mermaid-copy-code-btn"
              onClick={() => {
                navigator.clipboard?.writeText(effectiveMermaidCode).catch(() => {})
                setCopiedFeedback(true)
                setTimeout(() => setCopiedFeedback(false), 1500)
              }}
              className="px-2.5 py-1 text-xs rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              {copiedFeedback ? 'Copied Code!' : 'Copy Code'}
            </button>
            <button
              type="button"
              data-testid="mermaid-builder-insert-btn"
              onClick={() => {
                onInsertOrUpdateMermaid(effectiveMermaidCode)
                onClose()
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-accent text-white hover:opacity-90 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insert / Update Diagram</span>
            </button>
            <button
              type="button"
              data-testid="mermaid-builder-close-btn"
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Close
            </button>
          </div>
        </div>

        {/* Diagram Type Gallery Ribbon */}
        <div
          data-testid="mermaid-preset-gallery"
          className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary/40 border-b border-subtle overflow-x-auto shrink-0 text-xs"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mr-1 shrink-0">
            Diagram Type:
          </span>
          {MERMAID_DIAGRAM_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`mermaid-preset-${preset.id}`}
                onClick={() => selectDiagramPreset(preset)}
                title={`${preset.label} — ${preset.description}`}
                className={`px-2.5 py-1 rounded border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-accent text-white border-accent shadow-2xs'
                    : 'bg-panel border-subtle text-primary hover:border-accent'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        {/* Visio-Style Shape & Connector Stencil Ribbon */}
        <div
          data-testid="mermaid-draggable-palette"
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-app border-b border-subtle text-xs shrink-0"
        >
          {isFlowchartMode ? (
            <>
              {/* Shape Stencil Buttons with SVG Shape Icons */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
                  Shapes:
                </span>
                {shapeStencilButtons.map((item) => (
                  <button
                    key={item.shape}
                    type="button"
                    draggable
                    data-testid={item.testId}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/klartext-mermaid-shape', item.shape)
                    }}
                    onClick={() => addNode(item.shape)}
                    title={`${item.hint} — Click to add or drag onto canvas`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent hover:bg-secondary/50 text-primary font-medium cursor-grab active:cursor-grabbing shadow-2xs transition-colors"
                  >
                    <ShapeStencilIcon shape={item.shape} className="w-4 h-3.5 text-accent" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Arrow Style Stencil Buttons with SVG Arrow Icons + Layout Direction */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-0.5">
                  Connectors:
                </span>
                <div className="flex items-center bg-panel border border-subtle rounded p-0.5 gap-0.5">
                  {arrowStyleButtons.map((arr) => {
                    const isActive =
                      (selectedEdge ? selectedEdge.style : edgeStyleToCreate) === arr.style
                    return (
                      <button
                        key={arr.style}
                        type="button"
                        data-testid={arr.testId}
                        onClick={() => {
                          setEdgeStyleToCreate(arr.style)
                          if (selectedEdgeId) {
                            setIsCodeManuallyEdited(false)
                            setEdges((prev) =>
                              prev.map((ed) =>
                                ed.id === selectedEdgeId ? { ...ed, style: arr.style } : ed
                              )
                            )
                          }
                        }}
                        title={arr.hint}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          isActive
                            ? 'bg-accent text-white shadow-2xs'
                            : 'text-primary hover:bg-secondary'
                        }`}
                      >
                        <ArrowStyleIcon style={arr.style} className="w-5 h-3" />
                        <span>{arr.label}</span>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  data-testid="mermaid-connect-mode-btn"
                  onClick={() => {
                    if (connectSourceId) {
                      setConnectSourceId(null)
                      setRubberBandCursor(null)
                    } else if (selectedNodeId) {
                      setConnectSourceId(selectedNodeId)
                    } else if (nodes[0]) {
                      setConnectSourceId(nodes[0].id)
                    }
                  }}
                  className={`px-2.5 py-1 rounded border font-medium transition-colors ${
                    connectSourceId
                      ? 'bg-accent text-white border-accent shadow-2xs'
                      : 'bg-panel border-subtle text-primary hover:border-accent'
                  }`}
                  title="Click to start connecting from the selected node, or drag directly from any node's port handle"
                >
                  {connectSourceId ? `Connecting from ${connectSourceId}...` : 'Connect Node →'}
                </button>

                <select
                  value={direction}
                  onChange={(e) => {
                    const nextDir = e.target.value as 'LR' | 'TD'
                    setIsCodeManuallyEdited(false)
                    setDirection(nextDir)
                  }}
                  className="px-2 py-1 rounded bg-panel border border-subtle text-primary font-medium"
                  title="Flowchart Orientation"
                >
                  <option value="LR">⇄ Left → Right (LR)</option>
                  <option value="TD">⇅ Top → Down (TD)</option>
                </select>

                <button
                  type="button"
                  data-testid="mermaid-auto-layout-btn"
                  onClick={() => autoLayoutNodes(direction)}
                  className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
                  title="Auto-arrange nodes into a clean grid"
                >
                  Auto-Layout
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
                  Add {currentPreset.label} Elements:
                </span>
                {(DIAGRAM_PALETTE_ITEMS[activePresetId] || []).map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    draggable
                    data-testid={`mermaid-palette-${pal.id}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'text/klartext-mermaid-palette',
                        pal.defaultPayload
                      )
                    }}
                    onClick={() => {
                      const targetEl = document.querySelector(
                        `[data-testid^="mermaid-visual-"][data-testid$="-builder"]`
                      )
                      if (targetEl) {
                        const dt = new DataTransfer()
                        dt.setData('text/klartext-mermaid-palette', pal.defaultPayload)
                        const dropEvt = new DragEvent('drop', {
                          bubbles: true,
                          cancelable: true,
                          dataTransfer: dt
                        })
                        targetEl.dispatchEvent(dropEvt)
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary font-medium flex items-center gap-1.5 cursor-grab active:cursor-grabbing shadow-2xs"
                    title="Drag and drop onto the visual builder below, or click to add"
                  >
                    <span>{pal.badge}</span>
                    <span>{pal.label}</span>
                  </button>
                ))}
              </div>
              <div
                data-testid="mermaid-quick-snippets"
                className="flex items-center gap-1.5 flex-wrap"
              >
                <span className="text-muted font-medium">Templates:</span>
                {currentPreset.snippets.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => appendSnippetToCode(s.snippet)}
                    className="px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Context-Aware Property Inspector Bar (Selected Shape / Connector Inspector) */}
        <div className="px-4 py-1.5 bg-secondary/50 border-b border-subtle flex flex-wrap items-center justify-between gap-2 text-xs min-h-[38px] shrink-0">
          {isFlowchartMode && selectedNode ? (
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <ShapeStencilIcon shape={selectedNode.shape} className="w-4 h-3.5" />
                  <span>Shape {selectedNode.id}:</span>
                </span>
                <label className="text-muted">Label:</label>
                <input
                  type="text"
                  data-testid="mermaid-node-label-input"
                  value={selectedNode.label}
                  onChange={(e) => {
                    setIsCodeManuallyEdited(false)
                    setNodes((prev) =>
                      prev.map((n) =>
                        n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                      )
                    )
                  }}
                  className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary font-medium w-44 focus:outline-none focus:border-accent"
                />
                <label className="text-muted">Change Shape:</label>
                <div className="flex items-center gap-1">
                  {shapeStencilButtons.map((sh) => (
                    <button
                      key={sh.shape}
                      type="button"
                      onClick={() => {
                        setIsCodeManuallyEdited(false)
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === selectedNode.id ? { ...n, shape: sh.shape } : n
                          )
                        )
                      }}
                      title={`Convert to ${sh.label}`}
                      className={`p-1 rounded border transition-colors ${
                        selectedNode.shape === sh.shape
                          ? 'bg-accent text-white border-accent'
                          : 'bg-panel border-subtle text-primary hover:border-accent'
                      }`}
                    >
                      <ShapeStencilIcon shape={sh.shape} className="w-4 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="mermaid-quick-chain-node-btn"
                  onClick={() => {
                    const offsetX = direction === 'LR' ? selectedNode.x + 210 : selectedNode.x
                    const offsetY = direction === 'TD' ? selectedNode.y + 105 : selectedNode.y
                    addNode(selectedNode.shape, offsetX, offsetY, selectedNode.id)
                  }}
                  className="px-2.5 py-0.5 rounded bg-accent/15 border border-accent/40 text-accent hover:bg-accent hover:text-white font-medium transition-colors"
                  title="Add a new connected node directly after this shape (Visio Quick-Connect)"
                >
                  + Add Connected Shape
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCodeManuallyEdited(false)
                    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id))
                    setEdges((prev) =>
                      prev.filter(
                        (e) => e.from !== selectedNode.id && e.to !== selectedNode.id
                      )
                    )
                    setSelectedNodeId(null)
                  }}
                  className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger hover:border-danger"
                >
                  Delete Shape
                </button>
              </div>
            </div>
          ) : isFlowchartMode && selectedEdge ? (
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <ArrowStyleIcon style={selectedEdge.style} className="w-5 h-3.5" />
                  <span>
                    Connector ({selectedEdge.from} → {selectedEdge.to}):
                  </span>
                </span>
                <label className="text-muted">Label:</label>
                <input
                  type="text"
                  data-testid="mermaid-edge-label-input"
                  value={selectedEdge.label}
                  placeholder="Optional connector label..."
                  onChange={(e) => {
                    setIsCodeManuallyEdited(false)
                    setEdges((prev) =>
                      prev.map((ed) =>
                        ed.id === selectedEdge.id ? { ...ed, label: e.target.value } : ed
                      )
                    )
                  }}
                  className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary w-44 focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCodeManuallyEdited(false)
                    setEdges((prev) =>
                      prev.map((ed) =>
                        ed.id === selectedEdge.id
                          ? { ...ed, from: ed.to, to: ed.from }
                          : ed
                      )
                    )
                  }}
                  className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
                  title="Reverse arrow direction"
                >
                  ⇄ Reverse Direction
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCodeManuallyEdited(false)
                  setEdges((prev) => prev.filter((ed) => ed.id !== selectedEdge.id))
                  setSelectedEdgeId(null)
                }}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-danger hover:border-danger"
              >
                Delete Connector
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <span className="text-muted">
                <strong className="text-primary">{currentPreset.label}:</strong>{' '}
                {currentPreset.description}
              </span>
              <span className="text-accent font-medium text-[11px]">
                {isFlowchartMode
                  ? 'Tip: Drag any ● port on a shape to draw a connector, or double-click a shape/arrow to rename inline'
                  : 'Tip: Drag & drop items in the visual editor below or drag the center divider to resize panes'}
              </span>
            </div>
          )}
        </div>

        {/* Main Flexible Resizable Split Workspace */}
        <div
          ref={workspaceContainerRef}
          className="flex flex-1 min-h-0 bg-app overflow-hidden select-none"
        >
          {/* LEFT PANE: Interactive Visio-Style 2D Canvas (or Structured Visual Builder) + Resizable/Collapsible Code Drawer */}
          <div
            ref={leftColumnRef}
            style={{ width: `${leftPanePercent}%` }}
            className="flex flex-col min-w-[260px] min-h-0 h-full p-3 pr-1.5 gap-2"
          >
            {isFlowchartMode ? (
              <div className="flex flex-col flex-1 min-h-[160px] bg-panel border border-subtle rounded-md overflow-hidden shadow-xs">
                {/* 2D Visual Canvas Viewport Toolbar (Select/Pan Tools, Zoom Controls, Snap Grid) */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-secondary/60 border-b border-subtle text-[11px] shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="mermaid-canvas-tool-select"
                      onClick={() => setCanvasTool('select')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        canvasTool === 'select'
                          ? 'bg-accent text-white border-accent font-medium'
                          : 'bg-panel border-subtle text-primary hover:border-accent'
                      }`}
                      title="Pointer Tool — Select, move shapes, or drag connection ports"
                    >
                      <MousePointer className="w-3 h-3" />
                      <span>Select / Connect</span>
                    </button>
                    <button
                      type="button"
                      data-testid="mermaid-canvas-tool-pan"
                      onClick={() => setCanvasTool('pan')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        canvasTool === 'pan'
                          ? 'bg-accent text-white border-accent font-medium'
                          : 'bg-panel border-subtle text-primary hover:border-accent'
                      }`}
                      title="Hand Tool — Drag anywhere on the canvas to pan"
                    >
                      <span>✋ Pan Canvas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSnapToGrid((v) => !v)}
                      className={`px-2 py-0.5 rounded border transition-colors ${
                        snapToGrid
                          ? 'bg-accent/15 text-accent border-accent/40 font-medium'
                          : 'bg-panel border-subtle text-muted hover:text-primary'
                      }`}
                      title="Snap shapes to 16px alignment grid"
                    >
                      Snap Grid
                    </button>
                  </div>

                  {/* Canvas Zoom & Reset Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="mermaid-canvas-zoom-out"
                      onClick={() =>
                        setCanvasZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))
                      }
                      className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent font-mono"
                      title="Zoom Out Visual Canvas"
                    >
                      −
                    </button>
                    <span
                      data-testid="mermaid-canvas-zoom-level"
                      className="font-mono text-[11px] text-muted min-w-[42px] text-center"
                    >
                      {Math.round(canvasZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      data-testid="mermaid-canvas-zoom-in"
                      onClick={() =>
                        setCanvasZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))
                      }
                      className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent font-mono"
                      title="Zoom In Visual Canvas"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      data-testid="mermaid-canvas-zoom-reset"
                      onClick={() => {
                        setCanvasZoom(1)
                        setCanvasPan({ x: 0, y: 0 })
                      }}
                      className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent"
                      title="Reset Canvas Pan & Zoom to 100%"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Pannable & Zoomable 2D Visio-Style Drawing Surface */}
                <div
                  data-testid="mermaid-visual-canvas-scroll"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const shape = e.dataTransfer.getData(
                      'text/klartext-mermaid-shape'
                    ) as VisualMermaidNodeShape
                    if (shape && svgRef.current) {
                      const pt = toCanvasCoords(e.clientX, e.clientY)
                      addNode(shape, pt.x - 68, pt.y - 27)
                    }
                  }}
                  onMouseDown={(e) => {
                    if (
                      canvasTool === 'pan' ||
                      e.button === 1 ||
                      (e.target === e.currentTarget && e.button === 0)
                    ) {
                      canvasPanDragRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        originX: canvasPan.x,
                        originY: canvasPan.y
                      }
                    }
                  }}
                  onWheel={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      const delta = e.deltaY < 0 ? 0.12 : -0.12
                      setCanvasZoom((z) =>
                        Math.min(2.5, Math.max(0.4, Number((z + delta).toFixed(2))))
                      )
                    }
                  }}
                  style={{
                    backgroundImage:
                      theme === 'dark'
                        ? 'radial-gradient(rgba(255,255,255,0.11) 1px, transparent 1px)'
                        : 'radial-gradient(rgba(15,23,42,0.13) 1px, transparent 1px)',
                    backgroundSize: `${Math.max(8, Math.round(16 * canvasZoom))}px ${Math.max(8, Math.round(16 * canvasZoom))}px`,
                    backgroundPosition: `${canvasPan.x}px ${canvasPan.y}px`
                  }}
                  className={`relative flex-1 overflow-auto min-h-0 ${
                    canvasTool === 'pan'
                      ? 'cursor-grab active:cursor-grabbing'
                      : connectSourceId
                        ? 'cursor-crosshair'
                        : 'cursor-default'
                  }`}
                >
                  <div
                    style={{
                      transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                      transformOrigin: '0 0',
                      width: `${canvasWidth}px`,
                      height: `${canvasHeight}px`
                    }}
                  >
                    <svg
                      ref={svgRef}
                      width={canvasWidth}
                      height={canvasHeight}
                      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                      onMouseMove={handleSvgMouseMove}
                      onMouseDown={(e) => {
                        if (e.target === svgRef.current) {
                          setSelectedNodeId(null)
                          setSelectedEdgeId(null)
                          setInlineEditingNodeId(null)
                          setInlineEditingEdgeId(null)
                          if (connectSourceId) {
                            setConnectSourceId(null)
                            setRubberBandCursor(null)
                          }
                          if (e.button === 0) {
                            canvasPanDragRef.current = {
                              startX: e.clientX,
                              startY: e.clientY,
                              originX: canvasPan.x,
                              originY: canvasPan.y
                            }
                          }
                        }
                      }}
                      onMouseUp={() => {
                        draggingNodeRef.current = null
                        if (connectSourceId) {
                          setConnectSourceId(null)
                          setRubberBandCursor(null)
                        }
                      }}
                      className="block select-none"
                      data-testid="mermaid-visual-canvas-svg"
                    >
                      <defs>
                        <marker
                          id="vb-arrow"
                          viewBox="0 0 10 10"
                          refX="8.5"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#426B79" />
                        </marker>
                        <marker
                          id="vb-arrow-selected"
                          viewBox="0 0 10 10"
                          refX="8.5"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#3B7A57" />
                        </marker>
                      </defs>

                      {/* Edges / Connectors */}
                      {edges.map((ed) => {
                        const fromNode = nodes.find((n) => n.id === ed.from)
                        const toNode = nodes.find((n) => n.id === ed.to)
                        if (!fromNode || !toNode) return null
                        const { x1, y1, x2, y2, mx, my } = computeSmartEdgeEndpoints(
                          fromNode,
                          toNode,
                          136,
                          54
                        )
                        const isSelected = ed.id === selectedEdgeId
                        const strokeCol = isSelected ? '#3B7A57' : '#426B79'
                        const markerUrl = isSelected
                          ? 'url(#vb-arrow-selected)'
                          : 'url(#vb-arrow)'

                        return (
                          <g
                            key={ed.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedEdgeId(ed.id)
                              setSelectedNodeId(null)
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setSelectedEdgeId(ed.id)
                              setSelectedNodeId(null)
                              setInlineEditingEdgeId(ed.id)
                            }}
                            className="cursor-pointer group"
                          >
                            {/* Wide invisible hit target for easy clicking */}
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="transparent"
                              strokeWidth={14}
                            />
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke={strokeCol}
                              strokeWidth={ed.style === '==>' ? 3.6 : isSelected ? 2.8 : 2}
                              strokeDasharray={ed.style === '-.->' ? '6,4' : undefined}
                              markerStart={ed.style === '<-->' ? markerUrl : undefined}
                              markerEnd={ed.style === '---' ? undefined : markerUrl}
                            />
                            {ed.label && (
                              <g>
                                <rect
                                  x={mx - Math.max(24, ed.label.length * 3.8)}
                                  y={my - 11}
                                  width={Math.max(48, ed.label.length * 7.6)}
                                  height={18}
                                  rx={4}
                                  fill={theme === 'dark' ? '#181C20' : '#FFFFFF'}
                                  stroke={strokeCol}
                                  strokeWidth={1}
                                />
                                <text
                                  x={mx}
                                  y={my + 2}
                                  textAnchor="middle"
                                  fontSize="11"
                                  fill={theme === 'dark' ? '#E8ECEF' : '#20272D'}
                                  fontWeight="600"
                                >
                                  {ed.label}
                                </text>
                              </g>
                            )}
                          </g>
                        )
                      })}

                      {/* Live Rubber-Band Connector Line while dragging from a port */}
                      {connectOriginNode && rubberBandCursor && (
                        <line
                          x1={connectOriginNode.x + 68}
                          y1={connectOriginNode.y + 27}
                          x2={rubberBandCursor.x}
                          y2={rubberBandCursor.y}
                          stroke="#B8860B"
                          strokeWidth={2.2}
                          strokeDasharray="5,4"
                          markerEnd="url(#vb-arrow)"
                          className="pointer-events-none"
                        />
                      )}

                      {/* Flowchart Nodes with 4-Side Visio Connection Ports */}
                      {nodes.map((node) => {
                        const isSelected = node.id === selectedNodeId
                        const isHovered = node.id === hoveredNodeId
                        const isConnectOrigin = node.id === connectSourceId
                        const w = 136
                        const h = 54
                        const fillCol = theme === 'dark' ? '#202428' : '#F4F6F8'
                        const strokeCol = isConnectOrigin
                          ? '#B8860B'
                          : isSelected
                            ? '#3B7A57'
                            : '#426B79'
                        const strokeW = isSelected || isConnectOrigin ? 2.8 : 2

                        const ports = [
                          { side: 'top', cx: node.x + w / 2, cy: node.y },
                          { side: 'right', cx: node.x + w, cy: node.y + h / 2 },
                          { side: 'bottom', cx: node.x + w / 2, cy: node.y + h },
                          { side: 'left', cx: node.x, cy: node.y + h / 2 }
                        ]

                        return (
                          <g
                            key={node.id}
                            data-testid={`visual-mermaid-node-${node.id}`}
                            onMouseEnter={() => setHoveredNodeId(node.id)}
                            onMouseLeave={() =>
                              setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                            }
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              if (canvasTool === 'pan') return
                              const pt = toCanvasCoords(e.clientX, e.clientY)
                              draggingNodeRef.current = {
                                id: node.id,
                                offsetX: pt.x - node.x,
                                offsetY: pt.y - node.y
                              }
                              handleNodeClick(node.id)
                            }}
                            onMouseUp={(e) => {
                              if (connectSourceId && connectSourceId !== node.id) {
                                e.stopPropagation()
                                completeConnectionToNode(node.id)
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setSelectedNodeId(node.id)
                              setInlineEditingNodeId(node.id)
                            }}
                            className={canvasTool === 'pan' ? 'cursor-grab' : 'cursor-move'}
                          >
                            {node.shape === 'diamond' ? (
                              <polygon
                                points={`${node.x + w / 2},${node.y - 6} ${node.x + w + 8},${node.y + h / 2} ${node.x + w / 2},${node.y + h + 6} ${node.x - 8},${node.y + h / 2}`}
                                fill={fillCol}
                                stroke={strokeCol}
                                strokeWidth={strokeW}
                              />
                            ) : node.shape === 'hexagon' ? (
                              <polygon
                                points={`${node.x + 16},${node.y} ${node.x + w - 16},${node.y} ${node.x + w + 6},${node.y + h / 2} ${node.x + w - 16},${node.y + h} ${node.x + 16},${node.y + h} ${node.x - 6},${node.y + h / 2}`}
                                fill={fillCol}
                                stroke={strokeCol}
                                strokeWidth={strokeW}
                              />
                            ) : node.shape === 'circle' ? (
                              <ellipse
                                cx={node.x + w / 2}
                                cy={node.y + h / 2}
                                rx={w / 2}
                                ry={h / 2}
                                fill={fillCol}
                                stroke={strokeCol}
                                strokeWidth={strokeW}
                              />
                            ) : node.shape === 'cylinder' ? (
                              <g>
                                <rect
                                  x={node.x}
                                  y={node.y + 4}
                                  width={w}
                                  height={h - 4}
                                  rx={10}
                                  fill={fillCol}
                                  stroke={strokeCol}
                                  strokeWidth={strokeW}
                                />
                                <ellipse
                                  cx={node.x + w / 2}
                                  cy={node.y + 8}
                                  rx={w / 2}
                                  ry={6}
                                  fill={fillCol}
                                  stroke={strokeCol}
                                  strokeWidth={1.6}
                                />
                              </g>
                            ) : node.shape === 'subroutine' ? (
                              <g>
                                <rect
                                  x={node.x}
                                  y={node.y}
                                  width={w}
                                  height={h}
                                  rx={4}
                                  fill={fillCol}
                                  stroke={strokeCol}
                                  strokeWidth={strokeW}
                                />
                                <line
                                  x1={node.x + 10}
                                  y1={node.y}
                                  x2={node.x + 10}
                                  y2={node.y + h}
                                  stroke={strokeCol}
                                  strokeWidth={1.8}
                                />
                                <line
                                  x1={node.x + w - 10}
                                  y1={node.y}
                                  x2={node.x + w - 10}
                                  y2={node.y + h}
                                  stroke={strokeCol}
                                  strokeWidth={1.8}
                                />
                              </g>
                            ) : (
                              <rect
                                x={node.x}
                                y={node.y}
                                width={w}
                                height={h}
                                rx={node.shape === 'round' ? 24 : 5}
                                fill={fillCol}
                                stroke={strokeCol}
                                strokeWidth={strokeW}
                              />
                            )}

                            <text
                              x={node.x + w / 2}
                              y={node.y + h / 2 + 4}
                              textAnchor="middle"
                              fontSize="12"
                              fontWeight="500"
                              fontFamily="Inter, sans-serif"
                              fill={theme === 'dark' ? '#E8ECEF' : '#20272D'}
                            >
                              {node.label}
                            </text>

                            {/* 4-Sided Visio Connection Ports (visible on hover/select, right port always subtly ready) */}
                            {ports.map((port) => {
                              const showPort =
                                isSelected ||
                                isHovered ||
                                isConnectOrigin ||
                                Boolean(connectSourceId) ||
                                port.side === 'right'
                              if (!showPort) return null
                              return (
                                <circle
                                  key={port.side}
                                  cx={port.cx}
                                  cy={port.cy}
                                  r={isSelected || isHovered ? 5.5 : 4.5}
                                  fill={isConnectOrigin ? '#B8860B' : '#3B7A57'}
                                  stroke="#FFFFFF"
                                  strokeWidth={1.5}
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    draggingNodeRef.current = null
                                    setConnectSourceId(node.id)
                                    setRubberBandCursor({ x: port.cx, y: port.cy })
                                  }}
                                  onMouseUp={(e) => {
                                    if (connectSourceId && connectSourceId !== node.id) {
                                      e.stopPropagation()
                                      completeConnectionToNode(node.id)
                                    }
                                  }}
                                  className="cursor-crosshair"
                                >
                                  <title>
                                    Drag from this {port.side} port to another shape to connect an arrow
                                  </title>
                                </circle>
                              )
                            })}
                          </g>
                        )
                      })}
                    </svg>

                    {/* Inline Double-Click Node Label Editor Overlay */}
                    {inlineEditingNodeId &&
                      (() => {
                        const target = nodes.find((n) => n.id === inlineEditingNodeId)
                        if (!target) return null
                        return (
                          <input
                            type="text"
                            autoFocus
                            value={target.label}
                            onChange={(e) => {
                              setIsCodeManuallyEdited(false)
                              setNodes((prev) =>
                                prev.map((n) =>
                                  n.id === target.id ? { ...n, label: e.target.value } : n
                                )
                              )
                            }}
                            onBlur={() => setInlineEditingNodeId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setInlineEditingNodeId(null)
                              }
                            }}
                            style={{
                              left: `${target.x + 8}px`,
                              top: `${target.y + 13}px`,
                              width: '120px'
                            }}
                            className="absolute px-2 py-0.5 text-xs text-center rounded bg-panel border-2 border-accent text-primary shadow-md focus:outline-none"
                          />
                        )
                      })()}

                    {/* Inline Double-Click Edge Label Editor Overlay */}
                    {inlineEditingEdgeId &&
                      (() => {
                        const targetEd = edges.find((e) => e.id === inlineEditingEdgeId)
                        if (!targetEd) return null
                        const fn = nodes.find((n) => n.id === targetEd.from)
                        const tn = nodes.find((n) => n.id === targetEd.to)
                        if (!fn || !tn) return null
                        const { mx, my } = computeSmartEdgeEndpoints(fn, tn, 136, 54)
                        return (
                          <input
                            type="text"
                            autoFocus
                            placeholder="Connector label..."
                            value={targetEd.label}
                            onChange={(e) => {
                              setIsCodeManuallyEdited(false)
                              setEdges((prev) =>
                                prev.map((ed) =>
                                  ed.id === targetEd.id ? { ...ed, label: e.target.value } : ed
                                )
                              )
                            }}
                            onBlur={() => setInlineEditingEdgeId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setInlineEditingEdgeId(null)
                              }
                            }}
                            style={{
                              left: `${mx - 55}px`,
                              top: `${my - 14}px`,
                              width: '110px'
                            }}
                            className="absolute px-2 py-0.5 text-xs text-center rounded bg-panel border-2 border-accent text-primary shadow-md focus:outline-none"
                          />
                        )
                      })()}
                  </div>
                </div>
              </div>
            ) : (
              <StructuredMermaidVisualBuilder
                diagramType={activePresetId}
                code={effectiveMermaidCode}
                theme={theme}
                onChangeCode={handleCodeEditorChange}
              />
            )}

            {/* Vertical Drag Splitter for Mermaid Code Drawer */}
            {isCodeDrawerOpen && (
              <div
                data-testid="mermaid-split-divider-vertical"
                onMouseDown={(e) => {
                  e.preventDefault()
                  splitDragRef.current = {
                    type: 'vertical',
                    startY: e.clientY,
                    startHeight: codeDrawerHeight
                  }
                }}
                className="h-1.5 w-full cursor-row-resize rounded bg-subtle/60 hover:bg-accent/60 transition-colors shrink-0 flex items-center justify-center"
                title="Drag up or down to resize Mermaid Code Editor height"
              >
                <div className="w-8 h-0.5 rounded bg-muted/50" />
              </div>
            )}

            {/* Resizable & Collapsible Two-Way Synced Mermaid Code Editor */}
            <div
              style={{ height: isCodeDrawerOpen ? `${codeDrawerHeight}px` : '0px' }}
              className={`flex flex-col space-y-1 shrink-0 overflow-hidden transition-all ${
                isCodeDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-muted shrink-0">
                <span>Mermaid Source Code (Two-Way Live Sync)</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-accent">
                    {currentPreset.label} ({activePresetId})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCodeDrawerOpen(false)}
                    className="text-[10px] text-muted hover:text-primary px-1"
                    title="Collapse Code Drawer"
                  >
                    ▼ Hide
                  </button>
                </div>
              </div>
              <textarea
                data-testid="mermaid-builder-code-editor"
                value={effectiveMermaidCode}
                onChange={(e) => handleCodeEditorChange(e.target.value)}
                spellCheck={false}
                placeholder="Write or paste any Mermaid diagram syntax here..."
                className="flex-1 w-full p-2 rounded bg-panel border border-subtle font-mono text-xs text-primary focus:outline-none focus:border-accent resize-none leading-relaxed"
              />
            </div>

            {/* Keep pre element with data-testid="mermaid-builder-generated-code" always mounted for full test & accessibility compatibility */}
            <pre
              data-testid="mermaid-builder-generated-code"
              className="sr-only"
            >
              {effectiveMermaidCode}
            </pre>
          </div>

          {/* INTERACTIVE HORIZONTAL SPLIT RESIZE HANDLE between Visual Builder and Live Output Preview */}
          <div
            data-testid="mermaid-split-divider-horizontal"
            onMouseDown={(e) => {
              e.preventDefault()
              splitDragRef.current = {
                type: 'horizontal',
                startX: e.clientX,
                startPercent: leftPanePercent
              }
            }}
            onDoubleClick={() => setLeftPanePercent(50)}
            className="w-2 h-full cursor-col-resize bg-subtle/50 hover:bg-accent/60 active:bg-accent transition-colors flex flex-col items-center justify-center shrink-0 group"
            title="Drag left or right to resize Visual Canvas vs. Live Output Preview (Double-click to reset 50/50)"
          >
            <div className="h-10 w-0.5 rounded bg-muted/60 group-hover:bg-white" />
          </div>

          {/* RIGHT PANE: Resizable Interactive Pan & Zoom Live Output Preview */}
          <div
            style={{ width: `${100 - leftPanePercent}%` }}
            className="flex flex-col min-w-[260px] min-h-0 h-full p-3 pl-1.5 gap-2"
          >
            <div className="flex flex-col flex-1 min-h-0 bg-panel border border-subtle rounded-md overflow-hidden shadow-xs">
              {/* Live Output Preview Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-secondary/60 border-b border-subtle text-[11px] shrink-0">
                <span className="font-semibold uppercase text-muted">
                  Live Output Preview (Drag to Pan • Scroll to Zoom)
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="text-muted text-[11px]">Theme:</label>
                  <select
                    data-testid="mermaid-theme-select"
                    value={previewMermaidTheme}
                    onChange={(e) =>
                      setPreviewMermaidTheme(e.target.value as MermaidPreviewTheme)
                    }
                    className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary text-xs"
                  >
                    <option value="auto">Auto ({theme})</option>
                    <option value="default">Default</option>
                    <option value="neutral">Neutral</option>
                    <option value="dark">Dark</option>
                    <option value="forest">Forest</option>
                    <option value="base">Base</option>
                  </select>
                  <button
                    type="button"
                    data-testid="mermaid-preview-grid-toggle"
                    onClick={() => setPreviewGrid((v) => !v)}
                    className={`px-2 py-0.5 rounded border text-xs ${
                      previewGrid
                        ? 'bg-accent text-white border-accent'
                        : 'bg-panel border-subtle text-primary'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    data-testid="mermaid-zoom-out-btn"
                    onClick={() =>
                      setPreviewZoom((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))))
                    }
                    className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent text-xs font-mono"
                    title="Zoom Out Output Preview"
                  >
                    −
                  </button>
                  <span
                    data-testid="mermaid-zoom-level"
                    className="font-mono text-[11px] text-muted min-w-[40px] text-center"
                  >
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    data-testid="mermaid-zoom-in-btn"
                    onClick={() =>
                      setPreviewZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))
                    }
                    className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent text-xs font-mono"
                    title="Zoom In Output Preview"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    data-testid="mermaid-zoom-reset-btn"
                    onClick={() => {
                      setPreviewZoom(1)
                      setPreviewPan({ x: 0, y: 0 })
                    }}
                    className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent text-xs"
                    title="Reset Output Pan & Zoom"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {syntaxError && (
                <div
                  data-testid="mermaid-builder-error-banner"
                  className="px-3 py-1.5 bg-secondary border-b border-subtle text-danger font-mono text-xs shrink-0"
                >
                  Mermaid Syntax Diagnostic: {syntaxError}
                </div>
              )}

              {/* Interactive Pan & Wheel-Zoom Output Viewport */}
              <div
                data-testid="mermaid-live-preview-viewport"
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  previewPanDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: previewPan.x,
                    originY: previewPan.y
                  }
                }}
                onWheel={(e) => {
                  e.preventDefault()
                  const delta = e.deltaY < 0 ? 0.12 : -0.12
                  setPreviewZoom((z) =>
                    Math.min(3.0, Math.max(0.35, Number((z + delta).toFixed(2))))
                  )
                }}
                style={
                  previewGrid
                    ? {
                        backgroundImage:
                          theme === 'dark'
                            ? 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)'
                            : 'radial-gradient(rgba(15,23,42,0.14) 1px, transparent 1px)',
                        backgroundSize: `${Math.max(10, Math.round(18 * previewZoom))}px ${Math.max(10, Math.round(18 * previewZoom))}px`,
                        backgroundPosition: `${previewPan.x}px ${previewPan.y}px`
                      }
                    : undefined
                }
                className="flex-1 p-6 flex items-center justify-center overflow-hidden min-h-[160px] cursor-grab active:cursor-grabbing select-none"
              >
                <div
                  data-testid="mermaid-live-preview-svg"
                  style={{
                    transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    transition: previewPanDragRef.current ? 'none' : 'transform 90ms ease-out'
                  }}
                  className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Window Resize Handles (Left, Right, Top, Bottom, and Corner Grip) */}
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'left',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-accent/30"
          title="Drag left edge to resize window width"
        />
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'right',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-accent/30"
          title="Drag right edge to resize window width"
        />
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'bottom',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-accent/30"
          title="Drag bottom edge to resize window height"
        />
        <div
          data-testid="mermaid-wizard-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            modalResizeRef.current = {
              dir: 'corner',
              startX: e.clientX,
              startY: e.clientY,
              startW: modalSize.width,
              startH: modalSize.height
            }
          }}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-accent/60 hover:bg-accent rounded-tl"
          title="Drag corner to resize Diagram Studio window"
        />
      </div>
    </div>
  )
}

/* ============================================================================
 * NATIVE-FEELING INTERACTIVE EXCALIDRAW STUDIO (.excalidraw.svg)
 * ============================================================================ */

type DrawingTool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'text'

export const ExcalidrawCanvasModal: React.FC<{
  rootId: string
  relativePath: string
  theme: 'light' | 'dark'
  onClose: () => void
  onSaved?: (relativePath: string, svgContent: string) => void
}> = ({ rootId, relativePath, theme, onClose, onSaved }) => {
  const [scene, setScene] = useState<ExcalidrawSceneData>(() => ({
    ...createDefaultExcalidrawScene(theme),
    elements: []
  }))
  const [activeTool, setActiveTool] = useState<DrawingTool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [corruptedWarning, setCorruptedWarning] = useState(false)
  const [strokeColor, setStrokeColor] = useState<string>(theme === 'dark' ? '#8AB6C3' : '#426B79')
  const [fillColor, setFillColor] = useState<string>(theme === 'dark' ? '#202428' : '#EEF1F3')

  const svgCanvasRef = useRef<SVGSVGElement | null>(null)
  const dragInteractionRef = useRef<
    | {
        mode: 'move'
        id: string
        startX: number
        startY: number
        origX: number
        origY: number
      }
    | {
        mode: 'resize'
        id: string
        startX: number
        startY: number
        origW: number
        origH: number
      }
    | {
        mode: 'create'
        id: string
        startX: number
        startY: number
      }
    | null
  >(null)

  useEffect(() => {
    let active = true
    window.klartext
      .loadExcalidrawSvg(rootId, relativePath)
      .then((res) => {
        if (!active) return
        if (res.scene) {
          setScene(res.scene)
        } else if (res.corrupted) {
          setCorruptedWarning(true)
        }
      })
      .catch(() => {
        // New file; start with default scene
      })
    return () => {
      active = false
    }
  }, [rootId, relativePath])

  const toSvgCoords = (e: { clientX: number; clientY: number }) => {
    const svg = svgCanvasRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const scaleX = 800 / Math.max(1, rect.width)
    const scaleY = 420 / Math.max(1, rect.height)
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    }
  }

  const addShape = (type: ExcalidrawElementItem['type']) => {
    const newEl: ExcalidrawElementItem = {
      id: `el-${Date.now().toString(36)}`,
      type,
      x: 80 + ((scene.elements.length * 45) % 450),
      y: 70 + ((scene.elements.length * 40) % 220),
      width: type === 'text' ? 140 : 165,
      height: type === 'text' ? 32 : 76,
      strokeColor,
      backgroundColor: fillColor,
      text: type === 'arrow' ? undefined : `Node ${scene.elements.length + 1}`
    }
    setScene((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl]
    }))
    setSelectedId(newEl.id)
    setActiveTool('select')
  }

  const updateSelectedElement = (patch: Partial<ExcalidrawElementItem>) => {
    if (!selectedId) return
    setScene((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === selectedId ? { ...el, ...patch } : el))
    }))
  }

  const deleteSelectedElement = () => {
    if (!selectedId) return
    setScene((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== selectedId)
    }))
    setSelectedId(null)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      if (e.target === svgCanvasRef.current) {
        setSelectedId(null)
      }
      return
    }
    const pt = toSvgCoords(e)
    const newId = `el-${Date.now().toString(36)}`
    const newEl: ExcalidrawElementItem = {
      id: newId,
      type: activeTool,
      x: pt.x,
      y: pt.y,
      width: activeTool === 'text' ? 150 : 120,
      height: activeTool === 'text' ? 32 : 64,
      strokeColor,
      backgroundColor: fillColor,
      text: activeTool === 'arrow' ? undefined : activeTool === 'text' ? 'Label' : `Shape ${scene.elements.length + 1}`
    }
    setScene((prev) => ({
      ...prev,
      elements: [...prev.elements, newEl]
    }))
    setSelectedId(newId)
    dragInteractionRef.current = {
      mode: 'create',
      id: newId,
      startX: pt.x,
      startY: pt.y
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragInteractionRef.current
    if (!drag) return
    const pt = toSvgCoords(e)

    if (drag.mode === 'move') {
      const dx = pt.x - drag.startX
      const dy = pt.y - drag.startY
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === drag.id
            ? { ...el, x: Math.max(8, drag.origX + dx), y: Math.max(8, drag.origY + dy) }
            : el
        )
      }))
    } else if (drag.mode === 'resize') {
      const dx = pt.x - drag.startX
      const dy = pt.y - drag.startY
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === drag.id
            ? {
                ...el,
                width: Math.max(40, drag.origW + dx),
                height: Math.max(28, drag.origH + dy)
              }
            : el
        )
      }))
    } else if (drag.mode === 'create') {
      const w = Math.max(50, pt.x - drag.startX)
      const h = Math.max(36, pt.y - drag.startY)
      setScene((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === drag.id ? { ...el, width: w, height: h } : el
        )
      }))
    }
  }

  const handleCanvasMouseUp = () => {
    if (dragInteractionRef.current?.mode === 'create') {
      setActiveTool('select')
    }
    dragInteractionRef.current = null
  }

  const handleSave = async () => {
    const updatedScene: ExcalidrawSceneData = {
      ...scene,
      appState: {
        ...scene.appState,
        theme,
        viewBackgroundColor: theme === 'dark' ? '#171A1D' : '#FFFFFF'
      }
    }
    const svgString = serializeExcalidrawSvg(updatedScene)
    const res = await window.klartext.saveExcalidrawSvg({
      rootId,
      relativePath,
      sceneJson: JSON.stringify(updatedScene),
      svgString
    })
    setStatusMessage('Saved .excalidraw.svg')
    onSaved?.(res.relativePath, res.svgContent)
  }

  const selectedEl = scene.elements.find((e) => e.id === selectedId) || scene.elements[0]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="excalidraw-modal"
    >
      <div className="w-full max-w-5xl bg-panel border border-subtle rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Top Native Studio Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary border-b border-subtle">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-primary">
              Excalidraw Vector Studio ({relativePath})
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-panel border border-subtle text-muted">
              Click & drag on canvas to draw, move, or resize shapes
            </span>
          </div>
          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="text-xs text-success font-medium" data-testid="excalidraw-save-status">
                {statusMessage}
              </span>
            )}
            <button
              type="button"
              data-testid="excalidraw-save-btn"
              onClick={handleSave}
              className="px-3 py-1 text-xs font-medium rounded bg-accent text-white hover:opacity-90"
            >
              Save .excalidraw.svg
            </button>
            <button
              type="button"
              data-testid="excalidraw-close-btn"
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-panel border border-subtle text-primary hover:border-accent"
            >
              Close
            </button>
          </div>
        </div>

        {corruptedWarning && (
          <div className="px-4 py-2 bg-secondary border-b border-subtle text-xs text-warning flex items-center justify-between">
            <span>
              Drawing metadata was missing or corrupted. Initialized a fresh editable recovery scene.
            </span>
            <button
              type="button"
              onClick={() => setCorruptedWarning(false)}
              className="underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Native Tool Dock & Property Inspector */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-app border-b border-subtle text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Select & Move Tool"
              onClick={() => setActiveTool('select')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border ${
                activeTool === 'select'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-panel border-subtle text-primary hover:border-accent'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-rect"
              onClick={() => addShape('rectangle')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Rectangle</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-ellipse"
              onClick={() => addShape('ellipse')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Circle className="w-3.5 h-3.5" />
              <span>Ellipse</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-diamond"
              onClick={() => addShape('diamond')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Diamond className="w-3.5 h-3.5" />
              <span>Diamond</span>
            </button>
            <button
              type="button"
              data-testid="excalidraw-add-arrow"
              onClick={() => addShape('arrow')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Arrow</span>
            </button>
            <button
              type="button"
              onClick={() => addShape('text')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>
          </div>

          {selectedEl && (
            <div className="flex items-center gap-2 pl-3 border-l border-subtle">
              <label className="text-muted">Label:</label>
              <input
                type="text"
                data-testid="excalidraw-element-label-input"
                value={selectedEl.text || ''}
                onChange={(e) => {
                  setSelectedId(selectedEl.id)
                  setScene((prev) => ({
                    ...prev,
                    elements: prev.elements.map((el) =>
                      el.id === selectedEl.id ? { ...el, text: e.target.value } : el
                    )
                  }))
                }}
                className="px-2 py-0.5 rounded bg-panel border border-subtle text-primary text-xs w-40"
              />
              <label className="text-muted">Stroke:</label>
              <input
                type="color"
                value={selectedEl.strokeColor || strokeColor}
                onChange={(e) => {
                  setStrokeColor(e.target.value)
                  setSelectedId(selectedEl.id)
                  updateSelectedElement({ strokeColor: e.target.value })
                }}
                className="w-6 h-5 rounded cursor-pointer border border-subtle"
              />
              <label className="text-muted">Fill:</label>
              <input
                type="color"
                value={selectedEl.backgroundColor || fillColor}
                onChange={(e) => {
                  setFillColor(e.target.value)
                  setSelectedId(selectedEl.id)
                  updateSelectedElement({ backgroundColor: e.target.value })
                }}
                className="w-6 h-5 rounded cursor-pointer border border-subtle"
              />
              <button
                type="button"
                title="Delete Selected Shape"
                onClick={deleteSelectedElement}
                className="p-1 rounded bg-panel border border-subtle text-danger hover:border-danger"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Interactive Direct-Manipulation Vector Canvas */}
        <div className="p-4 bg-app flex flex-col items-center">
          <svg
            ref={svgCanvasRef}
            viewBox="0 0 800 420"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="w-full h-[380px] bg-panel border border-subtle rounded-md shadow-sm select-none"
            style={{
              backgroundImage:
                theme === 'dark'
                  ? 'radial-gradient(#353D44 1px, transparent 1px)'
                  : 'radial-gradient(#DDE2E6 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
            data-testid="excalidraw-interactive-svg"
          >
            <defs>
              <marker
                id="ex-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#426B79" />
              </marker>
            </defs>

            {scene.elements.map((el) => {
              const isSelected = (selectedId || scene.elements[0]?.id) === el.id
              const cx = el.x + el.width / 2
              const cy = el.y + el.height / 2

              return (
                <g
                  key={el.id}
                  data-testid={`excalidraw-node-${el.id}`}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setSelectedId(el.id)
                    const pt = toSvgCoords(e)
                    dragInteractionRef.current = {
                      mode: 'move',
                      id: el.id,
                      startX: pt.x,
                      startY: pt.y,
                      origX: el.x,
                      origY: el.y
                    }
                  }}
                  className="cursor-move"
                >
                  {el.type === 'ellipse' ? (
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={Math.abs(el.width / 2)}
                      ry={Math.abs(el.height / 2)}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  ) : el.type === 'diamond' ? (
                    <polygon
                      points={`${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  ) : el.type === 'arrow' ? (
                    <line
                      x1={el.x}
                      y1={el.y}
                      x2={el.x + el.width}
                      y2={el.y + el.height}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={3}
                      markerEnd="url(#ex-arrow)"
                    />
                  ) : el.type === 'text' ? (
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      fill="transparent"
                      stroke={isSelected ? '#3B7A57' : 'transparent'}
                      strokeDasharray="4,2"
                    />
                  ) : (
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rx={6}
                      fill={el.backgroundColor}
                      stroke={isSelected ? '#3B7A57' : el.strokeColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  )}

                  {el.text && (
                    <text
                      x={cx}
                      y={cy + 5}
                      textAnchor="middle"
                      fill={el.strokeColor}
                      fontSize="13"
                      fontFamily="Inter, sans-serif"
                      fontWeight="500"
                    >
                      {el.text}
                    </text>
                  )}

                  {/* Corner resize handle when shape is selected */}
                  {isSelected && (
                    <rect
                      x={el.x + el.width - 6}
                      y={el.y + el.height - 6}
                      width={12}
                      height={12}
                      rx={3}
                      fill="#3B7A57"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      className="cursor-nwse-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        const pt = toSvgCoords(e)
                        dragInteractionRef.current = {
                          mode: 'resize',
                          id: el.id,
                          startX: pt.x,
                          startY: pt.y,
                          origW: el.width,
                          origH: el.height
                        }
                      }}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
