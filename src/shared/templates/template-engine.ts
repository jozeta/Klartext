export interface TemplateEvaluationContext {
  now?: Date
  fileTitle?: string
  fileName?: string
  filePath?: string
  relativePath?: string
  folderName?: string
  folderPath?: string
  parentFolderName?: string
  rootName?: string
  rootPath?: string
  allRootNames?: string[]
  noteCount?: number
  folderNoteCount?: number
  gitBranch?: string
  gitState?: string
  gitStatus?: string
  gitCommit?: string
  gitAuthor?: string
  gitRemote?: string
  userName?: string
  hostName?: string
  osPlatform?: string
  cpuArch?: string
  cpuCores?: number
  memoryFree?: string
  uptime?: string
  ipLocal?: string
  appVersion?: string
  locale?: string
  clipboardText?: string
  selectedText?: string
  envVars?: Record<string, string>
  powerVariables?: Record<string, string>
}

export interface TemplateVariableDocItem {
  token: string
  category:
    | 'Date & Time'
    | 'Folder & File'
    | 'Workspace & Git'
    | 'System & User'
    | 'Editor & Utility'
    | 'Power User & Automation'
  description: string
  exampleOutput: string
}

export interface NoteTemplateItem {
  id: string
  name: string
  description?: string
  content: string
  updatedAt: number
}

export const TEMPLATE_VARIABLES_DOCS: TemplateVariableDocItem[] = [
  // Date & Time
  {
    token: '<% date %>',
    category: 'Date & Time',
    description: 'Current date in ISO format (YYYY-MM-DD)',
    exampleOutput: '2026-10-17'
  },
  {
    token: '<% date_compact %>',
    category: 'Date & Time',
    description: 'Compact date without separators (YYYYMMDD)',
    exampleOutput: '20261017'
  },
  {
    token: '<% time %>',
    category: 'Date & Time',
    description: 'Current 24-hour local time (HH:mm)',
    exampleOutput: '16:15'
  },
  {
    token: '<% time_sec %>',
    category: 'Date & Time',
    description: 'Current 24-hour local time with seconds (HH:mm:ss)',
    exampleOutput: '16:15:42'
  },
  {
    token: '<% time_compact %>',
    category: 'Date & Time',
    description: 'Compact 24-hour time without colons (HHmmss)',
    exampleOutput: '161542'
  },
  {
    token: '<% timestamp_id %>',
    category: 'Date & Time',
    description: 'Zettelkasten / compact timestamp ID (YYYYMMDD-HHmm)',
    exampleOutput: '20261017-1615'
  },
  {
    token: '<% datetime %>',
    category: 'Date & Time',
    description: 'Current date and time (YYYY-MM-DD HH:mm)',
    exampleOutput: '2026-10-17 16:15'
  },
  {
    token: '<% iso %>',
    category: 'Date & Time',
    description: 'Full ISO-8601 timestamp',
    exampleOutput: '2026-10-17T16:15:42.000Z'
  },
  {
    token: '<% utc_date %>',
    category: 'Date & Time',
    description: 'Current UTC date (YYYY-MM-DD)',
    exampleOutput: '2026-10-17'
  },
  {
    token: '<% utc_time %>',
    category: 'Date & Time',
    description: 'Current UTC time (HH:mm)',
    exampleOutput: '14:15'
  },
  {
    token: '<% timezone %>',
    category: 'Date & Time',
    description: 'System IANA timezone identifier',
    exampleOutput: 'Europe/Stockholm'
  },
  {
    token: '<% utc_offset %>',
    category: 'Date & Time',
    description: 'Local UTC timezone offset',
    exampleOutput: '+02:00'
  },
  {
    token: '<% year %>',
    category: 'Date & Time',
    description: 'Current 4-digit year',
    exampleOutput: '2026'
  },
  {
    token: '<% next_year %>',
    category: 'Date & Time',
    description: 'Next calendar year (YYYY)',
    exampleOutput: '2027'
  },
  {
    token: '<% last_year %>',
    category: 'Date & Time',
    description: 'Previous calendar year (YYYY)',
    exampleOutput: '2025'
  },
  {
    token: '<% month %>',
    category: 'Date & Time',
    description: 'Current 2-digit month (01–12)',
    exampleOutput: '10'
  },
  {
    token: '<% month_name %>',
    category: 'Date & Time',
    description: 'Full month name',
    exampleOutput: 'October'
  },
  {
    token: '<% month_short %>',
    category: 'Date & Time',
    description: 'Abbreviated month name',
    exampleOutput: 'Oct'
  },
  {
    token: '<% day %>',
    category: 'Date & Time',
    description: 'Current 2-digit day of the month (01–31)',
    exampleOutput: '17'
  },
  {
    token: '<% day_of_year %>',
    category: 'Date & Time',
    description: 'Day number of the year (1–366)',
    exampleOutput: '290'
  },
  {
    token: '<% days_in_month %>',
    category: 'Date & Time',
    description: 'Total number of days in the current month',
    exampleOutput: '31'
  },
  {
    token: '<% weekday %>',
    category: 'Date & Time',
    description: 'Full day of the week name',
    exampleOutput: 'Saturday'
  },
  {
    token: '<% weekday_short %>',
    category: 'Date & Time',
    description: 'Short day of the week name',
    exampleOutput: 'Sat'
  },
  {
    token: '<% week %>',
    category: 'Date & Time',
    description: 'ISO week number of the year (01–53)',
    exampleOutput: '42'
  },
  {
    token: '<% start_of_week %>',
    category: 'Date & Time',
    description: 'Monday date of the current ISO week (YYYY-MM-DD)',
    exampleOutput: '2026-10-12'
  },
  {
    token: '<% end_of_week %>',
    category: 'Date & Time',
    description: 'Sunday date of the current ISO week (YYYY-MM-DD)',
    exampleOutput: '2026-10-18'
  },
  {
    token: '<% start_of_month %>',
    category: 'Date & Time',
    description: 'First day of the current month (YYYY-MM-01)',
    exampleOutput: '2026-10-01'
  },
  {
    token: '<% end_of_month %>',
    category: 'Date & Time',
    description: 'Last day of the current month (YYYY-MM-DD)',
    exampleOutput: '2026-10-31'
  },
  {
    token: '<% quarter %>',
    category: 'Date & Time',
    description: 'Current fiscal/calendar quarter (Q1–Q4)',
    exampleOutput: 'Q4'
  },
  {
    token: '<% yesterday %>',
    category: 'Date & Time',
    description: 'Yesterday’s date (YYYY-MM-DD)',
    exampleOutput: '2026-10-16'
  },
  {
    token: '<% tomorrow %>',
    category: 'Date & Time',
    description: 'Tomorrow’s date (YYYY-MM-DD)',
    exampleOutput: '2026-10-18'
  },
  {
    token: '<% next_week %>',
    category: 'Date & Time',
    description: 'Date 7 days from today (YYYY-MM-DD)',
    exampleOutput: '2026-10-24'
  },
  {
    token: '<% last_week %>',
    category: 'Date & Time',
    description: 'Date 7 days ago (YYYY-MM-DD)',
    exampleOutput: '2026-10-10'
  },
  {
    token: '<% next_month %>',
    category: 'Date & Time',
    description: 'Date 1 month from today (YYYY-MM-DD)',
    exampleOutput: '2026-11-17'
  },
  {
    token: '<% last_month %>',
    category: 'Date & Time',
    description: 'Date 1 month ago (YYYY-MM-DD)',
    exampleOutput: '2026-09-17'
  },
  {
    token: '<% date +7d %>',
    category: 'Date & Time',
    description: 'Relative date offset (+/- Nd, Nw, Nm, Ny)',
    exampleOutput: '2026-10-24'
  },
  {
    token: '<% date:DD.MM.YYYY %>',
    category: 'Date & Time',
    description: 'Custom formatted date using YYYY, MM, DD, HH, mm, ss',
    exampleOutput: '17.10.2026'
  },
  {
    token: '<% unix %>',
    category: 'Date & Time',
    description: 'Unix epoch timestamp in seconds',
    exampleOutput: '1792246542'
  },

  // Folder & File
  {
    token: '<% title %>',
    category: 'Folder & File',
    description: 'Active note title (filename without .md extension)',
    exampleOutput: 'Architecture-Overview'
  },
  {
    token: '<% file_slug %>',
    category: 'Folder & File',
    description: 'URL-safe lowercase kebab-case slug of the note title',
    exampleOutput: 'architecture-overview'
  },
  {
    token: '<% file_name %>',
    category: 'Folder & File',
    description: 'Active note filename including .md extension',
    exampleOutput: 'Architecture-Overview.md'
  },
  {
    token: '<% file_ext %>',
    category: 'Folder & File',
    description: 'File extension of the note',
    exampleOutput: '.md'
  },
  {
    token: '<% file_path %>',
    category: 'Folder & File',
    description: 'Relative path of the active note inside its workspace root',
    exampleOutput: 'docs/specs/Architecture-Overview.md'
  },
  {
    token: '<% folder_name %>',
    category: 'Folder & File',
    description: 'Name of the folder containing the note',
    exampleOutput: 'specs'
  },
  {
    token: '<% folder_slug %>',
    category: 'Folder & File',
    description: 'Lowercase kebab-case slug of the folder name',
    exampleOutput: 'specs'
  },
  {
    token: '<% folder_path %>',
    category: 'Folder & File',
    description: 'Relative path of the parent folder inside the workspace root',
    exampleOutput: 'docs/specs'
  },
  {
    token: '<% parent_folder %>',
    category: 'Folder & File',
    description: 'Name of the parent folder above the current folder',
    exampleOutput: 'docs'
  },
  {
    token: '<% folder_depth %>',
    category: 'Folder & File',
    description: 'Folder nesting depth inside the workspace root (0 = root)',
    exampleOutput: '2'
  },
  {
    token: '<% breadcrumbs %>',
    category: 'Folder & File',
    description: 'Readable folder breadcrumb trail from workspace root',
    exampleOutput: 'Engineering-Notes > docs > specs'
  },

  // Workspace & Git
  {
    token: '<% root_name %>',
    category: 'Workspace & Git',
    description: 'Name of the active workspace root folder',
    exampleOutput: 'Engineering-Notes'
  },
  {
    token: '<% root_path %>',
    category: 'Workspace & Git',
    description: 'Full filesystem path of the active workspace root',
    exampleOutput: '/Users/alex/Docs/Engineering-Notes'
  },
  {
    token: '<% all_roots %>',
    category: 'Workspace & Git',
    description: 'Comma-separated list of all mounted workspace roots',
    exampleOutput: 'Engineering-Notes, Research-Vault'
  },
  {
    token: '<% root_count %>',
    category: 'Workspace & Git',
    description: 'Total number of mounted workspace roots',
    exampleOutput: '2'
  },
  {
    token: '<% note_count %>',
    category: 'Workspace & Git',
    description: 'Total number of Markdown documents in the workspace',
    exampleOutput: '24'
  },
  {
    token: '<% folder_note_count %>',
    category: 'Workspace & Git',
    description: 'Number of Markdown documents inside the target folder',
    exampleOutput: '5'
  },
  {
    token: '<% git_branch %>',
    category: 'Workspace & Git',
    description: 'Current Git branch of the active repository',
    exampleOutput: 'main'
  },
  {
    token: '<% git_state %>',
    category: 'Workspace & Git',
    description: 'Current Git repository synchronization status',
    exampleOutput: 'Synced'
  },

  // System & User
  {
    token: '<% user %>',
    category: 'System & User',
    description: 'Current system username / document author',
    exampleOutput: 'zeta'
  },
  {
    token: '<% hostname %>',
    category: 'System & User',
    description: 'Local machine hostname',
    exampleOutput: 'MacBook-Pro.local'
  },
  {
    token: '<% os %>',
    category: 'System & User',
    description: 'Operating system name',
    exampleOutput: 'macOS'
  },
  {
    token: '<% arch %>',
    category: 'System & User',
    description: 'System CPU architecture',
    exampleOutput: 'arm64'
  },
  {
    token: '<% app_version %>',
    category: 'System & User',
    description: 'Klartext application version',
    exampleOutput: '1.1.0'
  },
  {
    token: '<% locale %>',
    category: 'System & User',
    description: 'Current system locale',
    exampleOutput: 'sv-SE'
  },
  {
    token: '<% home_dir %>',
    category: 'System & User',
    description: 'User home directory shorthand',
    exampleOutput: '~'
  },

  // Editor & Utility
  {
    token: '<% uuid %>',
    category: 'Editor & Utility',
    description: 'Generates a unique random UUID v4',
    exampleOutput: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  },
  {
    token: '<% short_id %>',
    category: 'Editor & Utility',
    description: 'Generates a compact 8-character alphanumeric ID',
    exampleOutput: 'k9x4m2p8'
  },
  {
    token: '<% nano_id %>',
    category: 'Editor & Utility',
    description: 'Generates a 12-character URL-safe nano ID',
    exampleOutput: 'V1StGXR8_Z5j'
  },
  {
    token: '<% random_hex %>',
    category: 'Editor & Utility',
    description: 'Generates an 8-character hexadecimal token',
    exampleOutput: 'a3f904c2'
  },
  {
    token: '<% random_int %>',
    category: 'Editor & Utility',
    description: 'Generates a random 4-digit integer (or <% random(1, 100) %>)',
    exampleOutput: '4821'
  },
  {
    token: '<% selection %>',
    category: 'Editor & Utility',
    description: 'Currently selected text in the editor',
    exampleOutput: 'Selected text'
  },
  {
    token: '<% clipboard %>',
    category: 'Editor & Utility',
    description: 'Current system clipboard text',
    exampleOutput: 'Copied text'
  },
  {
    token: '<% cursor %>',
    category: 'Editor & Utility',
    description: 'Places the editor cursor at this exact spot after inserting the template',
    exampleOutput: '|'
  },

  // Power User & Automation (CLI, Shell Scripts, AppleScript, URL Fetch, Env & System Telemetry)
  {
    token: '<% exec: uname -sr %>',
    category: 'Power User & Automation',
    description: 'Execute a CLI command in the workspace root and insert its stdout (alias: <% cli: ... %>)',
    exampleOutput: 'Darwin 24.1.0'
  },
  {
    token: '<% sh: echo "Hello from $(whoami)" %>',
    category: 'Power User & Automation',
    description: 'Execute a .sh script path or inline Bash/sh snippet and insert its output (alias: <% bash: ... %>)',
    exampleOutput: 'Hello from zeta'
  },
  {
    token: '<% applescript: return "macOS Ready" %>',
    category: 'Power User & Automation',
    description: 'Execute a macOS AppleScript expression or .scpt script via osascript (alias: <% osascript: ... %>)',
    exampleOutput: 'macOS Ready'
  },
  {
    token: '<% url: https://api.github.com/zen %>',
    category: 'Power User & Automation',
    description: 'Fetch text or data from an HTTP/HTTPS URL and insert the response (aliases: <% fetch: ... %>, <% curl: ... %>)',
    exampleOutput: 'Keep it logically awesome.'
  },
  {
    token: '<% json_url: https://api.github.com | current_user_url %>',
    category: 'Power User & Automation',
    description: 'Fetch JSON from a URL and extract a dot-separated property path',
    exampleOutput: 'https://api.github.com/user'
  },
  {
    token: '<% env:SHELL %>',
    category: 'Power User & Automation',
    description: 'Read a system environment variable by name (e.g. SHELL, USER, HOME, EDITOR)',
    exampleOutput: '/bin/zsh'
  },
  {
    token: '<% git_commit %>',
    category: 'Power User & Automation',
    description: 'Latest short Git commit hash in the active repository',
    exampleOutput: 'a1b2c3d'
  },
  {
    token: '<% git_author %>',
    category: 'Power User & Automation',
    description: 'Configured Git author name for the active repository',
    exampleOutput: 'Johan Zetterström'
  },
  {
    token: '<% git_remote %>',
    category: 'Power User & Automation',
    description: 'Primary Git remote origin URL for the active repository',
    exampleOutput: 'git@github.com:org/repo.git'
  },
  {
    token: '<% uptime %>',
    category: 'Power User & Automation',
    description: 'System uptime formatted in hours and minutes',
    exampleOutput: '14h 22m'
  },
  {
    token: '<% cpu_cores %>',
    category: 'Power User & Automation',
    description: 'Number of logical CPU cores available on the system',
    exampleOutput: '12'
  },
  {
    token: '<% memory_free %>',
    category: 'Power User & Automation',
    description: 'Available and total system memory (RAM) summary',
    exampleOutput: '9.4 GB free / 32.0 GB'
  },
  {
    token: '<% ip_local %>',
    category: 'Power User & Automation',
    description: 'Primary local network IPv4 address of this machine',
    exampleOutput: '192.168.1.42'
  }
]

export const DEFAULT_BUILT_IN_TEMPLATES: NoteTemplateItem[] = [
  {
    id: 'tpl-meeting-notes',
    name: 'Meeting Notes.md',
    description: 'Structured meeting agenda, attendees, discussion notes, and action items',
    updatedAt: 1760000000000,
    content: `---
title: "<% title %>"
date: "<% date %>"
time: "<% time %>"
folder: "<% folder_name %>"
author: "<% user %>"
tags: [meeting, notes]
---

# Meeting: <% title %>

- **Date:** <% weekday %>, <% date %> (<% time %>)
- **Workspace / Folder:** <% root_name %> / <% folder_name %>
- **Facilitator:** <% user %>

## Agenda
1. <% cursor %>
2. 

## Key Discussion Points
- 

## Action Items
- [ ] **@<% user %>** — Follow up by <% next_week %>
`
  },
  {
    id: 'tpl-daily-note',
    name: 'Daily Journal & Log.md',
    description: 'Daily log with ISO week, priorities, work log, and reflections',
    updatedAt: 1760000000000,
    content: `---
title: "Daily Note — <% date %>"
date: "<% date %>"
week: "W<% week %>"
quarter: "<% quarter %>"
tags: [daily, log]
---

# <% weekday %>, <% month_name %> <% day %>, <% year %> (Week <% week %>)

> [!TIP]
> Yesterday: [[<% yesterday %>]] · Tomorrow: [[<% tomorrow %>]]

## Top 3 Priorities Today
- [ ] <% cursor %>
- [ ] 
- [ ] 

## Work Log & Notes
- **<% time %>** — 

## End-of-Day Reflection
- 
`
  },
  {
    id: 'tpl-technical-spec',
    name: 'Technical RFC & Spec.md',
    description: 'Engineering specification with system context, architecture diagram, and rollout plan',
    updatedAt: 1760000000000,
    content: `---
id: "<% short_id %>"
title: "<% title %>"
author: "<% user %>"
date: "<% date %>"
branch: "<% git_branch %>"
status: "Draft"
---

# RFC: <% title %>

| Property | Value |
| :--- | :--- |
| **Document ID** | \`<% short_id %>\` |
| **Author** | <% user %> (<% os %> / <% arch %>) |
| **Created** | <% datetime %> |
| **Location** | \`<% root_name %>/<% file_path %>\` |
| **Git Branch** | \`<% git_branch %>\` |

## 1. Context & Problem Statement
<% cursor %>

## 2. Proposed Architecture

\`\`\`mermaid
flowchart LR
  Client["Client App"] --> Service["Core Service"]
  Service --> Store[("Local Storage")]
\`\`\`

## 3. Risks & Mitigations
> [!WARNING]
> List key edge cases and security considerations before rollout.
`
  },
  {
    id: 'tpl-bug-report',
    name: 'Bug Report & Investigation.md',
    description: 'Issue reproduction steps, environment variables, root cause analysis, and fix checklist',
    updatedAt: 1760000000000,
    content: `---
title: "Bug: <% title %>"
date: "<% date %>"
reporter: "<% user %>"
status: "Investigating"
tags: [bug, triage]
---

# Bug Report: <% title %>

- **Reported:** <% datetime %>
- **Environment:** <% os %> (<% arch %>) · Klartext v<% app_version %>
- **Branch:** \`<% git_branch %>\` (` + '<% git_state %>' + `)
- **Tracking ID:** \`<% uuid %>\`

## Steps to Reproduce
1. <% cursor %>
2. 

## Expected vs. Actual Behavior
- **Expected:** 
- **Actual:** 

## Root Cause & Fix Verification
- [ ] Root cause identified
- [ ] Unit / E2E regression test added
`
  }
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatTime24(d: Date, withSeconds = false): string {
  const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return withSeconds ? `${base}:${pad2(d.getSeconds())}` : base
}

function getIsoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

function formatCustomDatePattern(d: Date, pattern: string): string {
  const yyyy = String(d.getFullYear())
  const yy = yyyy.slice(-2)
  const mmmm = MONTH_NAMES[d.getMonth()]
  const mmm = mmmm.slice(0, 3)
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const dddd = WEEKDAY_NAMES[d.getDay()]
  const ddd = dddd.slice(0, 3)
  const HH = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())

  return pattern
    .replace(/YYYY/g, yyyy)
    .replace(/YY/g, yy)
    .replace(/MMMM/g, mmmm)
    .replace(/MMM/g, mmm)
    .replace(/MM/g, mm)
    .replace(/dddd/g, dddd)
    .replace(/ddd/g, ddd)
    .replace(/DD/g, dd)
    .replace(/HH/g, HH)
    .replace(/mm/g, min)
    .replace(/ss/g, ss)
}

function generateRandomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function generateShortId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function generateNanoId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-'
  let out = ''
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function generateRandomHex(): string {
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += Math.floor(Math.random() * 16).toString(16)
  }
  return out
}

function toSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9-_ ]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-') || 'untitled'
  )
}

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff =
    d.getTime() -
    start.getTime() +
    (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000
  return Math.floor(diff / 86400000)
}

function getDaysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function getUtcOffsetString(d: Date): string {
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}

/**
 * Evaluates dynamic variables (`<% ... %>`) inside a template's name to produce a clean `.md` filename.
 */
export function evaluateTemplateFileName(
  rawTemplateName: string,
  context: TemplateEvaluationContext = {}
): string {
  const stripped = rawTemplateName.replace(/\.(md|markdown)$/i, '').trim() || 'Note'
  const evaluated = evaluateTemplateVariables(stripped, context).output
  const safeStem = evaluated
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${safeStem || 'Note'}.md`
}

/**
 * Evaluates all `<% ... %>` dynamic template variables in `templateContent`
 * and returns the rendered text along with an optional `cursorOffset` if `<% cursor %>` was present.
 */
export function evaluateTemplateVariables(
  templateContent: string,
  context: TemplateEvaluationContext = {}
): { content: string; output: string; cursorOffset: number | null } {
  const now = context.now || new Date()
  const filePath = (context.filePath || context.relativePath || 'Untitled.md').replace(/\\/g, '/')
  const fileName = context.fileName || filePath.split('/').pop() || 'Untitled.md'
  const fileTitle =
    context.fileTitle || fileName.replace(/\.(md|markdown)$/i, '') || 'Untitled'

  const dirParts = filePath.split('/')
  dirParts.pop()
  const folderPath = (context.folderPath ?? dirParts.join('/')).replace(/^\/+/, '')
  const cleanFolderSegments = folderPath.split('/').filter(Boolean)
  const folderName =
    context.folderName ||
    (cleanFolderSegments.length > 0
      ? cleanFolderSegments[cleanFolderSegments.length - 1]
      : context.rootName || 'Root')

  const rootName = context.rootName || 'Workspace'
  const rootPath = context.rootPath || ''
  const allRootNames =
    context.allRootNames && context.allRootNames.length > 0 ? context.allRootNames : [rootName]
  const gitBranch = context.gitBranch || 'main'
  const gitState = context.gitState || context.gitStatus || 'Local'
  const userName = context.userName || 'user'
  const hostName = context.hostName || 'localhost'
  const osPlatform = context.osPlatform || 'macOS'
  const cpuArch = context.cpuArch || 'arm64'
  const appVersion = context.appVersion || '1.1.0'
  const locale =
    context.locale ||
    (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US')
  const clipboardText = context.clipboardText || ''
  const selectedText = context.selectedText || ''

  const CURSOR_SENTINEL = '\u0000KLARTEXT_CURSOR_SENTINEL\u0000'

  const replaced = templateContent.replace(/<%([\s\S]*?)%>/g, (fullMatch, rawInner: string) => {
    const expr = rawInner.trim()
    if (!expr) return fullMatch
    const lower = expr.toLowerCase()

    // Cursor marker
    if (lower === 'cursor' || lower === 'tp.file.cursor()' || lower === 'tp.file.cursor') {
      return CURSOR_SENTINEL
    }

    // Standard Date & Time tokens
    if (lower === 'date' || lower === 'today' || lower === 'tp.date.now' || lower === 'tp.date.now()') {
      return formatIsoDate(now)
    }
    if (lower === 'date_compact' || lower === 'datecompact') {
      return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
    }
    if (lower === 'time') {
      return formatTime24(now, false)
    }
    if (lower === 'time_sec' || lower === 'timesec') {
      return formatTime24(now, true)
    }
    if (lower === 'time_compact' || lower === 'timecompact') {
      return `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
    }
    if (lower === 'timestamp_id' || lower === 'timestampid' || lower === 'zettelkasten_id') {
      return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`
    }
    if (lower === 'datetime' || lower === 'date_time' || lower === 'now') {
      return `${formatIsoDate(now)} ${formatTime24(now, false)}`
    }
    if (lower === 'iso' || lower === 'timestamp') {
      return now.toISOString()
    }
    if (lower === 'utc_date' || lower === 'utcdate') {
      return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`
    }
    if (lower === 'utc_time' || lower === 'utctime') {
      return `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}`
    }
    if (lower === 'timezone' || lower === 'tz') {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      } catch {
        return 'UTC'
      }
    }
    if (lower === 'utc_offset' || lower === 'utcoffset') {
      return getUtcOffsetString(now)
    }
    if (lower === 'unix' || lower === 'epoch') {
      return String(Math.floor(now.getTime() / 1000))
    }
    if (lower === 'year') {
      return String(now.getFullYear())
    }
    if (lower === 'next_year' || lower === 'nextyear') {
      return String(now.getFullYear() + 1)
    }
    if (lower === 'last_year' || lower === 'lastyear' || lower === 'prev_year') {
      return String(now.getFullYear() - 1)
    }
    if (lower === 'month') {
      return pad2(now.getMonth() + 1)
    }
    if (lower === 'month_name' || lower === 'monthname') {
      return MONTH_NAMES[now.getMonth()]
    }
    if (lower === 'month_short' || lower === 'monthshort') {
      return MONTH_NAMES[now.getMonth()].slice(0, 3)
    }
    if (lower === 'day') {
      return pad2(now.getDate())
    }
    if (lower === 'day_of_year' || lower === 'dayofyear') {
      return String(getDayOfYear(now))
    }
    if (lower === 'days_in_month' || lower === 'daysinmonth') {
      return String(getDaysInMonth(now))
    }
    if (lower === 'weekday' || lower === 'day_name' || lower === 'dayname') {
      return WEEKDAY_NAMES[now.getDay()]
    }
    if (lower === 'weekday_short' || lower === 'day_short') {
      return WEEKDAY_NAMES[now.getDay()].slice(0, 3)
    }
    if (lower === 'week' || lower === 'iso_week' || lower === 'week_number') {
      return pad2(getIsoWeekNumber(now))
    }
    if (lower === 'start_of_week' || lower === 'startofweek') {
      const d = new Date(now)
      const dayOfWeek = d.getDay() || 7
      d.setDate(d.getDate() - (dayOfWeek - 1))
      return formatIsoDate(d)
    }
    if (lower === 'end_of_week' || lower === 'endofweek') {
      const d = new Date(now)
      const dayOfWeek = d.getDay() || 7
      d.setDate(d.getDate() + (7 - dayOfWeek))
      return formatIsoDate(d)
    }
    if (lower === 'start_of_month' || lower === 'startofmonth') {
      return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
    }
    if (lower === 'end_of_month' || lower === 'endofmonth') {
      return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(getDaysInMonth(now))}`
    }
    if (lower === 'quarter') {
      return `Q${Math.floor(now.getMonth() / 3) + 1}`
    }
    if (lower === 'yesterday' || lower === 'tp.date.yesterday' || lower === 'tp.date.yesterday()') {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return formatIsoDate(d)
    }
    if (lower === 'tomorrow' || lower === 'tp.date.tomorrow' || lower === 'tp.date.tomorrow()') {
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      return formatIsoDate(d)
    }
    if (lower === 'next_week' || lower === 'nextweek') {
      const d = new Date(now)
      d.setDate(d.getDate() + 7)
      return formatIsoDate(d)
    }
    if (lower === 'last_week' || lower === 'lastweek' || lower === 'prev_week') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return formatIsoDate(d)
    }
    if (lower === 'next_month' || lower === 'nextmonth') {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 1)
      return formatIsoDate(d)
    }
    if (lower === 'last_month' || lower === 'lastmonth' || lower === 'prev_month') {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return formatIsoDate(d)
    }

    // Relative date math: <% date +3d %>, <% date -2w %>, <% date +1m %>, <% date +1y %>
    const relDateMatch = expr.match(/^date\s*([+-]\s*\d+)\s*([dwmyDWMY]?)$/)
    if (relDateMatch) {
      const amount = parseInt(relDateMatch[1].replace(/\s+/g, ''), 10)
      const unit = (relDateMatch[2] || 'd').toLowerCase()
      const d = new Date(now)
      if (unit === 'd') d.setDate(d.getDate() + amount)
      else if (unit === 'w') d.setDate(d.getDate() + amount * 7)
      else if (unit === 'm') d.setMonth(d.getMonth() + amount)
      else if (unit === 'y') d.setFullYear(d.getFullYear() + amount)
      return formatIsoDate(d)
    }

    // Custom date format: <% date:YYYY/MM/DD %> or <% tp.date.now("YYYY-MM-DD") %>
    const customDateColon = expr.match(/^(?:date|time|datetime):(.+)$/i)
    if (customDateColon) {
      return formatCustomDatePattern(now, customDateColon[1].trim())
    }
    const tpDateCall = expr.match(/^tp\.date\.now\(\s*['"]([^'"]+)['"]\s*\)$/i)
    if (tpDateCall) {
      return formatCustomDatePattern(now, tpDateCall[1])
    }

    // File & Folder variables
    if (
      lower === 'title' ||
      lower === 'file_title' ||
      lower === 'note_title' ||
      lower === 'tp.file.title'
    ) {
      return fileTitle
    }
    if (lower === 'file_slug' || lower === 'fileslug' || lower === 'slug') {
      return toSlug(fileTitle)
    }
    if (lower === 'file_name' || lower === 'filename') {
      return fileName
    }
    if (lower === 'file_ext' || lower === 'fileext' || lower === 'ext') {
      const dotIdx = fileName.lastIndexOf('.')
      return dotIdx !== -1 ? fileName.slice(dotIdx) : '.md'
    }
    if (lower === 'file_path' || lower === 'filepath' || lower === 'path' || lower === 'tp.file.path') {
      return filePath
    }
    if (
      lower === 'folder' ||
      lower === 'folder_name' ||
      lower === 'foldername' ||
      lower === 'tp.file.folder' ||
      lower === 'tp.file.folder()'
    ) {
      return folderName
    }
    if (lower === 'folder_slug' || lower === 'folderslug') {
      return toSlug(folderName)
    }
    if (lower === 'folder_path' || lower === 'folderpath') {
      return folderPath || '/'
    }
    if (lower === 'parent_folder' || lower === 'parentfolder') {
      return context.parentFolderName || folderName
    }
    if (lower === 'folder_depth' || lower === 'folderdepth') {
      return String(cleanFolderSegments.length)
    }
    if (lower === 'breadcrumbs' || lower === 'breadcrumb') {
      return [rootName, ...cleanFolderSegments].join(' > ')
    }

    // Workspace & Git variables
    if (
      lower === 'root' ||
      lower === 'root_name' ||
      lower === 'rootname' ||
      lower === 'workspace'
    ) {
      return rootName
    }
    if (lower === 'root_path' || lower === 'rootpath' || lower === 'workspace_path') {
      return rootPath
    }
    if (lower === 'all_roots' || lower === 'allroots') {
      return allRootNames.join(', ')
    }
    if (lower === 'root_count' || lower === 'rootcount') {
      return String(allRootNames.length)
    }
    if (lower === 'note_count' || lower === 'notecount') {
      return String(context.noteCount ?? 1)
    }
    if (lower === 'folder_note_count' || lower === 'foldernotecount') {
      return String(context.folderNoteCount ?? 1)
    }
    if (lower === 'git_branch' || lower === 'branch') {
      return gitBranch
    }
    if (lower === 'git_state' || lower === 'git_status') {
      return gitState
    }
    if (lower === 'git_commit' || lower === 'commit' || lower === 'git_sha') {
      return context.gitCommit || context.powerVariables?.['git_commit'] || 'HEAD'
    }
    if (lower === 'git_author' || lower === 'commit_author') {
      return context.gitAuthor || context.powerVariables?.['git_author'] || userName
    }
    if (lower === 'git_remote' || lower === 'remote_url' || lower === 'origin') {
      return context.gitRemote || context.powerVariables?.['git_remote'] || 'local'
    }

    // System & Environment variables
    if (lower === 'user' || lower === 'username' || lower === 'author') {
      return userName
    }
    if (lower === 'hostname' || lower === 'host') {
      return hostName
    }
    if (lower === 'os' || lower === 'platform') {
      return osPlatform
    }
    if (lower === 'arch' || lower === 'cpu_arch') {
      return cpuArch
    }
    if (lower === 'cpu_cores' || lower === 'cores' || lower === 'cpus') {
      return String(context.cpuCores ?? context.powerVariables?.['cpu_cores'] ?? 8)
    }
    if (lower === 'memory_free' || lower === 'mem_free' || lower === 'free_memory') {
      return context.memoryFree || context.powerVariables?.['memory_free'] || '8.0 GB'
    }
    if (lower === 'uptime' || lower === 'system_uptime') {
      return context.uptime || context.powerVariables?.['uptime'] || '1d 0h'
    }
    if (lower === 'ip_local' || lower === 'local_ip' || lower === 'ip') {
      return context.ipLocal || context.powerVariables?.['ip_local'] || '127.0.0.1'
    }
    if (lower === 'app_version' || lower === 'version') {
      return appVersion
    }
    if (lower === 'locale' || lower === 'lang') {
      return locale
    }
    if (lower === 'home_dir' || lower === 'homedir' || lower === 'home') {
      return '~'
    }

    // Power-user dynamic variables: pre-resolved powerVariables map first
    if (context.powerVariables && Object.prototype.hasOwnProperty.call(context.powerVariables, expr)) {
      return context.powerVariables[expr]
    }

    // Environment variable lookup: <% env:VAR_NAME %>
    const envMatch = expr.match(/^env:\s*(.+)$/i)
    if (envMatch) {
      const varName = envMatch[1].trim()
      if (context.envVars && Object.prototype.hasOwnProperty.call(context.envVars, varName)) {
        return context.envVars[varName]
      }
      if (varName === 'USER' || varName === 'LOGNAME') return userName
      if (varName === 'SHELL') return '/bin/zsh'
      if (varName === 'HOME') return '~'
      if (varName === 'LANG') return locale
      return context.powerVariables?.[expr] ?? ''
    }

    // CLI / Shell / AppleScript / URL / JSON URL expressions
    const execMatch = expr.match(/^(exec|cli|cmd|sh|bash|zsh|script|applescript|osascript|url|fetch|curl|http|json_url|json):\s*(.+)$/i)
    if (execMatch) {
      const kind = execMatch[1].toLowerCase()
      const payload = execMatch[2].trim()
      if (context.powerVariables && Object.prototype.hasOwnProperty.call(context.powerVariables, expr)) {
        return context.powerVariables[expr]
      }
      // Deterministic synchronous fallbacks when evaluated outside async IPC
      if (kind === 'exec' || kind === 'cli' || kind === 'cmd' || kind === 'sh' || kind === 'bash' || kind === 'zsh' || kind === 'script') {
        const echoMatch = payload.match(/^echo\s+(['"]?)(.*?)\1$/i)
        if (echoMatch) return echoMatch[2]
        if (payload === 'whoami') return userName
        if (payload === 'hostname') return hostName
        if (payload === 'pwd') return rootPath || '~'
        if (payload.startsWith('uname')) return `${osPlatform} ${cpuArch}`
        return `[output:${payload}]`
      }
      if (kind === 'applescript' || kind === 'osascript') {
        return `[applescript:${payload}]`
      }
      if (kind === 'url' || kind === 'fetch' || kind === 'curl' || kind === 'http') {
        return `[url:${payload}]`
      }
      if (kind === 'json_url' || kind === 'json') {
        return `[json:${payload}]`
      }
    }

    // Utility & Editor variables
    if (lower === 'uuid' || lower === 'guid') {
      return generateRandomUuid()
    }
    if (lower === 'short_id' || lower === 'random_id' || lower === 'id') {
      return generateShortId()
    }
    if (lower === 'nano_id' || lower === 'nanoid') {
      return generateNanoId()
    }
    if (lower === 'random_hex' || lower === 'randomhex' || lower === 'hex') {
      return generateRandomHex()
    }
    if (lower === 'random_int' || lower === 'randomint') {
      return String(Math.floor(1000 + Math.random() * 9000))
    }
    const randomRangeCall = expr.match(/^random\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/i)
    if (randomRangeCall) {
      const min = parseInt(randomRangeCall[1], 10)
      const max = parseInt(randomRangeCall[2], 10)
      const lo = Math.min(min, max)
      const hi = Math.max(min, max)
      return String(Math.floor(lo + Math.random() * (hi - lo + 1)))
    }
    if (lower === 'clipboard' || lower === 'tp.system.clipboard' || lower === 'tp.system.clipboard()') {
      return clipboardText
    }
    if (lower === 'selection' || lower === 'tp.file.selection' || lower === 'tp.file.selection()') {
      return selectedText
    }

    return fullMatch
  })

  const sentinelIdx = replaced.indexOf(CURSOR_SENTINEL)
  if (sentinelIdx !== -1) {
    const cleanContent = replaced.replace(new RegExp(CURSOR_SENTINEL, 'g'), '')
    return {
      content: cleanContent,
      output: cleanContent,
      cursorOffset: sentinelIdx
    }
  }

  return {
    content: replaced,
    output: replaced,
    cursorOffset: null
  }
}

export function extractPowerTemplateExpressions(templateContent: string): string[] {
  const expressions = new Set<string>()
  const regex = /<%\s*([^%]+?)\s*%>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(templateContent)) !== null) {
    const expr = match[1].trim()
    const lower = expr.toLowerCase()
    if (
      /^(exec|cli|cmd|sh|bash|zsh|script|applescript|osascript|url|fetch|curl|http|json_url|json|env):\s*(.+)$/i.test(
        expr
      ) ||
      lower === 'git_commit' ||
      lower === 'commit' ||
      lower === 'git_sha' ||
      lower === 'git_author' ||
      lower === 'commit_author' ||
      lower === 'git_remote' ||
      lower === 'remote_url' ||
      lower === 'origin' ||
      lower === 'cpu_cores' ||
      lower === 'memory_free' ||
      lower === 'uptime' ||
      lower === 'ip_local'
    ) {
      expressions.add(expr)
    }
  }
  return Array.from(expressions)
}

export async function evaluateTemplateVariablesAsync(
  templateContent: string,
  context: TemplateEvaluationContext = {},
  powerEvaluator?: (
    expressions: string[],
    cwd?: string
  ) => Promise<Record<string, string>>
): Promise<{
  content: string
  output: string
  cursorOffset: number | null
}> {
  const expressions = extractPowerTemplateExpressions(templateContent)
  if (expressions.length === 0) {
    return evaluateTemplateVariables(templateContent, context)
  }

  let resolvedPower: Record<string, string> = { ...(context.powerVariables || {}) }
  if (powerEvaluator) {
    try {
      const fromIpc = await powerEvaluator(expressions, context.rootPath)
      const map =
        fromIpc &&
        typeof (fromIpc as unknown as { powerVariables?: Record<string, string> }).powerVariables ===
          'object'
          ? (fromIpc as unknown as { powerVariables: Record<string, string> }).powerVariables
          : fromIpc
      resolvedPower = { ...resolvedPower, ...(map || {}) }
    } catch {
      // Fallback to synchronous evaluation
    }
  } else if (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { klartext?: { evaluatePowerTemplate?: (payload: { expressions: string[]; cwd?: string }) => Promise<{ powerVariables: Record<string, string> }> } }).klartext?.evaluatePowerTemplate === 'function'
  ) {
    try {
      const res = await (window as unknown as { klartext: { evaluatePowerTemplate: (payload: { expressions: string[]; cwd?: string }) => Promise<{ powerVariables: Record<string, string> }> } }).klartext.evaluatePowerTemplate({
        expressions,
        cwd: context.rootPath
      })
      if (res?.powerVariables) {
        resolvedPower = { ...resolvedPower, ...res.powerVariables }
      }
    } catch {
      // Fallback to synchronous evaluation
    }
  }

  return evaluateTemplateVariables(templateContent, {
    ...context,
    powerVariables: resolvedPower
  })
}

