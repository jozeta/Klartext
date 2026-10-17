import React, { useMemo, useState } from 'react'
import {
  FileCode2,
  FileText,
  Trash2,
  Edit3,
  Play,
  FilePlus,
  Sparkles,
  HelpCircle,
  Check,
  X,
  Eye
} from '../../components/icons/untitled-icons'
import {
  DEFAULT_BUILT_IN_TEMPLATES,
  TEMPLATE_VARIABLES_DOCS,
  evaluateTemplateFileName,
  evaluateTemplateVariables,
  evaluateTemplateVariablesAsync,
  type NoteTemplateItem,
  type TemplateEvaluationContext
} from '../../../shared/templates/template-engine'

export const TemplatesPanel: React.FC<{
  customTemplates?: NoteTemplateItem[]
  templates?: NoteTemplateItem[]
  workspaceTemplateFiles: Array<{
    id: string
    name: string
    rootId: string
    rootName: string
    relativePath: string
    content: string
  }>
  evaluationContext: TemplateEvaluationContext
  onSaveCustomTemplates?: (nextTemplates: NoteTemplateItem[]) => void
  onSaveTemplates?: (nextTemplates: NoteTemplateItem[]) => void
  onOpenTemplateInEditor?: (template: NoteTemplateItem) => void
  onOpenWorkspaceTemplateInEditor?: (rootId: string, relativePath: string) => void
  onInsertRenderedTemplate: (renderedContent: string, cursorOffset: number | null) => void
  onCreateNoteFromTemplate: (templateName: string, rawTemplateContent: string) => void
  onEvaluateActiveDocument?: () => void
  onEvaluateActiveNoteVariables?: () => void
  onOpenHelpVariables: () => void
  onClose: () => void
}> = ({
  customTemplates,
  templates,
  workspaceTemplateFiles,
  evaluationContext,
  onSaveCustomTemplates,
  onSaveTemplates,
  onOpenTemplateInEditor,
  onOpenWorkspaceTemplateInEditor,
  onInsertRenderedTemplate,
  onCreateNoteFromTemplate,
  onEvaluateActiveDocument,
  onEvaluateActiveNoteVariables,
  onOpenHelpVariables,
  onClose
}) => {
  const effectiveTemplates = useMemo(() => {
    const list = customTemplates ?? templates
    const base = list && list.length > 0 ? list : DEFAULT_BUILT_IN_TEMPLATES
    return base.map((tpl) => ({
      ...tpl,
      name: tpl.name.endsWith('.md') ? tpl.name : `${tpl.name}.md`
    }))
  }, [customTemplates, templates])

  const saveTemplatesList = (nextList: NoteTemplateItem[]) => {
    onSaveCustomTemplates?.(nextList)
    onSaveTemplates?.(nextList)
  }

  const [editingTemplate, setEditingTemplate] = useState<NoteTemplateItem | null>(null)
  const [previewEvaluated, setPreviewEvaluated] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<
    | 'All'
    | 'Date & Time'
    | 'Folder & File'
    | 'Workspace & Git'
    | 'System & User'
    | 'Editor & Utility'
    | 'Power User & Automation'
  >('All')

  const handleApplyTemplate = async (
    rawContent: string,
    mode: 'insert' | 'new-note',
    name = 'Note'
  ) => {
    if (mode === 'insert') {
      const evaluated = await evaluateTemplateVariablesAsync(
        rawContent,
        {
          ...evaluationContext,
          now: new Date()
        },
        (expressions, cwd) =>
          window.klartext?.evaluatePowerTemplate
            ? window.klartext.evaluatePowerTemplate({ expressions, cwd })
            : Promise.resolve({})
      )
      onInsertRenderedTemplate(evaluated.content, evaluated.cursorOffset)
    } else {
      onCreateNoteFromTemplate(name.replace(/\.md$/i, ''), rawContent)
    }
  }

  const handleAddNewTemplateMdFile = () => {
    const existingNames = new Set(effectiveTemplates.map((t) => t.name.toLowerCase()))
    let candidateName = 'New-Template.md'
    let counter = 1
    while (existingNames.has(candidateName.toLowerCase())) {
      candidateName = `New-Template-${counter}.md`
      counter++
    }
    const newTpl: NoteTemplateItem = {
      id: `tpl-${Date.now()}`,
      name: candidateName,
      description: 'Markdown template with <% %> dynamic variables',
      updatedAt: Date.now(),
      content: `---
title: "<% title %>"
date: "<% date %>"
time: "<% time %>"
folder: "<% folder_name %>"
author: "<% user %>"
---

# <% title %>

Created on **<% weekday %>, <% date %>** at **<% time %>** in folder \`<% folder_name %>\`.

<% cursor %>
`
    }
    const nextList = [newTpl, ...effectiveTemplates]
    saveTemplatesList(nextList)
    onOpenTemplateInEditor?.(newTpl)
    setEditingTemplate(newTpl)
    setPreviewEvaluated(false)
  }

  const handleSaveEditingTemplate = () => {
    if (!editingTemplate) return
    const cleanName = editingTemplate.name.trim() || 'Untitled-Template.md'
    const normalized: NoteTemplateItem = {
      ...editingTemplate,
      name: cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`,
      updatedAt: Date.now()
    }
    const exists = effectiveTemplates.some((t) => t.id === normalized.id)
    const nextList = exists
      ? effectiveTemplates.map((t) => (t.id === normalized.id ? normalized : t))
      : [normalized, ...effectiveTemplates]
    saveTemplatesList(nextList)
    onOpenTemplateInEditor?.(normalized)
    setEditingTemplate(null)
  }

  const handleDeleteTemplate = (id: string) => {
    const nextList = effectiveTemplates.filter((t) => t.id !== id)
    saveTemplatesList(nextList)
    if (editingTemplate?.id === id) {
      setEditingTemplate(null)
    }
  }

  const filteredVarDocs = useMemo(() => {
    if (selectedCategory === 'All') return TEMPLATE_VARIABLES_DOCS
    return TEMPLATE_VARIABLES_DOCS.filter((v) => v.category === selectedCategory)
  }, [selectedCategory])

  const livePreviewOutput = useMemo(() => {
    if (!editingTemplate) return ''
    return evaluateTemplateVariables(editingTemplate.content, {
      ...evaluationContext,
      now: new Date()
    }).content
  }, [editingTemplate, evaluationContext])

  return (
    <aside
      data-testid="right-templates-window"
      className="h-full w-full bg-app border-l border-subtle flex flex-col overflow-hidden select-none text-xs"
    >
      {/* Header with "Add new template" icon */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel border-b border-subtle">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <FileCode2 className="w-3.5 h-3.5 text-accent" />
          <span>Templates</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Add new template"
            aria-label="Add new template"
            data-testid="add-new-template-btn"
            onClick={handleAddNewTemplateMdFile}
            className="p-1 rounded hover:bg-secondary text-accent hover:text-primary flex items-center gap-1"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Dynamic Variables & Formatting Help"
            aria-label="Dynamic Variables & Formatting Help"
            data-testid="templates-open-help-btn"
            onClick={onOpenHelpVariables}
            className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Close Templates Panel"
            aria-label="Close Templates Panel"
            data-testid="close-templates-window-btn"
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Action Bar: Evaluate <% %> in Active Document */}
      <div className="px-3 py-2 bg-secondary/50 border-b border-subtle flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted leading-tight">
          All files below are templates. <code className="font-mono text-accent">&lt;% ... %&gt;</code> variables work in both template names and content.
        </div>
        <button
          type="button"
          title="Replace all <% %> dynamic variables in the currently open document"
          data-testid="evaluate-active-note-vars-btn"
          onClick={() => {
            onEvaluateActiveDocument?.()
            onEvaluateActiveNoteVariables?.()
          }}
          className="px-2 py-1 rounded bg-panel border border-subtle hover:border-accent text-primary font-medium shrink-0 flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-accent" />
          <span>Run &lt;% %&gt;</span>
        </button>
      </div>

      {/* Template Editor View vs Template Files List View */}
      {editingTemplate ? (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-primary">Edit Template (.md)</span>
            <button
              type="button"
              onClick={() => setPreviewEvaluated((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${
                previewEvaluated
                  ? 'bg-accent text-white border-accent'
                  : 'bg-panel border-subtle text-muted hover:text-primary'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{previewEvaluated ? 'Editing Source' : 'Preview Output'}</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-semibold uppercase text-muted">
                Template File Name (supports &lt;% ... %&gt;)
              </label>
              <div className="flex items-center gap-1">
                {(['<% date %>', '<% folder_name %>'] as const).map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    title={`Insert ${tok} into template name`}
                    onClick={() =>
                      setEditingTemplate((prev) => {
                        if (!prev) return null
                        const stem = prev.name.replace(/\.md$/i, '')
                        return { ...prev, name: `${stem}-${tok}.md` }
                      })
                    }
                    className="px-1 py-0.5 rounded bg-secondary hover:bg-accent hover:text-white font-mono text-[9px] text-muted"
                  >
                    +{tok}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              data-testid="template-name-input"
              placeholder="e.g. Daily-<% date %>.md"
              value={editingTemplate.name}
              onChange={(e) =>
                setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null))
              }
              className="w-full px-2 py-1 rounded bg-panel border border-subtle text-primary font-mono text-[11px]"
            />
            {editingTemplate.name.includes('<%') && (
              <div
                data-testid="template-evaluated-name-preview"
                className="text-[10px] font-mono text-accent truncate"
              >
                Evaluates to:{' '}
                {evaluateTemplateFileName(editingTemplate.name, {
                  ...evaluationContext,
                  now: new Date()
                })}
              </div>
            )}
          </div>

          <div className="space-y-1 flex-1 flex flex-col min-h-[180px]">
            <label className="block text-[10px] font-semibold uppercase text-muted">
              {previewEvaluated
                ? 'Live Evaluated Output Preview'
                : 'Template Markdown Content (<% ... %>)'}
            </label>
            {previewEvaluated ? (
              <pre
                data-testid="template-live-preview"
                className="flex-1 p-2.5 rounded bg-panel border border-subtle font-mono text-[11px] text-primary whitespace-pre-wrap overflow-y-auto select-text"
              >
                {livePreviewOutput}
              </pre>
            ) : (
              <textarea
                data-testid="template-content-textarea"
                value={editingTemplate.content}
                onChange={(e) =>
                  setEditingTemplate((prev) =>
                    prev ? { ...prev, content: e.target.value } : null
                  )
                }
                rows={10}
                className="flex-1 w-full p-2 rounded bg-panel border border-subtle font-mono text-[11px] text-primary focus:outline-none focus:border-accent resize-y"
              />
            )}
          </div>

          {/* Click-to-Insert Dynamic Variable Chips */}
          <div className="space-y-1.5 pt-1 border-t border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted">
                Insert Dynamic Variable
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] text-primary"
              >
                <option value="All">All Categories</option>
                <option value="Date & Time">Date &amp; Time</option>
                <option value="Folder & File">Folder &amp; File</option>
                <option value="Workspace & Git">Workspace &amp; Git</option>
                <option value="System & User">System &amp; User</option>
                <option value="Editor & Utility">Editor &amp; Utility</option>
                <option value="Power User & Automation">Power User &amp; Automation</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1 rounded bg-panel border border-subtle">
              {filteredVarDocs.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  title={`${v.description} (e.g. ${v.exampleOutput})`}
                  onClick={() => {
                    setEditingTemplate((prev) =>
                      prev ? { ...prev, content: `${prev.content}${v.token}` } : null
                    )
                  }}
                  className="px-1.5 py-0.5 rounded bg-secondary hover:bg-accent hover:text-white font-mono text-[10px] text-primary transition-colors"
                >
                  {v.token}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingTemplate(null)}
              className="px-2.5 py-1 rounded bg-secondary border border-subtle text-primary"
            >
              Done
            </button>
            <button
              type="button"
              data-testid="save-template-btn"
              onClick={handleSaveEditingTemplate}
              className="flex items-center gap-1 px-3 py-1 rounded bg-accent text-white font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Template</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Workspace Folder Templates (if user has a Templates/ folder in any root) */}
          {workspaceTemplateFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Workspace Template Files ({workspaceTemplateFiles.length})
              </div>
              {workspaceTemplateFiles.map((wf) => (
                <div
                  key={wf.id}
                  data-testid={`workspace-template-card-${wf.name}`}
                  className="p-2.5 rounded-md bg-panel border border-subtle space-y-2 hover:border-accent/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onOpenWorkspaceTemplateInEditor?.(wf.rootId, wf.relativePath)}
                      className="flex items-center gap-1.5 font-semibold text-primary truncate hover:text-accent text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="truncate">
                        {wf.name.endsWith('.md') ? wf.name : `${wf.name}.md`}
                      </span>
                    </button>
                    <span className="text-[10px] text-muted font-mono truncate max-w-[100px]">
                      {wf.rootName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(wf.content, 'new-note', wf.name)}
                      className="flex-1 py-1 px-2 rounded bg-accent text-white font-medium flex items-center justify-center gap-1"
                    >
                      <FilePlus className="w-3 h-3" />
                      <span>Create File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(wf.content, 'insert', wf.name)}
                      className="py-1 px-2 rounded bg-secondary border border-subtle text-primary hover:border-accent flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      <span>Insert</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Template Files in Templates Panel */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Template Files ({effectiveTemplates.length})
              </span>
              <button
                type="button"
                data-testid="create-new-template-btn"
                onClick={handleAddNewTemplateMdFile}
                className="text-[10px] text-accent hover:underline font-medium flex items-center gap-0.5"
              >
                <FilePlus className="w-3 h-3" />
                <span>Add new template</span>
              </button>
            </div>
            {effectiveTemplates.map((tpl) => (
              <div
                key={tpl.id}
                data-testid={`template-card-${tpl.id}`}
                className="p-2.5 rounded-md bg-panel border border-subtle space-y-2 hover:border-accent/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      title="Open template .md file in editor"
                      onClick={() => onOpenTemplateInEditor?.(tpl)}
                      className="flex items-center gap-1.5 font-semibold text-primary hover:text-accent truncate text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="truncate">{tpl.name}</span>
                    </button>
                    {tpl.name.includes('<%') && (
                      <div className="text-[10px] font-mono text-accent truncate mt-0.5">
                        →{' '}
                        {evaluateTemplateFileName(tpl.name, {
                          ...evaluationContext,
                          now: new Date()
                        })}
                      </div>
                    )}
                    {tpl.description && (
                      <div className="text-[11px] text-muted leading-snug mt-0.5">
                        {tpl.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      title="Edit Template Properties & Variables"
                      data-testid={`edit-template-btn-${tpl.id}`}
                      onClick={() => {
                        setEditingTemplate(tpl)
                        setPreviewEvaluated(false)
                      }}
                      className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete Template"
                      data-testid={`delete-template-btn-${tpl.id}`}
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="p-1 rounded hover:bg-secondary text-muted hover:text-danger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    data-testid={`new-note-from-template-btn-${tpl.id}`}
                    onClick={() => handleApplyTemplate(tpl.content, 'new-note', tpl.name)}
                    className="flex-1 py-1 px-2 rounded bg-accent text-white font-medium flex items-center justify-center gap-1"
                  >
                    <FilePlus className="w-3 h-3" />
                    <span>New Note</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`insert-template-btn-${tpl.id}`}
                    onClick={() => handleApplyTemplate(tpl.content, 'insert', tpl.name)}
                    className="py-1 px-2 rounded bg-secondary border border-subtle text-primary hover:border-accent flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Insert in Note</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Reference Card for <% %> Variables */}
          <div className="p-2.5 rounded-md bg-secondary/50 border border-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted">
                Popular Dynamic Variables
              </span>
              <button
                type="button"
                onClick={onOpenHelpVariables}
                className="text-[10px] text-accent hover:underline font-medium"
              >
                Full Guide →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <span className="text-accent">&lt;% date %&gt;</span>
              <span className="text-muted truncate">YYYY-MM-DD</span>
              <span className="text-accent">&lt;% time %&gt;</span>
              <span className="text-muted truncate">HH:mm</span>
              <span className="text-accent">&lt;% folder_name %&gt;</span>
              <span className="text-muted truncate">Active folder</span>
              <span className="text-accent">&lt;% title %&gt;</span>
              <span className="text-muted truncate">Note title</span>
              <span className="text-accent">&lt;% user %&gt;</span>
              <span className="text-muted truncate">System user</span>
              <span className="text-accent">&lt;% git_branch %&gt;</span>
              <span className="text-muted truncate">Git branch</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
