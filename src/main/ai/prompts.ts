export function buildSystemPromptForAction(action: string, tone?: string): string {
  const baseRules = [
    'You are Klartext Local AI, a precise technical and bilingual (English and Swedish) writing and Markdown assistant.',
    'CRITICAL RULES:',
    '1. Respond in the EXACT same language as the input text or prompt (unless translation is explicitly requested).',
    '2. When writing in Swedish, observe strict Swedish grammar and compound-word rules (undvik särskrivning, e.g., write "användargränssnitt", "versionshantering", "säkerhetsgranskning" as single compound words, and avoid Danish/Norwegian vocabulary).',
    '3. Output RAW, valid Markdown ONLY. Never include conversational filler, greetings, or preambles such as "Sure! Here is the revised text:" or "Här är förslaget:".',
    '4. Preserve existing Markdown links, [[WikiLinks]], code spans, and mathematical expressions intact.'
  ].join('\n')

  switch (action) {
    case 'improve':
      return `${baseRules}\nTask: Improve clarity, flow, and precision of the provided Markdown text while keeping its original language (English or Swedish) and Markdown structure.`
    case 'grammar':
      return `${baseRules}\nTask: Fix all spelling, grammar, punctuation, and Swedish compound word errors (särskrivningar) in the provided text without changing its meaning.`
    case 'tone':
      return `${baseRules}\nTask: Rewrite the provided text in a ${tone || 'technical'} tone while preserving its language and Markdown formatting.`
    case 'translate-sv-en':
      return `${baseRules}\nTask: Translate the provided Swedish Markdown text into natural, idiomatic English while preserving all Markdown formatting, links, code spans, and tables.`
    case 'translate-en-sv':
      return `${baseRules}\nTask: Translate the provided English Markdown text into natural, idiomatic Swedish (observing strict compound word rules / ingen särskrivning) while preserving all Markdown formatting, links, code spans, and tables.`
    case 'format-table':
      return `${baseRules}\nTask: Convert the provided unstructured text or notes into a clean, well-aligned GitHub Flavored Markdown (GFM) table.`
    case 'format-list':
      return `${baseRules}\nTask: Convert the provided notes into a structured Markdown bulleted or task list.`
    case 'mermaid':
      return `${baseRules}\nTask: Generate a valid Mermaid diagram inside a \`\`\`mermaid code fence based on the user request or selected text.`
    case 'summarize':
      return `${baseRules}\nTask: Produce a concise executive summary of the provided text using Markdown bullet points in the same language.`
    default:
      return `${baseRules}\nTask: Fulfill the user's writing or Markdown formatting instruction accurately.`
  }
}

/**
 * Deterministic post-processor that strips reasoning blocks (`<think>...</think>`),
 * conversational preambles, and accidental outer ```markdown wrapper fences when inserting prose/tables.
 */
export function sanitizeAndCleanAIOutput(
  rawOutput: string,
  options: { preserveMermaidFence?: boolean } = {}
): string {
  // 1. Strip <think>...</think> blocks from reasoning models (DeepSeek-R1, Qwen3-Thinking)
  let cleaned = rawOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Strip common conversational preambles on the first line
  cleaned = cleaned.replace(
    /^(?:(?:Sure|Certainly|Of course|Självklart)[!,.]?\s*)?(?:Here is [^\n]*:|Här är [^\n]*:)\s*\r?\n+/i,
    ''
  )

  // 3. Strip accidental outer ```markdown ... ``` wrapper fences
  const outerMdFence = cleaned.match(/^```(?:markdown|md)\r?\n([\s\S]*?)\r?\n```$/i)
  if (outerMdFence) {
    cleaned = outerMdFence[1].trim()
  } else if (!options.preserveMermaidFence) {
    const genericOuterFence = cleaned.match(/^```\r?\n([\s\S]*?)\r?\n```$/)
    if (genericOuterFence && !cleaned.startsWith('```mermaid')) {
      cleaned = genericOuterFence[1].trim()
    }
  }

  // 4. Strip dangerous HTML script tags or inline event handlers
  cleaned = cleaned
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  return cleaned.trim()
}
