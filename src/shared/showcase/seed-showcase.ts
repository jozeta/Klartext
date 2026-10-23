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
      relativePath: '01-Feature-Test-Typography-and-Formatting.md',
      content: `---
title: Feature Test 1 — Typography, Callouts, Tables & Inline Syntax
author: Klartext QA Suite
Creation Date: 2026-10-23
status: Verified
category: QA Test Suite
tags:
  - test-suite
  - formatting
  - typography
  - tables
  - callouts
---

# Feature Test 1 — Typography, Callouts, Tables & Inline Syntax

Use this page to test and verify every inline formatting style, block element, callout, table, footnote, bookmark card, and collapsible section in **Inline Rich Mode**, **Split View**, and **Raw Source Mode**.

[[_TOC_]]

---

## 1. Headings Hierarchy (H1 – H6)

# Heading 1 — Document Section
## Heading 2 — Major Subsystem
### Heading 3 — Component Specification
#### Heading 4 — Implementation Detail
##### Heading 5 — Edge-Case Note
###### Heading 6 — Micro-Label

---

## 2. Inline Text Formatting Matrix

Test every inline style both in paragraphs and inside GFM table cells:

- **Bold (Asterisks):** **Bold statement with double asterisks**
- **Bold (Underscores):** __Bold statement with double underscores__
- **Italic (Asterisks):** *Italicized text with single asterisks*
- **Italic (Underscores):** _Italicized text with single underscores_
- **Bold & Italic Combined:** ***Triple-asterisk bold italic*** and ___triple-underscore bold italic___ and **_bold with nested italic_**
- **Strikethrough:** ~~Deprecated or struck-out text~~
- **Highlight:** ==Important highlighted phrase==
- **Underline:** <u>Underlined key terminology</u>
- **Superscript & Subscript:** $x$<sup>2</sup> + $y$<sup>2</sup> and H<sub>2</sub>O / CO<sub>2</sub>
- **Inline Code:** \`const status = "ready"\` and double-backtick \`\`code with \`backticks\` inside\`\`
- **Keyboard Shortcut Keys:** Press <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> or <kbd>⌘B</kbd>
- **Spoiler Text:** >!Hover over this spoiler badge to reveal the secret text!<
- **Escaped Markdown Tokens:** \\*\\*This text has escaped asterisks and will not be bold\\*\\*
- **Footnotes (Hover or Click):** Inline footnote reference one[^1] and second technical citation[^2].

### Inline Formatting Inside a GFM Table

| Style | Syntax | Example | Rendered Output |
| :--- | :--- | :---: | ---: |
| Bold | \`** **\` or \`__ __\` | \`**Bold text**\` | **Bold text** |
| Italic | \`* *\` or \`_ _\` | \`*Italic text*\` | _Italic text_ |
| Bold & Italic | \`*** ***\` | \`***Bold and italic***\` | ***Bold and italic*** |
| Strikethrough | \`~~ ~~\` | \`~~Striked out text~~\` | ~~Striked out text~~ |
| Highlight | \`== ==\` | \`==Highlighted text==\` | ==Highlighted text== |
| Underline | \`<u> </u>\` | \`<u>Underlined</u>\` | <u>Underlined</u> |
| Escaped Pipe | \`\\|\` | \`A \\| B\` | Cell A \| Cell B |

---

## 3. Lists, Task Checklists & Definition Lists

### Unordered & Nested Bullet Lists
- Primary bullet item one
  - Nested bullet item 1.1
    - Deeply nested bullet item 1.1.1
- Primary bullet item two

### Ordered & Nested Numbered Lists
1. First ordered step
   1. Sub-step 1.1
   2. Sub-step 1.2
2. Second ordered step
3. Third ordered step

### Interactive Task Checklists
- [x] Verify **Bold**, *Italic*, ***Bold-Italic***, ~~Strikethrough~~, ==Highlight==, and <u>Underline</u>
- [x] Verify Superscript <sup>2</sup>, Subscript <sub>i</sub>, <kbd>⌘K</kbd>, and >!Spoiler!<
- [ ] Click this checkbox in Inline Rich Mode to toggle its state
- [ ] Hover the \`⋮⋮\` block handle on the left of any line to drag-reorder or **Turn Into** another block type

### Definition Lists
Local-First Architecture
: All Markdown notes, images, and vector diagrams live directly on your local disk.
: Zero mandatory cloud dependencies or telemetry.

Multi-Root Workspace
: Mount multiple independent folders and Git repositories side-by-side.

---

## 4. Blockquotes & Callout Blocks (All Variants)

> "Simplicity is about subtracting the obvious and adding the meaningful."
> — John Maeda

> [!NOTE] Architectural Note
> Standard informational callout block with custom title.

> [!TIP] Productivity Tip
> Type \`/\` at the start of any line to open the **Slash Command Menu**, or select text to open the **Floating Formatting Toolbar**.

> [!IMPORTANT] Crucial Requirement
> Every mounted workspace root isolates its own \`assets/\` directory for portable image and diagram links.

> [!WARNING] Attention Required
> Modifying files externally automatically refreshes clean buffers via the file watcher.

> [!CAUTION] Destructive Action Warning
> Resolving Git merge conflicts overwrites conflict markers once accepted.

> [!FAQ]- Foldable / Obsidian-Compatible Callout
> Klartext also supports Obsidian callout identifiers like \`[!info]\`, \`[!faq]-\`, \`[!success]\`, and \`[!bug]\`.

---

## 5. Collapsible Details (\`<details>\`)

<details>
<summary>Click to expand implementation benchmarks & latency targets</summary>

- Cold startup target: < 1.2 seconds
- Keystroke-to-preview latency: < 16 ms (60 fps)
- Atomic write safety: temp file + fsync + rename
</details>

---

## 6. Notion-Style Web Bookmark Card (\`:::bookmark\`)

:::bookmark
title: Markdown Guide — Basic & Extended Syntax Reference
url: https://www.markdownguide.org/extended-syntax/
domain: markdownguide.org
description: Comprehensive reference for GitHub-Flavored Markdown tables, footnotes, task lists, and extended formatting.
:::

---

[^1]: First footnote definition — hover over \`[^1]\` in the text above to preview or edit this footnote inline without scrolling!
[^2]: Second footnote definition — supports jumping directly between the reference marker and the bottom definition line.
`
    },
    {
      relativePath: '02-Feature-Test-Diagrams-Math-and-Slides.md',
      content: `---
title: Feature Test 2 — Diagrams, KaTeX Math, Code, Images & Slide Deck
author: Klartext QA Suite
Creation Date: 2026-10-23
status: Verified
category: QA Test Suite
tags:
  - test-suite
  - mermaid
  - katex
  - images
  - excalidraw
  - slides
---

# Feature Test 2 — Diagrams, KaTeX Math, Code, Images & Slide Deck

Use this page to test **Mermaid Diagrams** (with the Visual Drag-and-Drop Builder), **KaTeX Math**, **Syntax-Highlighted Code Blocks**, **Resizable & Alignable Images**, **Excalidraw Vector Drawings**, and **Slide Deck Presentation Mode** (**View → Start Slide Presentation**).

Note: Welcome to Slide 1 of the Klartext Presentation Mode test deck! Use the Left/Right arrow keys to navigate slides, press N to toggle speaker notes, and press L for the laser pointer.

---

## 1. Interactive Mermaid Diagrams (Click "Visual Builder" to Edit Graphically)

### 1.1 Flowchart (\`flowchart LR\`)

\`\`\`mermaid
flowchart LR
  Editor["Markdown Editor"] --> Parser["Unified AST Pipeline"]
  Parser --> Live["Inline Rich Decorations"]
  Parser --> Preview["Split HTML Preview"]
  Live --> Export["PDF / DOCX / Slides"]
\`\`\`

### 1.2 Sequence Diagram (\`sequenceDiagram\`)

\`\`\`mermaid
sequenceDiagram
  participant User
  participant Editor as CodeMirror 6
  participant Main as Electron Main
  participant Disk as Atomic File System
  User->>Editor: Format Selection (⌘B)
  Editor->>Main: saveDocument()
  Main->>Disk: Write .tmp + Rename
  Disk-->>Editor: Saved Confirmation
\`\`\`

### 1.3 State Diagram (\`stateDiagram-v2\`)

\`\`\`mermaid
stateDiagram-v2
  [*] --> Editing
  Editing --> Formatting: Select Text / Slash Cmd
  Formatting --> Editing: Apply Syntax
  Editing --> Presenting: Start Slide Deck
  Presenting --> Editing: Exit Presentation
\`\`\`

### 1.4 Class Diagram (\`classDiagram\`)

\`\`\`mermaid
classDiagram
  class WorkspaceRoot {
    +String id
    +String name
    +String path
    +listFiles()
  }
  class DocumentBuffer {
    +String relativePath
    +Boolean dirty
    +renderMarkdown()
  }
  WorkspaceRoot "1" --> "*" DocumentBuffer : manages
\`\`\`

### 1.5 Entity-Relationship Diagram (\`erDiagram\`)

\`\`\`mermaid
erDiagram
  WORKSPACE ||--o{ ROOT_FOLDER : mounts
  ROOT_FOLDER ||--o{ MARKDOWN_NOTE : stores
  ROOT_FOLDER ||--o{ ASSET_FILE : isolates
\`\`\`

### 1.6 Gantt Roadmap (\`gantt\`)

\`\`\`mermaid
gantt
  title Klartext Release Milestones
  dateFormat YYYY-MM-DD
  section Core Editor
    Inline Rich Decorations :done, m1, 2026-10-01, 7d
    Visual Diagram Builder  :active, m2, 2026-10-08, 7d
  section Visual & Export
    Infinite Canvas & Slides :m3, 2026-10-15, 7d
\`\`\`

### 1.7 Pie Chart (\`pie\`)

\`\`\`mermaid
pie title Documentation Content Mix
  "Markdown Prose" : 45
  "Mermaid & Excalidraw" : 25
  "Code & KaTeX Math" : 20
  "Tables & Callouts" : 10
\`\`\`

### 1.8 Mindmap (\`mindmap\`)

\`\`\`mermaid
mindmap
  root((Klartext))
    Editor
      Inline Rich
      Split View
      Raw Source
    Visuals
      Mermaid Builder
      Excalidraw SVG
      Infinite Canvas
    Export
      PDF & HTML
      Word DOCX
      Slide Deck
\`\`\`

Note: Speaker notes for Slide 2 — Every Mermaid diagram above can be edited visually using the drag-and-drop Visual Builder button.

---

## 2. KaTeX Scientific & Mathematical Notation

Inline math expressions render seamlessly alongside text: Euler's identity $e^{i\\pi} + 1 = 0$, mass-energy equivalence $E = mc^2$, and determinant $\\det(A - \\lambda I) = 0$.

### Multi-Line Display Equations (\`$$ ... $$\`)

$$
\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
$$

$$
\\begin{vmatrix}
a & b \\\\
c & d
\\end{vmatrix} = ad - bc, \\qquad
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

Note: Speaker notes for Slide 3 — KaTeX renders both inline and block LaTeX equations with zero external network requests.

---

## 3. Syntax-Highlighted Code Blocks & Nested Fences

\`\`\`typescript
export function calculateReadingTime(markdown: string): { words: number; minutes: number } {
  const words = markdown.trim().split(/\\s+/).filter(Boolean).length
  return {
    words,
    minutes: Math.max(1, Math.ceil(words / 200))
  }
}
\`\`\`

\`\`\`\`md
Here is a 4-backtick outer Markdown fence demonstrating how raw triple-backtick blocks are documented without breaking the outer fence:

\`\`\`javascript
console.log("Nested code block inside 4-backtick fence!");
\`\`\`
\`\`\`\`

---

## 4. Resizable & Alignable Images + Excalidraw Vector Studio

Click the image below in **Inline Rich Mode** to test:
1. **Blue Selection Border & Deselection** when clicking outside or typing
2. **Corner Drag Resize Handles** & preset width buttons (\`25%\`, \`50%\`, \`75%\`, \`100%\`)
3. **Left / Center / Right Alignment** & inline caption editing
4. **Full-Screen Lightbox Zoom** (double-click the image or click the Zoom button)

![Technical Nordic Workspace Preview|width=480|align=center](assets/images/nordic-workspace-preview.svg)

### Embedded Interactive \`.excalidraw.svg\` Vector Drawing

Click **Edit in Excalidraw Studio** on the card below to sketch freehand diagrams and save directly back into \`assets/drawings/architecture.excalidraw.svg\`:

![System Architecture Drawing](assets/drawings/architecture.excalidraw.svg)

Note: Speaker notes for the final slide — Images support live corner resizing, alignment, captions, and lightbox zoom.
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
