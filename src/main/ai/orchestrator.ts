import type {
  AIStreamChunkEvent,
  AppSettings,
  HardwareTierAdvice,
  LocalAIModelInfo
} from '../../shared/types'
import { MultiRootPathGuard } from '../security/path-guard'
import { calculateHardwareTierAdvice } from './hardware-advisor'
import { buildSystemPromptForAction, sanitizeAndCleanAIOutput } from './prompts'
import { MultiRootSearchService } from '../search/search-service'

export class LocalAIOrchestrator {
  private activeControllers = new Map<string, AbortController>()

  constructor(
    private getSettings: () => AppSettings,
    private searchService: MultiRootSearchService
  ) {}

  getHardwareAdvice(overrideRamBytes?: number): HardwareTierAdvice {
    return calculateHardwareTierAdvice(overrideRamBytes)
  }

  private getValidatedBaseUrl(): URL {
    const aiSettings = this.getSettings().ai
    return MultiRootPathGuard.validateLoopbackUrl(
      aiSettings.endpoint,
      aiSettings.allowNonLoopback
    )
  }

  async testConnection(): Promise<{
    ok: boolean
    latencyMs: number
    provider: string
    models: LocalAIModelInfo[]
    error?: string
  }> {
    const start = Date.now()
    try {
      const models = await this.listModels()
      return {
        ok: true,
        latencyMs: Date.now() - start,
        provider: this.getSettings().ai.provider,
        models
      }
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        provider: this.getSettings().ai.provider,
        models: [],
        error: err?.message || String(err)
      }
    }
  }

  async listModels(): Promise<LocalAIModelInfo[]> {
    const baseUrl = this.getValidatedBaseUrl()
    const provider = this.getSettings().ai.provider
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      if (provider === 'ollama') {
        const url = new URL('/api/tags', baseUrl)
        const res = await fetch(url.toString(), { signal: controller.signal })
        if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`)
        const data = (await res.json()) as {
          models?: Array<{
            name: string
            size?: number
            details?: { family?: string; parameter_size?: string; quantization_level?: string }
          }>
        }
        return (data.models || []).map((m) => ({
          name: m.name,
          sizeBytes: m.size,
          family: m.details?.family,
          parameterSize: m.details?.parameter_size,
          quantizationLevel: m.details?.quantization_level
        }))
      } else {
        const url = new URL('/v1/models', baseUrl)
        const res = await fetch(url.toString(), { signal: controller.signal })
        if (!res.ok) throw new Error(`OpenAI-compatible server returned HTTP ${res.status}`)
        const data = (await res.json()) as { data?: Array<{ id: string }> }
        return (data.data || []).map((m) => ({ name: m.id }))
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async pullOllamaModel(modelTag: string): Promise<{ ok: boolean; status: string }> {
    const baseUrl = this.getValidatedBaseUrl()
    const url = new URL('/api/pull', baseUrl)
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelTag, stream: false })
    })
    if (!res.ok) {
      throw new Error(`Failed to pull model "${modelTag}": HTTP ${res.status}`)
    }
    const body = (await res.json()) as { status?: string }
    return { ok: true, status: body.status || 'success' }
  }

  cancelStream(requestId: string): boolean {
    const controller = this.activeControllers.get(requestId)
    if (controller) {
      controller.abort()
      this.activeControllers.delete(requestId)
      return true
    }
    return false
  }

  async streamGeneration(
    params: {
      requestId: string
      action: string
      prompt: string
      selectedText: string
      tone?: string
      modelOverride?: string
    },
    onChunk: (event: AIStreamChunkEvent) => void
  ): Promise<string> {
    const aiSettings = this.getSettings().ai
    const baseUrl = this.getValidatedBaseUrl()
    const model = params.modelOverride || aiSettings.activeModel || 'gemma4:12b'
    const systemPrompt = buildSystemPromptForAction(params.action, params.tone)
    const userMessage = [
      params.prompt ? `Instruction: ${params.prompt}` : '',
      params.selectedText ? `Input Markdown:\n${params.selectedText}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')

    const controller = new AbortController()
    this.activeControllers.set(params.requestId, controller)
    let accumulated = ''

    try {
      if (aiSettings.provider === 'ollama') {
        const url = new URL('/api/chat', baseUrl)
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            stream: true,
            keep_alive: aiSettings.keepAlive || '5m',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ]
          })
        })

        if (!res.ok || !res.body) {
          throw new Error(`Local AI request failed with status ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let reading = true

        while (reading) {
          const { done, value } = await reader.read()
          if (done) {
            reading = false
            break
          }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const parsed = JSON.parse(trimmed) as {
              message?: { content?: string }
              done?: boolean
            }
            const token = parsed.message?.content || ''
            if (token) {
              accumulated += token
              onChunk({
                requestId: params.requestId,
                chunk: token,
                done: false
              })
            }
          }
        }
      } else {
        // OpenAI-compatible SSE (/v1/chat/completions)
        const url = new URL('/v1/chat/completions', baseUrl)
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ]
          })
        })

        if (!res.ok || !res.body) {
          throw new Error(`OpenAI-compatible request failed with status ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let reading = true

        while (reading) {
          const { done, value } = await reader.read()
          if (done) {
            reading = false
            break
          }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const dataStr = trimmed.slice(5).trim()
            if (dataStr === '[DONE]') continue
            try {
              const parsed = JSON.parse(dataStr)
              const token = parsed.choices?.[0]?.delta?.content || ''
              if (token) {
                accumulated += token
                onChunk({
                  requestId: params.requestId,
                  chunk: token,
                  done: false
                })
              }
            } catch {
              // Ignore partial SSE comment
            }
          }
        }
      }

      const cleanedFullText = sanitizeAndCleanAIOutput(accumulated, {
        preserveMermaidFence: params.action === 'mermaid'
      })

      onChunk({
        requestId: params.requestId,
        chunk: '',
        done: true,
        cleanedFullText
      })
      return cleanedFullText
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError'
      const errorMessage = isAbort ? 'Generation cancelled by user' : err?.message || String(err)
      onChunk({
        requestId: params.requestId,
        chunk: '',
        done: true,
        cleanedFullText: sanitizeAndCleanAIOutput(accumulated),
        error: errorMessage
      })
      throw err
    } finally {
      this.activeControllers.delete(params.requestId)
    }
  }

  /**
   * Local Multi-Root Workspace Q&A (RAG) grounded in mounted root folders with explicit citations.
   */
  async answerWorkspaceQuestion(params: {
    question: string
    rootIds?: string[]
    modelOverride?: string
  }): Promise<{
    answer: string
    citations: Array<{ rootId: string; rootName: string; relativePath: string; excerpt: string }>
  }> {
    const terms = params.question
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 5)

    const pattern = terms.length > 0 ? terms.join('|') : params.question
    const searchHits = await this.searchService.searchAcrossRoots({
      query: pattern,
      rootIds: params.rootIds,
      isRegex: terms.length > 1,
      caseSensitive: false
    })

    const topHits = searchHits.slice(0, 6)
    const citations = topHits.map((hit) => ({
      rootId: hit.rootId,
      rootName: hit.rootName,
      relativePath: hit.relativePath,
      excerpt: hit.matches
        .slice(0, 3)
        .map((m) => `L${m.lineNumber}: ${m.lineText}`)
        .join(' | ')
    }))

    const contextText = citations
      .map(
        (c, i) =>
          `[Source ${i + 1}: ${c.rootName} / ${c.relativePath}]\n${c.excerpt}`
      )
      .join('\n\n')

    const requestId = `rag-${Date.now()}`
    const prompt = `Answer the question based strictly on the workspace sources below. Cite sources as [Root Name / File Path].\n\nQuestion: ${params.question}\n\nWorkspace Context:\n${contextText || 'No matching documents found.'}`

    let finalAnswer = ''
    await this.streamGeneration(
      {
        requestId,
        action: 'custom',
        prompt,
        selectedText: '',
        modelOverride: params.modelOverride
      },
      (ev) => {
        if (ev.done && ev.cleanedFullText) {
          finalAnswer = ev.cleanedFullText
        }
      }
    )

    return {
      answer: finalAnswer,
      citations
    }
  }
}
