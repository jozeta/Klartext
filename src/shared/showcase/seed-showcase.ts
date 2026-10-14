import fs from 'fs'
import path from 'path'
import {
  createDefaultExcalidrawScene,
  serializeExcalidrawSvg
} from '../serialization/excalidraw-svg'

export interface ShowcaseFileEntry {
  relativePath: string
  content: string
}

const NORDIC_PREVIEW_IMAGE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 280" width="760" height="280">
  <rect width="760" height="280" rx="12" fill="#EEF1F3" stroke="#D5DCE2" stroke-width="2" />
  <rect x="24" y="24" width="180" height="232" rx="8" fill="#FFFFFF" stroke="#D5DCE2" stroke-width="1.5" />
  <rect x="40" y="44" width="110" height="12" rx="4" fill="#426B79" />
  <rect x="40" y="70" width="140" height="8" rx="4" fill="#9AA6B2" />
  <rect x="40" y="88" width="125" height="8" rx="4" fill="#9AA6B2" />
  <rect x="40" y="106" width="148" height="8" rx="4" fill="#3B7A57" />
  <rect x="40" y="124" width="115" height="8" rx="4" fill="#9AA6B2" />
  <rect x="220" y="24" width="320" height="232" rx="8" fill="#FFFFFF" stroke="#D5DCE2" stroke-width="1.5" />
  <text x="244" y="60" font-family="Inter, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#20272D">Technical Nordic Design</text>
  <text x="244" y="88" font-family="Inter, -apple-system, sans-serif" font-size="12" fill="#5C6873">Local-first Markdown, KaTeX, Mermaid &amp; Git</text>
  <rect x="244" y="108" width="272" height="56" rx="6" fill="#F5F6F7" stroke="#426B79" stroke-width="1.5" />
  <text x="260" y="132" font-family="JetBrains Mono, monospace" font-size="11" fill="#426B79">flowchart LR</text>
  <text x="260" y="150" font-family="JetBrains Mono, monospace" font-size="11" fill="#3B7A57">  Editor --&gt; LivePreview</text>
  <rect x="244" y="180" width="128" height="52" rx="6" fill="#EEF5F0" stroke="#3B7A57" stroke-width="1.5" />
  <text x="308" y="210" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="#3B7A57">Multi-Root Ready</text>
  <rect x="388" y="180" width="128" height="52" rx="6" fill="#EEF3F6" stroke="#426B79" stroke-width="1.5" />
  <text x="452" y="210" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="#426B79">Local AI (SV/EN)</text>
  <rect x="556" y="24" width="180" height="232" rx="8" fill="#FFFFFF" stroke="#D5DCE2" stroke-width="1.5" />
  <text x="574" y="54" font-family="Inter, sans-serif" font-size="13" font-weight="600" fill="#20272D">Frontmatter</text>
  <rect x="574" y="70" width="144" height="24" rx="4" fill="#F5F6F7" stroke="#D5DCE2" />
  <rect x="574" y="106" width="144" height="24" rx="4" fill="#F5F6F7" stroke="#D5DCE2" />
  <rect x="574" y="142" width="144" height="24" rx="4" fill="#F5F6F7" stroke="#D5DCE2" />
</svg>`

export function getShowcaseFiles(): ShowcaseFileEntry[] {
  const excalidrawScene = createDefaultExcalidrawScene('light')
  const excalidrawSvg = serializeExcalidrawSvg(excalidrawScene)

  return [
    {
      relativePath: 'Welcome.md',
      content: `---
title: Welcome to Klartext
author: Technical Nordic Workspace
date: 2026-10-14
status: Production
category: Overview
tags:
  - local-first
  - markdown
  - multi-root
  - nordic-ui
---

# Welcome to Klartext

Klartext is a fast, local-first Markdown editor with **Multi-Root Workspaces**, **Concurrent Multi-Repository Git**, **Excalidraw & Mermaid diagrams**, and **Optional Local AI** (English & Svenska).

> [!TIP] Progressive Complexity
> Press \`Cmd/Ctrl + K\` to open the Command Palette, \`Cmd/Ctrl + P\` for Quick File Switcher, or \`Cmd/Ctrl + Shift + F\` for Zen Mode.

## Supported Markdown Features

| Capability | Engine | Status |
| :--- | :--- | :--- |
| Live Inline Rich Editing | CodeMirror 6 Decorations | Active |
| Mathematical Expressions | KaTeX ($E = mc^2$) | Active |
| Interactive Diagrams | Mermaid + \`.excalidraw.svg\` | Active |
| Multi-Repo Git Sync | Concurrent \`simple-git\` | Active |
| Local AI Assistant | Loopback Ollama / LM Studio | Active |

- [x] Single-root & Multi-root workspaces
- [x] Per-root portable assets (\`assets/\`)
- [x] Multi-repository Git sync & conflict resolution
- [x] Bilingual English & Swedish spellcheck with explanations & synonyms

\`\`\`mermaid
flowchart LR
    A["Multi-Root Workspace"] --> B["CodeMirror 6 Live Preview"]
    B --> C["Multi-Repo Git Sync"]
    B --> D["Local AI (SV / EN)"]
\`\`\`

## Explore the Showcase Folders

1. **01-Editing-and-Typography** — [[01-Typography-and-Callouts]], [[02-Tables-and-Checklists]], [[03-Frontmatter-Properties]]
2. **02-Code-and-Mathematics** — [[01-Syntax-Highlighted-Code]], [[02-KaTeX-Scientific-Math]]
3. **03-Diagrams-and-Visuals** — [[01-Mermaid-Diagrams]], [[02-Vector-Drawings-and-Assets]]
4. **04-Local-AI-and-Spellcheck** — [[01-Bilingual-AI-and-Spellcheck-SV-EN]]
5. **05-Multi-Root-and-Git** — [[01-Multi-Root-and-Git-Sync]]
`
    },
    {
      relativePath: '01-Editing-and-Typography/01-Typography-and-Callouts.md',
      content: `---
title: Typography, Callouts & Wiki-Links
author: Klartext Design System
category: Typography
tags:
  - typography
  - callouts
  - live-preview
---

# Typography, Callouts & Wiki-Links

Klartext features a **Technical Nordic** aesthetic designed for distraction-free long-form engineering and research documentation.

## Inline Formatting & Emphasis

You can combine **bold statements**, *italicized nuance*, ~~deprecated strikethroughs~~, and \`inline monospaced tokens\` seamlessly. When editing in **Inline Rich Mode**, raw Markdown tokens automatically hide on inactive lines and reveal themselves on the active cursor line.

## GitHub-Flavored Callout Blocks

> [!NOTE] Architectural Note
> Callouts render with semantic Nordic border accents in both **Inline Rich Mode** and **Split View Mode**.

> [!TIP] Keyboard-First Workflow
> Select any text in the editor to summon the **Floating Formatting Bar** for instant headings, tables, checklists, or visual diagrams.

> [!IMPORTANT] Per-Root Asset Isolation
> Every mounted workspace folder maintains its own self-contained \`assets/\` directory.

> [!WARNING] External File Modifications
> Klartext watches all mounted roots via \`chokidar\` and reloads clean buffers automatically.

> [!CAUTION] Hardened Security Boundary
> All HTML previews, SVGs, and Mermaid diagrams are sanitized through strict DOMPurify and CSP policies.

## Cross-Document Wiki-Links & Backlinks

Link to any note using standard Markdown links or Wiki-link syntax such as [[Welcome]] or [[01-Mermaid-Diagrams]]. Open the **Links** icon in the left sidebar control bar to inspect incoming backlinks.
`
    },
    {
      relativePath: '01-Editing-and-Typography/02-Tables-and-Checklists.md',
      content: `---
title: Interactive Tables & Task Checklists
author: Klartext Engineering
category: Productivity
tags:
  - tables
  - tasks
  - gfm
---

# Interactive Tables & Task Checklists

## GitHub-Flavored Markdown Tables

In **Inline Rich Mode**, tables render as clean, interactive grids directly inside your document buffer. Place your cursor on any table line to edit cells or alignment:

| Module | Subsystem | Latency Target | Verification |
| :--- | :--- | :---: | ---: |
| **Workspace Registry** | Multi-Root Path Guard | \`< 5 ms\` | ✅ Passed |
| **Atomic File Writer** | Temp-File + Rename | \`< 25 ms\` | ✅ Passed |
| **Multi-Root Search** | Ripgrep / Stream Index | \`< 150 ms\` | ✅ Passed |
| **Git Sync Engine** | \`Promise.allSettled\` | Concurrent | ✅ Passed |
| **Local AI Stream** | \`127.0.0.1\` NDJSON | Real-time | ✅ Passed |

## Interactive Task Checklists

Click any checkbox below in **Inline Rich Mode** to toggle its completion state directly in the underlying Markdown file:

- [x] Configure Technical Nordic Light & Dark color tokens
- [x] Enable **White Paper Background in Dark Mode** from the \`View\` menu
- [x] Persist window position, size, open tabs, and panel widths across restarts
- [ ] Draft Q4 architecture RFC using the Visual Diagram Builder
- [ ] Review bilingual Swedish/English release notes with Local AI
`
    },
    {
      relativePath: '01-Editing-and-Typography/03-Frontmatter-Properties.md',
      content: `---
title: Frontmatter Properties Showcase
author: Klartext Team
date: 2026-10-14
status: Approved
version: 1.0.0
reviewers: Architecture Board
tags:
  - frontmatter
  - yaml
  - metadata
---

# Frontmatter Properties Window

Click the **Toggle Right Panel** button in the top-right titlebar (or choose **View → Show Right Frontmatter Window**) to inspect and edit this document's YAML frontmatter in a dedicated, resizable properties inspector.

## How Frontmatter Sync Works

1. **Two-Way Binding:** Updating any field in the right-hand **Frontmatter Properties** panel immediately updates the YAML header block at the top of the Markdown file.
2. **Custom Keys:** Add custom metadata fields (such as \`version\`, \`reviewers\`, or \`project\`) directly from the panel.
3. **Hidden in Inline Rich Mode:** Raw YAML frontmatter delimiters (\`---\`) collapse into a compact metadata badge in Inline Rich Mode so your reading flow stays clean.
`
    },
    {
      relativePath: '02-Code-and-Mathematics/01-Syntax-Highlighted-Code.md',
      content: `---
title: Syntax-Highlighted Code Blocks
author: Core Runtime Team
category: Engineering
tags:
  - code
  - syntax-highlighting
  - typescript
  - rust
---

# Syntax-Highlighted Code Blocks

Fenced code blocks render with compact line numbers, language badges, and semantic syntax highlighting across TypeScript, Python, Rust, SQL, and Shell scripts.

## TypeScript — Atomic Multi-Root Asset Service

\`\`\`typescript
export interface SaveAssetRequest {
  rootId: string
  documentRelativePath: string
  fileName: string
  mimeType: string
}

export async function resolveScopedAssetPath(req: SaveAssetRequest): Promise<string> {
  const safeName = req.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  return \`assets/images/\${Date.now()}-\${safeName}\`
}
\`\`\`

## Rust — Zero-Copy Line Indexer

\`\`\`rust
pub struct LineSpan {
    pub line_number: usize,
    pub byte_offset: usize,
}

pub fn index_markdown_lines(buffer: &str) -> Vec<LineSpan> {
    buffer
        .lines()
        .enumerate()
        .map(|(idx, line)| LineSpan {
            line_number: idx + 1,
            byte_offset: line.len(),
        })
        .collect()
}
\`\`\`

## Python — Local Embedding Pipeline

\`\`\`python
from typing import List

def normalize_vector(weights: List[float]) -> List[float]:
    # Compute L2 norm for local bge-m3 embeddings
    norm = sum(w * w for w in weights) ** 0.5
    return [round(w / norm, 5) for w in weights] if norm > 0 else weights
\`\`\`
`
    },
    {
      relativePath: '02-Code-and-Mathematics/02-KaTeX-Scientific-Math.md',
      content: `---
title: KaTeX Scientific & Mathematical Notation
author: Quantitative Research
category: Mathematics
tags:
  - math
  - katex
  - latex
---

# KaTeX Scientific & Mathematical Notation

Klartext renders inline math like Euler's identity $e^{i\\pi} + 1 = 0$ and mass-energy equivalence $E = mc^2$, as well as multi-line display equations powered by **KaTeX**.

## Gaussian Probability Density

$$
f(x \\mid \\mu, \\sigma^2) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} \\exp\\left( -\\frac{(x - \\mu)^2}{2\\sigma^2} \\right)
$$

## Scaled Dot-Product Attention

$$
\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
$$

## Maxwell's Curl Equations in Vacuum

$$
\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}, \\qquad \\nabla \\times \\mathbf{B} = \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
$$
`
    },
    {
      relativePath: '03-Diagrams-and-Visuals/01-Mermaid-Diagrams.md',
      content: `---
title: Interactive Mermaid Diagrams & Visual Builder
author: Systems Architecture
category: Diagrams
tags:
  - mermaid
  - diagrams
  - visual-builder
---

# Interactive Mermaid Diagrams & Visual Builder

Click the **Visual Builder** button on any Mermaid diagram below—or click the **Visual Diagram Builder** icon in the floating formatting bar—to draw nodes and arrows on an auto-expanding 2D canvas.

## 1. Multi-Root Architecture Flowchart

\`\`\`mermaid
flowchart LR
    UI["React + CodeMirror 6"] --> IPC["Typed ContextBridge IPC"]
    IPC --> WS["Multi-Root Registry"]
    IPC --> GIT["Concurrent Git Manager"]
    IPC --> AI["Local AI (127.0.0.1)"]
\`\`\`

## 2. Concurrent Git Synchronization Sequence

\`\`\`mermaid
sequenceDiagram
    participant User
    participant Renderer
    participant GitManager
    participant RepoA as Repo A (Docs)
    participant RepoB as Repo B (Specs)
    User->>Renderer: Click "Sync All Repos"
    Renderer->>GitManager: gitSyncAll()
    par Concurrent Execution
        GitManager->>RepoA: fetch -> pull --rebase -> push
        GitManager->>RepoB: fetch -> pull --rebase -> push
    end
    GitManager-->>Renderer: Per-Repo Status & Conflict Hunks
\`\`\`

## 3. Document Lifecycle State Diagram

\`\`\`mermaid
stateDiagram-v2
    [*] --> CleanBuffer
    CleanBuffer --> DirtyBuffer: User Edits Markdown
    DirtyBuffer --> SnapshotSaved: 900ms Debounce
    SnapshotSaved --> CleanBuffer: Atomic Disk Write
\`\`\`
`
    },
    {
      relativePath: '03-Diagrams-and-Visuals/02-Vector-Drawings-and-Assets.md',
      content: `---
title: Excalidraw Vector Drawings & Per-Root Assets
author: Design Engineering
category: Assets
tags:
  - excalidraw
  - svg
  - assets
---

# Excalidraw Vector Drawings & Per-Root Assets

Klartext stores pasted images and interactive \`.excalidraw.svg\` vector drawings strictly inside the active root's \`assets/\` folder.

## Embedded Interactive \`.excalidraw.svg\` Drawing

Click **Edit in Excalidraw Studio** on the card below (or click the file in \`assets/drawings/architecture.excalidraw.svg\` in the sidebar) to open the vector studio:

![System Architecture Drawing](../assets/drawings/architecture.excalidraw.svg)

## Local SVG Illustration in \`assets/images/\`

You can also view any image directly from the \`assets/images/\` folder in the left sidebar or embed it in Markdown:

![Technical Nordic Workspace Preview](../assets/images/nordic-workspace-preview.svg)
`
    },
    {
      relativePath: '04-Local-AI-and-Spellcheck/01-Bilingual-AI-and-Spellcheck-SV-EN.md',
      content: `---
title: Bilingual Local AI & Spellcheck (SV / EN)
author: Language Intelligence Team
category: AI & Language
tags:
  - local-ai
  - ollama
  - svenska
  - english
  - spellcheck
---

# Bilingual Local AI & Spellcheck (English & Svenska)

Klartext connects exclusively to local loopback inference servers (\`127.0.0.1\` via **Ollama** or **LM Studio**) and includes a built-in bilingual spellchecker for **English (\`en-US\`)** and **Swedish (\`sv-SE\`)**.

## Svenskt Textprov (Swedish Sample)

> **Teknisk sammanfattning:** Klartext är ett lokalt dokumentverktyg med ett modernt **användargränssnitt** som kombinerar blixtsnabb redigering, versionshantering med Git och lokal språkmodellsanalys utan molnberoende.

## English Sample & AI Actions

Open the **AI** menu in the top bar to:
- Toggle the **Local AI Panel** and inspect the **Hardware & Model Advisor** (automatically tailored to your system RAM).
- Trigger **Inline Draft (\`⌘J\`)** to draft tables, sections, or Mermaid diagrams at the cursor.
- Run **AI Improve (SV/EN)** or **Translate SV ↔ EN** from the floating selection toolbar and review proposed changes in an inline diff card before accepting.
`
    },
    {
      relativePath: '05-Multi-Root-and-Git/01-Multi-Root-and-Git-Sync.md',
      content: `---
title: Multi-Root Workspaces & Concurrent Git Sync
author: Platform Engineering
category: Git & Workspaces
tags:
  - multi-root
  - git
  - conflict-resolution
---

# Multi-Root Workspaces & Concurrent Git Sync

## Mounting Multiple Folders

1. Click the **\`+\` (Mount Root by Path)** or **Folder+** icon in the Left Sidebar header to mount additional project directories into a single workspace.
2. Save or load portable \`.klartext-workspace\` JSON manifests via **File → Settings...**.
3. Moving a Markdown document between roots automatically checks for referenced images/drawings in \`assets/\` and offers to migrate them and rewrite relative links.

## Concurrent Multi-Repository Git

Switch to the **Git** icon in the bottom-left sidebar control bar to view independent repository statuses across every mounted root:
- **Sync All** executes \`fetch -> pull --rebase -> push\` concurrently across all repositories.
- If a merge conflict occurs in one repository, other repositories still complete cleanly, and Klartext renders one-click conflict resolution lenses (**Accept Current**, **Accept Incoming**, **Accept Both**).
`
    },
    {
      relativePath: 'assets/drawings/architecture.excalidraw.svg',
      content: excalidrawSvg
    },
    {
      relativePath: 'assets/images/nordic-workspace-preview.svg',
      content: NORDIC_PREVIEW_IMAGE_SVG
    }
  ]
}

export function seedShowcaseDirectory(targetDir: string, overwriteExisting = false): void {
  fs.mkdirSync(path.join(targetDir, 'assets', 'images'), { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'assets', 'drawings'), { recursive: true })

  for (const item of getShowcaseFiles()) {
    const fullPath = path.join(targetDir, item.relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    if (overwriteExisting || !fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, item.content, 'utf-8')
    }
  }
}
