import React, { useEffect, useState } from 'react'
import {
  Sparkles,
  Server,
  Cpu,
  Check,
  X,
  Square,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  HelpCircle
} from '../../components/icons/untitled-icons'
import type {
  AppSettings,
  HardwareTierAdvice,
  LocalAIModelInfo,
  WorkspaceRoot
} from '../../../shared/types'

export const LocalAIPanel: React.FC<{
  settings: AppSettings
  roots: WorkspaceRoot[]
  activeRootName: string
  activeFilePath: string
  selectedTextOrDoc: string
  pendingDiff: {
    originalText: string
    proposedText: string
    isStreaming: boolean
    requestId: string
    error?: string
  } | null
  onUpdateSettings: (partial: Partial<AppSettings>) => void
  onStartAIAction: (action: string, prompt: string, modelOverride?: string) => void
  onCancelStream: (requestId: string) => void
  onAcceptDiff: (proposedText: string) => void
  onRejectDiff: () => void
  onOpenHelpAI?: () => void
  onOpenCitation?: (rootId: string, relativePath: string) => void
}> = ({
  settings,
  roots,
  activeRootName,
  activeFilePath,
  selectedTextOrDoc,
  pendingDiff,
  onUpdateSettings,
  onStartAIAction,
  onCancelStream,
  onAcceptDiff,
  onRejectDiff,
  onOpenHelpAI,
  onOpenCitation
}) => {
  const [hardwareAdvice, setHardwareAdvice] = useState<HardwareTierAdvice | null>(null)
  const [connectionState, setConnectionState] = useState<{
    tested: boolean
    ok: boolean
    latencyMs?: number
    error?: string
  }>({ tested: false, ok: false })
  const [discoveredModels, setDiscoveredModels] = useState<LocalAIModelInfo[]>([])
  const [customPrompt, setCustomPrompt] = useState('')
  const [endpointInput, setEndpointInput] = useState(settings.ai.endpoint)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [ragQuestion, setRagQuestion] = useState('')
  const [ragLoading, setRagLoading] = useState(false)
  const [ragError, setRagError] = useState<string | null>(null)
  const [ragAnswer, setRagAnswer] = useState<{
    answer: string
    citations: Array<{ rootId: string; rootName: string; relativePath: string; excerpt: string }>
  } | null>(null)

  // Collapsible sections — both collapsed by default
  const [isSetupExpanded, setIsSetupExpanded] = useState(false)
  const [isHardwareAdvisorExpanded, setIsHardwareAdvisorExpanded] = useState(false)
  const [showOriginalInDiff, setShowOriginalInDiff] = useState(false)

  useEffect(() => {
    setEndpointInput(settings.ai.endpoint)
  }, [settings.ai.endpoint])

  useEffect(() => {
    setShowOriginalInDiff(false)
  }, [pendingDiff?.requestId])

  useEffect(() => {
    window.klartext.getHardwareAdvice().then(setHardwareAdvice).catch(() => {})
  }, [])

  const handleTestConnection = async () => {
    if (endpointInput !== settings.ai.endpoint) {
      await onUpdateSettings({
        ai: {
          ...settings.ai,
          endpoint: endpointInput
        }
      })
    }
    const res = await window.klartext.testAIConnection()
    setConnectionState({
      tested: true,
      ok: res.ok,
      latencyMs: res.latencyMs,
      error: res.error
    })
    if (res.models.length > 0) {
      setDiscoveredModels(res.models)
    }
  }

  const handleRunRAG = async () => {
    const trimmed = ragQuestion.trim()
    if (!trimmed || ragLoading) return
    setRagLoading(true)
    setRagError(null)
    try {
      const res = await window.klartext.queryWorkspaceRAG({
        question: trimmed,
        rootIds: roots.map((r) => r.id),
        modelOverride: settings.ai.activeModel
      })
      setRagAnswer(res)
    } catch (err: any) {
      setRagError(err?.message || 'Failed to query workspace documents.')
    } finally {
      setRagLoading(false)
    }
  }

  const approxTokens = Math.max(1, Math.ceil(selectedTextOrDoc.length / 4))

  return (
    <aside
      data-testid="right-ai-panel"
      className="h-full flex flex-col bg-app border-l border-subtle text-xs overflow-y-auto p-3 space-y-3 select-none"
    >
      {/* Header & Active Model Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-subtle">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <Sparkles className="w-4 h-4 text-accent" />
          <span>Local AI Assistant (SV / EN)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            data-testid="ai-connection-badge"
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              connectionState.ok
                ? 'bg-success/15 text-success'
                : 'bg-secondary text-muted'
            }`}
          >
            {connectionState.ok ? `Connected · ${connectionState.latencyMs}ms` : 'Localhost Mode'}
          </span>
          {onOpenHelpAI && (
            <button
              type="button"
              data-testid="open-ai-help-btn"
              data-tooltip="Local AI & Workspace Q&A Guide"
              onClick={onOpenHelpAI}
              className="p-1 rounded hover:bg-secondary text-muted hover:text-accent transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transparent Privacy & Context Indicator */}
      <div
        data-testid="ai-context-indicator"
        className="p-2 rounded bg-panel border border-subtle text-[11px] text-muted space-y-0.5"
      >
        <div className="font-semibold text-primary">Local Privacy Context Boundary</div>
        <div>
          Active Root: <strong className="text-primary">{activeRootName}</strong> · File:{' '}
          <strong className="text-primary">{activeFilePath}</strong>
        </div>
        <div>
          Context Size: {selectedTextOrDoc.length} chars (~{approxTokens} tokens) · 100% Loopback
        </div>
      </div>

      {/* Inline Proposal Review Box when AI proposes an edit (clean rewrite without strikethrough) */}
      {pendingDiff && (
        <div
          data-testid="ai-diff-review-card"
          className="p-3 rounded-md bg-panel border-2 border-accent space-y-2 shadow-sm select-text"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-accent">
              {pendingDiff.isStreaming ? 'Streaming Local AI Proposal...' : 'Review Proposed Rewrite'}
            </span>
            <div className="flex items-center gap-1.5">
              {!pendingDiff.isStreaming && pendingDiff.originalText && (
                <button
                  type="button"
                  data-testid="ai-diff-toggle-original-btn"
                  onClick={() => setShowOriginalInDiff((v) => !v)}
                  className="px-2 py-0.5 rounded bg-secondary border border-subtle text-[10px] text-muted hover:text-primary"
                >
                  {showOriginalInDiff ? 'Hide Original' : 'Compare Original'}
                </button>
              )}
              {pendingDiff.isStreaming && (
                <button
                  type="button"
                  data-testid="ai-stop-streaming-btn"
                  onClick={() => onCancelStream(pendingDiff.requestId)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-danger text-white text-[11px]"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>

          {pendingDiff.error && !pendingDiff.proposedText && (
            <div className="text-danger text-[11px] font-mono">{pendingDiff.error}</div>
          )}

          <div className="grid grid-cols-1 gap-1.5 text-[11px] font-mono max-h-60 overflow-y-auto">
            {showOriginalInDiff && (
              <div
                data-testid="ai-diff-original-text"
                className="p-2 rounded bg-secondary/60 border border-subtle text-muted whitespace-pre-wrap"
              >
                <div className="text-[9px] uppercase tracking-wider font-semibold text-muted mb-1">
                  Original Text
                </div>
                {pendingDiff.originalText.slice(0, 600)}
              </div>
            )}
            <div
              data-testid="ai-diff-proposed-text"
              className="p-2.5 rounded bg-success/10 border border-subtle text-primary whitespace-pre-wrap leading-relaxed"
            >
              {pendingDiff.proposedText ||
                (pendingDiff.isStreaming ? 'Generating rewrite…' : '')}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              data-testid="ai-diff-reject-btn"
              onClick={onRejectDiff}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-secondary border border-subtle text-primary hover:border-danger"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject (Esc)</span>
            </button>
            <button
              type="button"
              data-testid="ai-diff-accept-btn"
              disabled={pendingDiff.isStreaming || !pendingDiff.proposedText.trim()}
              onClick={() => onAcceptDiff(pendingDiff.proposedText)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-white font-medium disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Edit (Enter)</span>
            </button>
          </div>
        </div>
      )}

      {/* Bilingual Quick Actions & Custom Prompt */}
      <div className="p-2.5 rounded bg-panel border border-subtle space-y-2">
        <div className="font-semibold text-primary">Create, Edit &amp; Rewrite (English &amp; Svenska)</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="ai-action-improve"
            onClick={() => onStartAIAction('improve', 'Improve clarity and flow')}
            className="px-2 py-1 rounded bg-secondary hover:border-accent border border-subtle text-left truncate"
          >
            Improve / Förbättra text
          </button>
          <button
            type="button"
            data-testid="ai-action-grammar"
            onClick={() =>
              onStartAIAction('grammar', 'Fix grammar and Swedish compound words (särskrivningar)')
            }
            className="px-2 py-1 rounded bg-secondary hover:border-accent border border-subtle text-left truncate"
          >
            Fix Grammar / Särskrivning
          </button>
          <button
            type="button"
            data-testid="ai-action-translate-en-sv"
            onClick={() => onStartAIAction('translate-en-sv', 'Translate to idiomatic Swedish')}
            className="px-2 py-1 rounded bg-secondary hover:border-accent border border-subtle text-left truncate"
          >
            Translate EN → SV
          </button>
          <button
            type="button"
            data-testid="ai-action-translate-sv-en"
            onClick={() => onStartAIAction('translate-sv-en', 'Translate to idiomatic English')}
            className="px-2 py-1 rounded bg-secondary hover:border-accent border border-subtle text-left truncate"
          >
            Translate SV → EN
          </button>
        </div>

        <div className="flex gap-1 pt-1">
          <input
            type="text"
            data-testid="ai-custom-prompt-input"
            placeholder="Custom instruction (English or Svenska)..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customPrompt.trim()) {
                onStartAIAction('custom', customPrompt.trim())
              }
            }}
            className="flex-1 px-2 py-1 rounded bg-app border border-subtle text-primary"
          />
          <button
            type="button"
            data-testid="ai-custom-prompt-run-btn"
            onClick={() => {
              if (customPrompt.trim()) {
                onStartAIAction('custom', customPrompt.trim())
              }
            }}
            className="px-2.5 py-1 rounded bg-accent text-white font-medium"
          >
            Run
          </button>
        </div>
      </div>

      {/* Collapsible Local AI Setup & Connection (Collapsed by default, contains Multi-Root Workspace Q&A) */}
      <div
        data-testid="local-ai-connection-guide"
        className="rounded bg-panel border border-subtle overflow-hidden"
      >
        <button
          type="button"
          data-testid="toggle-local-ai-setup-btn"
          aria-expanded={isSetupExpanded}
          onClick={() => setIsSetupExpanded((v) => !v)}
          className="w-full p-2.5 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Server className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>Local AI Setup &amp; Connection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted">{settings.ai.activeModel}</span>
            {isSetupExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted" />
            )}
          </div>
        </button>

        {isSetupExpanded && (
          <div
            data-testid="local-ai-connection-body"
            className="px-2.5 pb-2.5 pt-1 border-t border-subtle space-y-3"
          >
            <div className="space-y-1">
              <label className="text-[11px] text-muted">
                Local Endpoint (Ollama / LM Studio):
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  data-testid="ai-endpoint-input"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-app border border-subtle text-primary font-mono text-[11px]"
                />
                <button
                  type="button"
                  data-testid="ai-test-connection-btn"
                  onClick={handleTestConnection}
                  className="px-2 py-1 rounded bg-accent text-white font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Test</span>
                </button>
              </div>
              {connectionState.tested && !connectionState.ok && (
                <div className="text-[10px] text-muted pt-0.5">
                  No external server detected on {endpointInput} — using built-in local SV/EN engine.
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted">Active Local Model:</label>
              <select
                data-testid="ai-model-select"
                value={settings.ai.activeModel}
                onChange={(e) =>
                  onUpdateSettings({
                    ai: { ...settings.ai, activeModel: e.target.value }
                  })
                }
                className="w-full px-2 py-1 rounded bg-app border border-subtle text-primary"
              >
                {discoveredModels.length > 0 ? (
                  discoveredModels.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} {m.parameterSize ? `(${m.parameterSize})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="gemma4:12b">gemma4:12b (Recommended SV/EN)</option>
                    <option value="qwen3:8b">qwen3:8b (Fast Bilingual)</option>
                    <option value="gemma3:4b">gemma3:4b (8GB Entry)</option>
                    <option value="mistral-small:24b">mistral-small:24b (Pro 24GB+)</option>
                  </>
                )}
              </select>
            </div>

            {/* Multi-Root Workspace Q&A (Local RAG) — Inside Local AI Setup & Connection */}
            <div
              data-testid="ai-rag-section"
              className="pt-2 border-t border-subtle space-y-2 select-text"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">
                  Multi-Root Workspace Q&amp;A (Local RAG)
                </span>
                {onOpenHelpAI && (
                  <button
                    type="button"
                    data-testid="ai-rag-help-link"
                    onClick={onOpenHelpAI}
                    className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Setup &amp; Guide</span>
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  data-testid="ai-rag-question-input"
                  placeholder="Ask across mounted roots (SV / EN)..."
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && ragQuestion.trim()) {
                      e.preventDefault()
                      handleRunRAG()
                    }
                  }}
                  className="flex-1 px-2 py-1 rounded bg-app border border-subtle text-primary"
                />
                <button
                  type="button"
                  data-testid="ai-rag-ask-btn"
                  disabled={ragLoading || !ragQuestion.trim()}
                  onClick={handleRunRAG}
                  className="px-2.5 py-1 rounded bg-accent text-white font-medium disabled:opacity-50"
                >
                  {ragLoading ? '...' : 'Ask'}
                </button>
              </div>
              {ragError && (
                <div className="p-2 rounded bg-danger/10 border border-danger/30 text-danger text-[11px]">
                  {ragError}
                </div>
              )}
              {ragAnswer && (
                <div
                  data-testid="ai-rag-answer-card"
                  className="p-2 rounded bg-app border border-subtle space-y-1.5 text-[11px]"
                >
                  <div
                    data-testid="ai-rag-answer-text"
                    className="text-primary whitespace-pre-wrap leading-relaxed"
                  >
                    {ragAnswer.answer}
                  </div>
                  {ragAnswer.citations.length > 0 && (
                    <div
                      data-testid="ai-rag-citations"
                      className="text-[10px] text-muted pt-1.5 border-t border-subtle space-y-1"
                    >
                      <div className="font-semibold uppercase tracking-wider text-[9px]">
                        Sources ({ragAnswer.citations.length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ragAnswer.citations.map((c, idx) => (
                          <button
                            key={`${c.rootId}-${c.relativePath}-${idx}`}
                            type="button"
                            onClick={() => onOpenCitation?.(c.rootId, c.relativePath)}
                            className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-accent hover:underline font-mono text-[10px]"
                          >
                            [{c.rootName} / {c.relativePath}]
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Hardware & Model Advisor (Collapsed by default) */}
      {hardwareAdvice && (
        <div
          data-testid="hardware-advisor-card"
          className="rounded bg-panel border border-subtle overflow-hidden"
        >
          <button
            type="button"
            data-testid="toggle-hardware-advisor-btn"
            aria-expanded={isHardwareAdvisorExpanded}
            onClick={() => setIsHardwareAdvisorExpanded((v) => !v)}
            className="w-full p-2.5 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Cpu className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>Hardware &amp; Model Advisor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                data-testid="detected-ram-badge"
                className="px-1.5 py-0.5 rounded bg-secondary text-accent font-mono text-[10px]"
              >
                {hardwareAdvice.detectedRamGb} GB RAM · Tier {hardwareAdvice.tierId}
              </span>
              {isHardwareAdvisorExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              )}
            </div>
          </button>

          {isHardwareAdvisorExpanded && (
            <div
              data-testid="hardware-advisor-body"
              className="px-2.5 pb-2.5 pt-1 border-t border-subtle space-y-2"
            >
              <div className="text-[11px] font-medium text-primary">{hardwareAdvice.tierName}</div>
              <p className="text-[11px] text-muted leading-relaxed">{hardwareAdvice.summary}</p>

              <div className="space-y-1.5 pt-1">
                {hardwareAdvice.recommendedModels.map((rec) => {
                  const pullCmd = `ollama pull ${rec.tag}`
                  return (
                    <div
                      key={rec.tag}
                      data-testid={`hw-rec-model-${rec.tag}`}
                      className="p-2 rounded bg-app border border-subtle space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">
                          {rec.label}{' '}
                          <span className="text-[10px] font-mono text-muted">
                            ({rec.downloadSize})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(pullCmd)
                            setCopiedCmd(rec.tag)
                            setTimeout(() => setCopiedCmd(null), 1500)
                          }}
                          className="px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] flex items-center gap-1 hover:border-accent"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>{copiedCmd === rec.tag ? 'Copied' : pullCmd}</span>
                        </button>
                      </div>
                      <div className="text-[10px] text-muted">{rec.suitabilitySvEn}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
