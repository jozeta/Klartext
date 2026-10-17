export function buildSystemPromptForAction(action: string, tone?: string): string {
  const baseRules = [
    'You are Klartext Local AI, a precise technical and bilingual (English and Swedish) writing and Markdown assistant.',
    'CRITICAL RULES:',
    '1. Always write the output in the EXACT same language as the Input Markdown (if the Input Markdown is in Swedish, you MUST respond in Swedish even if the instruction is in English, unless translation is explicitly requested).',
    '2. When writing in Swedish, observe strict Swedish grammar, Klarspråk clarity, and compound-word rules (undvik särskrivning, e.g., write "användargränssnitt", "versionshantering", "säkerhetsgranskning" as single compound words, and avoid Danish/Norwegian vocabulary).',
    '3. Output RAW, valid Markdown ONLY. Never include conversational filler, greetings, or preambles such as "Sure! Here is the revised text:" or "Här är förslaget:".',
    '4. NEVER use strikethrough (~~text~~) to mark old or deleted text. Output ONLY the clean, final rewritten text.',
    '5. Preserve existing Markdown links, [[WikiLinks]], code spans, and mathematical expressions intact.'
  ].join('\n')

  switch (action) {
    case 'improve':
      return `${baseRules}\nTask: Rewrite and improve clarity, flow, and precision of the provided Markdown text while keeping its original language (Swedish or English) and Markdown structure.`
    case 'grammar':
      return `${baseRules}\nTask: Fix all spelling, grammar, punctuation, and Swedish compound word errors (särskrivningar) in the provided text without changing its meaning.`
    case 'tone':
      return `${baseRules}\nTask: Rewrite the provided text in a ${tone || 'technical'} tone while preserving its language and Markdown formatting.`
    case 'translate-sv-en':
      return `${baseRules}\nTask: Translate the provided Swedish Markdown text into natural, idiomatic English while preserving all Markdown formatting, links, code spans, and tables.`
    case 'translate-en-sv':
    case 'translate-sv':
      return `${baseRules}\nTask: Translate the provided Markdown text between Swedish and English (observing strict Swedish compound word rules / ingen särskrivning) while preserving all Markdown formatting, links, code spans, and tables.`
    case 'format-table':
      return `${baseRules}\nTask: Convert the provided unstructured text or notes into a clean, well-aligned GitHub Flavored Markdown (GFM) table.`
    case 'format-list':
      return `${baseRules}\nTask: Convert the provided notes into a structured Markdown bulleted or task list.`
    case 'mermaid':
      return `${baseRules}\nTask: Generate a valid Mermaid diagram inside a \`\`\`mermaid code fence based on the user request or selected text.`
    case 'summarize':
      return `${baseRules}\nTask: Produce a concise executive summary of the provided text using Markdown bullet points in the same language.`
    default:
      return `${baseRules}\nTask: Fulfill the user's writing or Markdown rewriting instruction accurately in the language of the input text, returning only the clean final text without strikethroughs.`
  }
}

/**
 * Deterministic post-processor that strips reasoning blocks (`<think>...</think>`),
 * conversational preambles, accidental outer ```markdown wrapper fences, and accidental whole-text strikethroughs.
 */
export function sanitizeAndCleanAIOutput(
  rawOutput: string,
  options: { preserveMermaidFence?: boolean } = {}
): string {
  // 1. Strip <think>...</think> blocks from reasoning models (DeepSeek-R1, Qwen3-Thinking)
  let cleaned = rawOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Strip common conversational preambles on the first line
  cleaned = cleaned.replace(
    /^(?:(?:Sure|Certainly|Of course|Självklart|Absolut)[!,.]?\s*)?(?:Here is [^\n]*:|Här är [^\n]*:)\s*\r?\n+/i,
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

  // 4. If a model accidentally wrapped an entire paragraph/response in ~~strikethrough~~, unwrap it
  if (/^~~[\s\S]+~~$/.test(cleaned)) {
    cleaned = cleaned.replace(/^~~/, '').replace(/~~$/, '').trim()
  }

  // 5. Strip dangerous HTML script tags or inline event handlers
  cleaned = cleaned
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  return cleaned.trim()
}
