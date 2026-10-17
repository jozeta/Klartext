import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, Code2, Sparkles, Keyboard, Copy, Check, X, Search } from '../icons/untitled-icons'
import {
  TEMPLATE_VARIABLES_DOCS,
  evaluateTemplateVariables,
  type TemplateEvaluationContext
} from '../../../shared/templates/template-engine'

export type HelpModalTab = 'formatting' | 'variables' | 'shortcuts'

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
  { action: 'Toggle Zen / Focus Mode', keys: '⇧⌘F' },
  { action: 'Inline Local AI Draft Bar', keys: '⌘J' },
  { action: 'Next / Previous Cell in Markdown Table', keys: 'Tab / Shift+Tab' },
  { action: 'Continue or Exit List / Task / Blockquote', keys: 'Enter' }
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
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              data-testid="help-tab-formatting"
              onClick={() => setActiveTab('formatting')}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded font-medium text-[11px] truncate ${
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
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'variables'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate">Variables (&lt;% %&gt;)</span>
            </button>
            <button
              type="button"
              data-testid="help-tab-shortcuts"
              onClick={() => setActiveTab('shortcuts')}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded font-medium text-[11px] truncate ${
                activeTab === 'shortcuts'
                  ? 'bg-accent text-white'
                  : 'bg-panel text-muted hover:text-primary border border-subtle'
              }`}
            >
              <Keyboard className="w-3 h-3 shrink-0" />
              <span className="truncate">Shortcuts</span>
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
        </div>
      </div>
    </aside>
  )
}
