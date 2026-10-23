import React, { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Code2,
  Sparkles,
  Keyboard,
  Copy,
  Check,
  X,
  Search,
  Server,
  Info,
  RefreshCw,
  ExternalLink
} from '../icons/untitled-icons'
import { APP_METADATA } from '../../../shared/constants'
import type { UpdateCheckResult } from '../../../shared/types'
import {
  TEMPLATE_VARIABLES_DOCS,
  evaluateTemplateVariables,
  type TemplateEvaluationContext
} from '../../../shared/templates/template-engine'

export type HelpModalTab = 'formatting' | 'variables' | 'shortcuts' | 'ai' | 'about'

const FORMATTING_REFERENCE_SECTIONS = [
  {
    title: 'Text Styles & Inline Formatting',
    items: [
      { label: 'Bold', syntax: '**bold text**', shortcut: '⌘B' },
      { label: 'Italic', syntax: '*italic text*', shortcut: '⌘I' },
      { label: 'Bold & Italic', syntax: '***bold & italic***', shortcut: '' },
      { label: 'Strikethrough', syntax: '~~strikethrough~~', shortcut: '⇧⌘X' },
      { label: 'Highlight', syntax: '==highlighted text==', shortcut: '⇧⌘H' },
      { label: 'Underline', syntax: '<u>underlined text</u>', shortcut: '' },
      { label: 'Inline Code', syntax: '`const x = 42`', shortcut: '' },
      { label: 'Keyboard Shortcut Key', syntax: '<kbd>⌘K</kbd>', shortcut: '' },
      { label: 'Spoiler (Hover to Reveal)', syntax: '>!hidden spoiler!<', shortcut: '' },
      { label: 'Superscript / Subscript', syntax: 'X<sup>2</sup> · H<sub>2</sub>O', shortcut: '' }
    ]
  },
  {
    title: 'Headings, Lists & Structure',
    items: [
      { label: 'Headings 1 – 6', syntax: '# H1, ## H2, ### H3 ... ###### H6', shortcut: '' },
      { label: 'Bulleted List', syntax: '- List item (Smart Enter continues)', shortcut: '' },
      { label: 'Numbered List', syntax: '1. First item (Auto-increments on Enter)', shortcut: '' },
      { label: 'Task Checklist', syntax: '- [ ] Todo item / - [x] Completed', shortcut: '' },
      { label: 'Definition List', syntax: 'Term\n: Definition description', shortcut: '' },
      { label: 'Blockquote', syntax: '> Quoted paragraph', shortcut: '' },
      { label: 'Collapsible Section', syntax: '<details><summary>Title</summary>Body</details>', shortcut: '' },
      { label: 'Table of Contents', syntax: '[[_TOC_]] or [TOC]', shortcut: '' },
      { label: 'Horizontal Divider', syntax: '---', shortcut: '' }
    ]
  },
  {
    title: 'Callouts, Alerts, Tables, Math & Diagrams',
    items: [
      { label: 'Note / Tip Callout', syntax: '> [!NOTE]\n> Helpful context or tip', shortcut: '' },
      { label: 'Warning / Caution Alert', syntax: '> [!WARNING]\n> Critical warning note', shortcut: '' },
      { label: 'GFM Table (Tab navigates cells)', syntax: '| Col A | Col B |\n| :--- | :--- |\n| Val 1 | Val 2 |', shortcut: '' },
      { label: 'Prettify & Align Document', syntax: 'Auto-aligns all GFM tables & spacing', shortcut: '⇧⌘I' },
      { label: 'Inline & Display Math (KaTeX)', syntax: '$E = mc^2$ or $$\\sum_{i=1}^n x_i$$', shortcut: '' },
      { label: 'Wiki-Link & Footnote', syntax: '[[Document Name]] · Text[^1]', shortcut: '' },
      { label: 'Mermaid Diagram Block', syntax: '```mermaid\nflowchart LR\n  A --> B\n```', shortcut: '' }
    ]
  }
]

const SHORTCUTS_REFERENCE = [
  { action: 'Bold Selection', keys: '⌘B' },
  { action: 'Italic Selection', keys: '⌘I' },
  { action: 'Strikethrough Selection', keys: '⇧⌘X' },
  { action: 'Highlight Selection (==text==)', keys: '⇧⌘H' },
  { action: 'Insert Hyperlink', keys: '⌘K (in editor)' },
  { action: 'Format & Prettify Document / Align Tables', keys: '⇧⌘I or ⌥⇧F' },
  { action: 'Switch to Source / Live Preview / Split Mode', keys: '⌘1 / ⌘2 / ⌘3' },
  { action: 'Quick Switcher (Open File Across Roots)', keys: '⌘P' },
  { action: 'Command Palette', keys: '⌘K' },
  { action: 'Insert Icon Search (Command Palette)', keys: '⇧⌘I' },
  { action: 'Toggle Zen / Focus Mode', keys: '⇧⌘F' },
  { action: 'Inline Local AI Draft Bar', keys: '⌘J' },
  { action: 'Next / Previous Cell in Markdown Table', keys: 'Tab / Shift+Tab' },
  { action: 'Continue or Exit List / Task / Blockquote', keys: 'Enter' }
]

const AI_SETUP_COMMANDS = [
  {
    label: 'Recommended Bilingual Model (16 GB+ RAM)',
    cmd: 'ollama pull gemma4:12b',
    note: 'Best balance for Swedish & English rewriting, Klarspråk, and Multi-Root Q&A.'
  },
  {
    label: 'Fast Bilingual Model (8–16 GB RAM)',
    cmd: 'ollama pull qwen3:8b',
    note: 'Fast local reasoning, summarization, and SV/EN translation.'
  },
  {
    label: 'Lightweight Entry Model (8 GB RAM)',
    cmd: 'ollama pull gemma3:4b',
    note: 'Low memory footprint for quick grammar & särskrivning fixes.'
  }
]

export const HelpModal: React.FC<{
  initialTab?: HelpModalTab
  evaluationContext: TemplateEvaluationContext
  onInsertSnippet?: (snippet: string) => void
  onInsertVariableTag?: (tag: string) => void
  onClose: () => void
}> = ({
  initialTab = 'formatting',
  evaluationContext,
  onInsertSnippet,
  onInsertVariableTag,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<HelpModalTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  const filteredVariables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return TEMPLATE_VARIABLES_DOCS
    return TEMPLATE_VARIABLES_DOCS.filter(
      (v) =>
        v.token.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const handleCopyToken = (token: string) => {
    navigator.clipboard?.writeText(token).catch(() => {})
    setCopiedToken(token)
    setTimeout(() => setCopiedToken((prev) => (prev === token ? null : prev)), 1400)
  }

  const handleInsert = onInsertSnippet || onInsertVariableTag

  return (
    <aside
      data-testid="right-help-panel"
      className="h-full w-full bg-app border-l border-subtle flex flex-col overflow-hidden text-xs select-none"
    >
      <div
        data-testid="help-reference-modal"
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-panel border-b border-subtle shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="font-semibold text-primary truncate">
              Help &amp; Reference
            </span>
          </div>
          <button
            type="button"
            title="Hide Help Panel"
            data-testid="close-help-modal-btn"
            onClick={onClose}
            className="p-0.5 rounded hover:bg-secondary text-muted hover:text-primary shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-2.5 py-2 bg-secondary/40 border-b border-subtle space-y-2 shrink-0">
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              data-testid="help-tab-formatting"
              onClick={() => setActiveTab('formatting')}
              className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'formatting'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Code2 className="w-3 h-3 shrink-0" />
              <span className="truncate">Formatting</span>
            </button>
            <button
              type="button"
              data-testid="help-tab-variables"
              onClick={() => setActiveTab('variables')}
              className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'variables'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate">Variables</span>
            </button>
            <button
              type="button"
              data-testid="help-tab-ai"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'ai'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Server className="w-3 h-3 shrink-0" />
              <span className="truncate">Local AI &amp; Q&amp;A</span>
            </button>
            <button
              type="button"
              data-testid="help-tab-shortcuts"
              onClick={() => setActiveTab('shortcuts')}
              className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'shortcuts'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Keyboard className="w-3 h-3 shrink-0" />
              <span className="truncate">Shortcuts</span>
            </button>
            <button
              type="button"
              data-testid="help-tab-about"
              onClick={() => setActiveTab('about')}
              className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'about'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Info className="w-3 h-3 shrink-0" />
              <span className="truncate">About</span>
            </button>
          </div>

          {activeTab === 'variables' && (
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1.5 pointer-events-none" />
              <input
                type="text"
                data-testid="help-variables-search"
                placeholder="Filter variables (date, folder, git, random...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent text-[11px]"
              />
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 select-text">
          {activeTab === 'formatting' && (
            <div className="space-y-4" data-testid="help-formatting-section">
              {FORMATTING_REFERENCE_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-1.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {section.title}
                  </h3>
                  <div className="border border-subtle rounded-md overflow-hidden bg-panel">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-secondary/70 border-b border-subtle text-[10px] text-muted">
                          <th className="py-1.5 px-2.5">Element</th>
                          <th className="py-1.5 px-2.5">Syntax</th>
                          <th className="py-1.5 px-2 text-right">Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {section.items.map((item) => (
                          <tr key={item.label} className="hover:bg-secondary/30">
                            <td className="py-1.5 px-2.5 font-medium text-primary text-[11px]">
                              {item.label}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-accent whitespace-pre-wrap break-all">
                              {item.syntax}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-[10px] text-muted whitespace-nowrap">
                              {item.shortcut || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'variables' && (
            <div className="space-y-3" data-testid="help-variables-section">
              <div className="p-2.5 rounded-md bg-secondary/60 border border-subtle space-y-1 text-[11px]">
                <div className="font-semibold text-primary">
                  Dynamic Variables (&lt;% %&gt;) in Templates &amp; Names
                </div>
                <p className="text-muted leading-relaxed">
                  Use{' '}
                  <code className="font-mono text-accent px-1 py-0.5 rounded bg-panel border border-subtle">
                    &lt;% variable %&gt;
                  </code>{' '}
                  inside template content or template filenames (e.g.{' '}
                  <code className="font-mono text-accent">Daily-&lt;% date %&gt;</code>) to evaluate live values automatically.
                </p>
              </div>

              <div className="space-y-2">
                {filteredVariables.map((v) => {
                  const liveVal =
                    v.token === '<% cursor %>'
                      ? '(Cursor Position)'
                      : evaluateTemplateVariables(v.token, {
                          ...evaluationContext,
                          now: new Date()
                        }).content
                  const isCopied = copiedToken === v.token
                  return (
                    <div
                      key={v.token}
                      className="p-2 rounded-md bg-panel border border-subtle hover:border-accent/60 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <code className="font-mono text-[11px] text-accent font-semibold">
                          {v.token}
                        </code>
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted">
                            {v.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyToken(v.token)}
                            className="px-1.5 py-0.5 rounded bg-secondary border border-subtle hover:border-accent text-primary inline-flex items-center gap-1 text-[10px]"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5 text-muted" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          {handleInsert && (
                            <button
                              type="button"
                              onClick={() => handleInsert(v.token)}
                              className="px-1.5 py-0.5 rounded bg-accent text-white font-medium text-[10px]"
                            >
                              Insert
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-primary">{v.description}</div>
                      <div className="text-[10px] font-mono text-muted truncate">
                        Live: <span className="text-primary">{liveVal}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4" data-testid="help-ai-section">
              {/* Overview Card */}
              <div className="p-2.5 rounded-md bg-secondary/60 border border-subtle space-y-1.5 text-[11px]">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Local AI Assistant &amp; Multi-Root Workspace Q&amp;A (SV / EN)</span>
                </div>
                <p className="text-muted leading-relaxed">
                  Klartext runs AI 100% locally over loopback (<code className="font-mono text-accent">127.0.0.1</code>) so your notes and security documents never leave your machine. If no external Ollama or LM Studio server is running, Klartext automatically falls back to its built-in bilingual (Swedish &amp; English) rewrite, grammar/särskrivning, and RAG engine.
                </p>
              </div>

              {/* Section 1: Multi-Root Workspace Q&A (Local RAG) */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  1. Multi-Root Workspace Q&amp;A (Local RAG) — How It Works
                </h3>
                <div className="p-2.5 rounded-md bg-panel border border-subtle space-y-2 text-[11px]">
                  <p className="text-primary leading-relaxed">
                    <strong>Multi-Root Workspace Q&amp;A</strong> lets you ask questions in <strong>Svenska</strong> or <strong>English</strong> across all mounted root folders simultaneously and get answers grounded in your actual Markdown files.
                  </p>
                  <div className="space-y-1 text-muted">
                    <div>
                      <strong className="text-primary">Where to find it:</strong> Open the <strong>Local AI Assistant</strong> panel on the right and click to expand <strong>Local AI Setup &amp; Connection</strong>.
                    </div>
                    <div>
                      <strong className="text-primary">How it works under the hood:</strong>
                      <ol className="list-decimal list-inside space-y-1 pt-1 pl-1">
                        <li>
                          <strong>Cross-Root Search:</strong> Extracts key Swedish &amp; English terms from your question and scans all mounted workspace roots (<code className="font-mono">.md</code>, <code className="font-mono">.txt</code>, <code className="font-mono">.yaml</code>, <code className="font-mono">.json</code>). For broad overview questions, it automatically gathers top document summaries across roots.
                        </li>
                        <li>
                          <strong>Grounded Context &amp; Provenance:</strong> Collects matching excerpts with line numbers and tags each excerpt with <code className="font-mono text-accent">[Root Name / File Path]</code>.
                        </li>
                        <li>
                          <strong>Answer &amp; Clickable Citations:</strong> Synthesizes a concise answer using your active local model (or built-in offline synthesis) and renders clickable <code className="font-mono text-accent">[Root / File]</code> source badges that open the cited file directly in the editor.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: How to Set Up Local AI (Ollama / LM Studio) */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  2. Setting Up Local AI (Ollama or LM Studio)
                </h3>
                <div className="p-2.5 rounded-md bg-panel border border-subtle space-y-2 text-[11px]">
                  <ol className="list-decimal list-inside space-y-1.5 text-muted leading-relaxed">
                    <li>
                      <strong className="text-primary">Install a Local Runtime:</strong> Download <strong>Ollama</strong> (<code className="font-mono text-accent">https://ollama.com</code>, default port <code className="font-mono">11434</code>) or <strong>LM Studio</strong> (OpenAI-compatible server on port <code className="font-mono">1234</code>).
                    </li>
                    <li>
                      <strong className="text-primary">Pull a Recommended SV/EN Model:</strong> Run one of the commands below in your terminal (or expand <strong>Hardware &amp; Model Advisor</strong> in the AI panel to see recommendations tailored to your Mac&apos;s RAM):
                    </li>
                  </ol>

                  <div className="space-y-1.5 pt-1">
                    {AI_SETUP_COMMANDS.map((item) => {
                      const isCopied = copiedToken === item.cmd
                      return (
                        <div
                          key={item.cmd}
                          className="p-2 rounded bg-app border border-subtle space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-primary text-[11px]">
                              {item.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyToken(item.cmd)}
                              className="px-1.5 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary inline-flex items-center gap-1 text-[10px] font-mono shrink-0"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-success" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5 text-muted" />
                                  <span>{item.cmd}</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-muted">{item.note}</div>
                        </div>
                      )
                    })}
                  </div>

                  <ol start={3} className="list-decimal list-inside space-y-1.5 text-muted leading-relaxed pt-1">
                    <li>
                      <strong className="text-primary">Connect &amp; Test in Klartext:</strong> Open the right <strong>Local AI Assistant</strong> panel, expand <strong>Local AI Setup &amp; Connection</strong>, verify the endpoint (<code className="font-mono text-accent">http://127.0.0.1:11434</code> for Ollama or <code className="font-mono text-accent">http://127.0.0.1:1234</code> for LM Studio), and click <strong>Test</strong>.
                    </li>
                    <li>
                      <strong className="text-primary">Select Active Model:</strong> Choose your discovered model from the <strong>Active Local Model</strong> dropdown. If your configured model is not yet pulled, Klartext automatically falls back to any installed Ollama model or its built-in bilingual engine.
                    </li>
                  </ol>
                </div>
              </div>

              {/* Section 3: Rewriting Swedish & English Text */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  3. Bilingual Rewriting &amp; Särskrivning (Svenska &amp; English)
                </h3>
                <div className="p-2.5 rounded-md bg-panel border border-subtle space-y-1.5 text-[11px] text-muted leading-relaxed">
                  <div>
                    <strong className="text-primary">Selection vs. Full Document:</strong> Select any sentence or paragraph in the editor to rewrite only that selection via the floating toolbar (<Sparkles className="w-3 h-3 inline text-accent" />), or use the buttons in the Local AI panel to rewrite the active document while preserving YAML frontmatter.
                  </div>
                  <div>
                    <strong className="text-primary">Clean Proposal Review:</strong> Proposed rewrites appear in the <strong>Review Proposed Rewrite</strong> card without strikethrough clutter. Click <strong>Compare Original</strong> if you want to inspect the original text side-by-side, then click <strong>Accept Edit (Enter)</strong> to apply or <strong>Reject (Esc)</strong> to discard.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3" data-testid="help-shortcuts-section">
              <div className="border border-subtle rounded-md overflow-hidden bg-panel">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-secondary/70 border-b border-subtle text-[10px] text-muted">
                      <th className="py-1.5 px-2.5">Command / Smart Action</th>
                      <th className="py-1.5 px-2.5 text-right">Shortcut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {SHORTCUTS_REFERENCE.map((s) => (
                      <tr key={s.action} className="hover:bg-secondary/30">
                        <td className="py-1.5 px-2.5 font-medium text-primary text-[11px]">
                          {s.action}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-[10px] text-accent whitespace-nowrap">
                          {s.keys}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-3" data-testid="help-about-section">
              <div className="p-3.5 rounded-lg bg-panel border border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-primary">{APP_METADATA.name}</div>
                    <div className="text-[11px] text-muted">
                      Technical Nordic Multi-Root Markdown Studio
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-accent font-mono font-semibold text-xs">
                    v{(evaluationContext.appVersion || APP_METADATA.version).replace(/^v/i, '')}
                  </span>
                </div>

                <p className="text-[11px] text-muted leading-relaxed">
                  {APP_METADATA.description}
                </p>

                <div className="border border-subtle rounded-md overflow-hidden bg-app divide-y divide-subtle text-[11px]">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted font-medium">Name</span>
                    <span className="font-semibold text-primary">{APP_METADATA.name}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted font-medium">Version</span>
                    <span className="font-mono text-primary">
                      {(evaluationContext.appVersion || APP_METADATA.version).replace(/^v/i, '')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted font-medium">License</span>
                    <span className="font-semibold text-primary">{APP_METADATA.license}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted font-medium">Author</span>
                    <span className="font-medium text-primary text-right">
                      {APP_METADATA.author}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export const AboutModal: React.FC<{
  appVersion?: string
  onClose: () => void
  onOpenSettings?: () => void
}> = ({ appVersion, onClose, onOpenSettings }) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const displayVersion = (appVersion || APP_METADATA.version).replace(/^v/i, '')

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true)
    try {
      const res = await window.klartext.checkForUpdates()
      setUpdateResult(res)
    } catch (err: any) {
      setUpdateResult({
        ok: false,
        currentVersion: displayVersion,
        latestVersion: displayVersion,
        updateAvailable: false,
        releaseUrl: APP_METADATA.releasesUrl,
        checkedAt: Date.now(),
        error: err?.message || 'Unable to check for updates'
      })
    } finally {
      setCheckingUpdate(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6"
      data-testid="about-klartext-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-panel border border-subtle rounded-xl shadow-2xl overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-subtle">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-primary">About {APP_METADATA.name}</span>
          </div>
          <button
            type="button"
            data-testid="about-modal-close-btn"
            onClick={onClose}
            className="p-1 rounded hover:bg-app text-muted hover:text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                className="text-lg font-bold text-primary tracking-tight"
                data-testid="about-app-name"
              >
                {APP_METADATA.name}
              </h2>
              <p className="text-[11px] text-muted">
                Technical Nordic Multi-Root Markdown Studio
              </p>
            </div>
            <span
              data-testid="about-app-version"
              className="px-2.5 py-1 rounded-md bg-accent/15 border border-accent/30 text-accent font-mono font-semibold text-xs shrink-0"
            >
              v{displayVersion}
            </span>
          </div>

          <p className="text-xs text-muted leading-relaxed">{APP_METADATA.description}</p>

          {/* Standard About Metadata Table */}
          <div className="rounded-lg border border-subtle bg-app divide-y divide-subtle/70">
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted font-medium">Name</span>
              <span className="font-semibold text-primary" data-testid="about-field-name">
                {APP_METADATA.name}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted font-medium">Version</span>
              <span className="font-mono font-semibold text-primary" data-testid="about-field-version">
                {displayVersion}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted font-medium">License</span>
              <span className="font-semibold text-primary" data-testid="about-field-license">
                {APP_METADATA.license}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted font-medium">Author</span>
              <span className="font-medium text-primary text-right" data-testid="about-field-author">
                {APP_METADATA.author}
              </span>
            </div>
          </div>

          {updateResult && (
            <div
              data-testid="about-update-status"
              className={`p-2.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                updateResult.updateAvailable
                  ? 'bg-accent/10 border-accent/40 text-primary'
                  : 'bg-app border-subtle text-muted'
              }`}
            >
              <div>
                {updateResult.updateAvailable ? (
                  <span>
                    New version available:{' '}
                    <strong className="text-accent font-mono">v{updateResult.latestVersion}</strong>
                  </span>
                ) : (
                  <span>
                    Klartext is up to date (<code className="font-mono">v{updateResult.currentVersion}</code>).
                  </span>
                )}
              </div>
              {updateResult.updateAvailable && (
                <button
                  type="button"
                  onClick={() => window.klartext.openExternalUrl(updateResult.releaseUrl)}
                  className="px-2 py-1 rounded bg-accent text-white font-medium text-[10px] inline-flex items-center gap-1 shrink-0"
                >
                  <span>Download</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="about-check-updates-btn"
                onClick={handleCheckUpdates}
                disabled={checkingUpdate}
                className="h-8 px-3 rounded-md bg-app border border-subtle hover:border-accent text-primary font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-accent ${checkingUpdate ? 'animate-spin' : ''}`} />
                <span>{checkingUpdate ? 'Checking...' : 'Check for Updates'}</span>
              </button>
              <button
                type="button"
                data-testid="about-github-link-btn"
                onClick={() => window.klartext.openExternalUrl(APP_METADATA.repositoryUrl)}
                className="h-8 px-2.5 rounded-md bg-app border border-subtle hover:border-accent text-muted hover:text-primary inline-flex items-center gap-1 transition-colors"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenSettings()
                  }}
                  className="h-8 px-2.5 rounded-md bg-app border border-subtle text-muted hover:text-primary"
                >
                  Settings
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3.5 rounded-md bg-accent text-white font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
