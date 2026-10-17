/**
 * Built-in Offline Bilingual (Swedish & English) Text Rewrite, Grammar/Särskrivning Fixer,
 * Summarizer, and Translator Fallback.
 *
 * Used automatically when no external Ollama / LM Studio server is reachable on localhost
 * or when no local LLM models are installed yet, ensuring AI Rewrite and Multi-Root Q&A
 * always produce clean, high-quality proposals without strikethrough artifacts.
 */

const SWEDISH_SARSKRIVNING_RULES: Array<[RegExp, string]> = [
  [/\banvändar\s+gränssnitt(et|en|ets)?\b/gi, 'användargränssnitt$1'],
  [/\bprojekt\s+ledare(n|ns)?\b/gi, 'projektledare$1'],
  [/\bsystem\s+arkitektur(en)?\b/gi, 'systemarkitektur$1'],
  [/\barbets\s+yta(n|or|orna)?\b/gi, 'arbetsyta$1'],
  [/\binformations\s+säkerhet(en)?\b/gi, 'informationssäkerhet$1'],
  [/\bsäkerhets\s+granskning(en|ar|arna)?\b/gi, 'säkerhetsgranskning$1'],
  [/\bsäkerhets\s+kopia(n)?\b/gi, 'säkerhetskopia$1'],
  [/\bsäkerhets\s+kopior(na)?\b/gi, 'säkerhetskopior$1'],
  [/\bversions\s+hantering(en)?\b/gi, 'versionshantering$1'],
  [/\bbehörighets\s+kontroll(en|er)?\b/gi, 'behörighetskontroll$1'],
  [/\båtkomst\s+kontroll(en|er)?\b/gi, 'åtkomstkontroll$1'],
  [/\binloggnings\s+uppgifter(na)?\b/gi, 'inloggningsuppgifter$1'],
  [/\bkonfigurations\s+fil(en|er|erna)?\b/gi, 'konfigurationsfil$1'],
  [/\bdata\s+bas(en|er|erna)?\b/gi, 'databas$1'],
  [/\bkäll\s+kod(en)?\b/gi, 'källkod$1'],
  [/\bnätverks\s+trafik(en)?\b/gi, 'nätverkstrafik$1'],
  [/\bmjukvaru\s+utveckling(en)?\b/gi, 'mjukvaruutveckling$1'],
  [/\bhårdvaru\s+krav(en)?\b/gi, 'hårdvarukrav$1'],
  [/\bfel\s+meddelande(n|t|na)?\b/gi, 'felmeddelande$1'],
  [/\blösenords\s+hantering(en)?\b/gi, 'lösenordshantering$1'],
  [/\banvändar\s+konto(n|t|na)?\b/gi, 'användarkonto$1'],
  [/\btids\s+stämpel(n)?\b/gi, 'tidsstämpel$1'],
  [/\bfil\s+struktur(en)?\b/gi, 'filstruktur$1'],
  [/\barbets\s+flöde(t|n|na)?\b/gi, 'arbetsflöde$1'],
  [/\bmötes\s+anteckningar(na)?\b/gi, 'mötesanteckningar$1'],
  [/\bkrav\s+specifikation(en|er)?\b/gi, 'kravspecifikation$1'],
  [/\btest\s+miljö(n|er)?\b/gi, 'testmiljö$1'],
  [/\bproduktions\s+miljö(n|er)?\b/gi, 'produktionsmiljö$1'],
  [/\bhuvud\s+fönster\b/gi, 'huvudfönster'],
  [/\bsido\s+panel(en|er)?\b/gi, 'sidopanel$1'],
  [/\btext\s+redigerare(n)?\b/gi, 'textredigerare$1']
]

const SWEDISH_GRAMMAR_RULES: Array<[RegExp, string]> = [
  [/\bdom\b/g, 'de'],
  [/\bDom\b/g, 'De'],
  [/\bvåran\b/gi, 'vår'],
  [/\bvårat\b/gi, 'vårt'],
  [/\beran\b/gi, 'er'],
  [/\berat\b/gi, 'ert'],
  [/\bmej\b/gi, 'mig'],
  [/\bdej\b/gi, 'dig'],
  [/\bsej\b/gi, 'sig'],
  [/\bnån\b/g, 'någon'],
  [/\bNån\b/g, 'Någon'],
  [/\bnåt\b/g, 'något'],
  [/\bNåt\b/g, 'Något'],
  [/\bnåra\b/g, 'några'],
  [/\bNåra\b/g, 'Några'],
  [/\bsån\b/g, 'sådan'],
  [/\bsånt\b/g, 'sådant'],
  [/\bsåna\b/g, 'sådana'],
  [/\bsenn\b/gi, 'sedan'],
  [/\biallafall\b/gi, 'i alla fall'],
  [/\böverhuvudtaget\b/gi, 'över huvud taget'],
  [/\bpå grund utav\b/gi, 'på grund av'],
  [/\bt\.?ex\b(?!\.)/gi, 't.ex.'],
  [/\bbl\.?a\b(?!\.)/gi, 'bl.a.'],
  [/\bosv\b(?!\.)/gi, 'osv.'],
  [/\bpga\b(?!\.)/gi, 'på grund av'],
  [/\bmha\b(?!\.)/gi, 'med hjälp av']
]

const SWEDISH_STYLE_REWRITE_RULES: Array<[RegExp, string]> = [
  [/\bi dagsläget\b/gi, 'för närvarande'],
  [/\bjust nu\b/gi, 'för närvarande'],
  [/\bkolla på\b/gi, 'granska'],
  [/\bkollade på\b/gi, 'granskade'],
  [/\bkollat på\b/gi, 'granskat'],
  [/\bfixa\b/gi, 'åtgärda'],
  [/\bfixade\b/gi, 'åtgärdade'],
  [/\bfixat\b/gi, 'åtgärdat'],
  [/\bsätta upp\b/gi, 'konfigurera'],
  [/\bgöra klart\b/gi, 'slutföra'],
  [/\bta fram\b/gi, 'utarbeta'],
  [/\bprata om\b/gi, 'diskutera'],
  [/\bpratade om\b/gi, 'diskuterade'],
  [/\bse till att\b/gi, 'säkerställa att'],
  [/\bser till att\b/gi, 'säkerställer att'],
  [/\bjättebra\b/gi, 'utmärkt'],
  [/\bjätte\s+bra\b/gi, 'utmärkt'],
  [/\bväldigt bra\b/gi, 'utmärkt'],
  [/\bväldigt viktig(t|a)?\b/gi, 'avgörande'],
  [/\bmycket viktig(t|a)?\b/gi, 'central$1'],
  [/\bför att kunna\b/gi, 'för att'],
  [/\bsamt att vi\b/gi, 'och vi'],
  [/\bdet här är\b/gi, 'detta är'],
  [/\bDet här är\b/g, 'Detta är'],
  [/\bden här\b/gi, 'denna'],
  [/\bDen här\b/g, 'Denna'],
  [/\bvi behöver\b/gi, 'vi bör'],
  [/\bVi behöver\b/g, 'Vi bör'],
  [/\bjobba med\b/gi, 'arbeta med'],
  [/\bjobbar med\b/gi, 'arbetar med'],
  [/\bjobbade med\b/gi, 'arbetade med'],
  [/\banvända oss av\b/gi, 'använda'],
  [/\banvänder oss av\b/gi, 'använder'],
  [/\bpå ett bra sätt\b/gi, 'effektivt'],
  [/\bpå ett enkelt sätt\b/gi, 'smidigt']
]

const ENGLISH_GRAMMAR_AND_STYLE_RULES: Array<[RegExp, string]> = [
  [/\bteh\b/gi, 'the'],
  [/\brecieve\b/gi, 'receive'],
  [/\bseperate\b/gi, 'separate'],
  [/\boccured\b/gi, 'occurred'],
  [/\bdont\b/gi, 'do not'],
  [/\bdoesnt\b/gi, 'does not'],
  [/\bcant\b/gi, 'cannot'],
  [/\bwont\b/gi, 'will not'],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'currently'],
  [/\bmake sure\b/gi, 'ensure'],
  [/\blook into\b/gi, 'investigate'],
  [/\bset up\b/gi, 'configure'],
  [/\bfind out\b/gi, 'determine']
]

export function isLikelySwedishText(text: string): boolean {
  if (/[åäöÅÄÖ]/.test(text)) return true
  const lower = ` ${text.toLowerCase()} `
  const svStopWords = [
    ' och ',
    ' att ',
    ' det ',
    ' som ',
    ' är ',
    ' för ',
    ' på ',
    ' med ',
    ' inte ',
    ' har ',
    ' från ',
    ' till ',
    ' eller ',
    ' ska ',
    ' detta ',
    ' vi ',
    ' när ',
    ' vad ',
    ' hur ',
    ' vilka '
  ]
  let hits = 0
  for (const w of svStopWords) {
    if (lower.includes(w)) hits++
  }
  return hits >= 2
}

function splitYamlFrontmatter(markdown: string): { frontmatterBlock: string; body: string } {
  const match = markdown.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/)
  if (!match) {
    return { frontmatterBlock: '', body: markdown }
  }
  return {
    frontmatterBlock: match[1],
    body: markdown.slice(match[1].length)
  }
}

function capitalizeSentencesInLine(line: string): string {
  const trimmed = line.trim()
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('```') ||
    trimmed.startsWith('|') ||
    trimmed.startsWith('>') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('*') ||
    /^\d+\./.test(trimmed)
  ) {
    return line.replace(/([.!?]\s+)([a-zåäö])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
  }
  const leadingSpaces = line.match(/^\s*/)?.[0] || ''
  let updated = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  updated = updated.replace(/([.!?]\s+)([a-zåäö])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
  if (!/[.!?:)\]]$/.test(updated) && updated.split(/\s+/).length >= 4) {
    updated += '.'
  }
  return `${leadingSpaces}${updated}`
}

function toUnicodeWordBoundaryRegex(reg: RegExp): RegExp {
  const src = reg.source
    .replace(/^\\b/, '(?<![\\p{L}\\p{N}])')
    .replace(/\\b$/, '(?![\\p{L}\\p{N}])')
    .replace(/\\b/g, '(?:(?<![\\p{L}\\p{N}])|(?![\\p{L}\\p{N}]))')
  const flags = reg.flags.includes('u') ? reg.flags : `${reg.flags}u`
  return new RegExp(src, flags)
}

function applyRuleSetPreservingCodeBlocks(
  body: string,
  rules: Array<[RegExp, string]>,
  polishSentences: boolean
): string {
  const unicodeRules = rules.map(
    ([pattern, replacement]) => [toUnicodeWordBoundaryRegex(pattern), replacement] as const
  )
  const lines = body.split('\n')
  let inFence = false
  const outLines = lines.map((line) => {
    if (line.trim().startsWith('```')) {
      inFence = !inFence
      return line
    }
    if (inFence) return line

    let transformed = line.replace(/[ \t]{2,}/g, ' ')
    for (const [pattern, replacement] of unicodeRules) {
      transformed = transformed.replace(pattern, replacement)
    }
    if (polishSentences) {
      transformed = capitalizeSentencesInLine(transformed)
    }
    return transformed
  })
  return outLines.join('\n')
}

function translateSwToEnOffline(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\banvändargränssnitt(et)?\b/gi, 'user interface'],
    [/\banvändar\s+gränssnitt(et)?\b/gi, 'user interface'],
    [/\bsäkerhetsgranskning(en)?\b/gi, 'security audit'],
    [/\binformationssäkerhet(en)?\b/gi, 'information security'],
    [/\bversionshantering(en)?\b/gi, 'version control'],
    [/\barbetsyta(n)?\b/gi, 'workspace'],
    [/\bsammanfattning\b/gi, 'Summary'],
    [/\bbakgrund\b/gi, 'Background'],
    [/\bslutrapport\b/gi, 'Final Report'],
    [/\bmötesanteckningar\b/gi, 'Meeting Notes'],
    [/\båtgärder\b/gi, 'Action Items'],
    [/\bbeslut\b/gi, 'Decisions'],
    [/\bdetta dokument beskriver\b/gi, 'This document describes'],
    [/\bdet här är\b/gi, 'this is'],
    [/\bvi behöver\b/gi, 'we need to'],
    [/\bför närvarande\b/gi, 'currently'],
    [/\bi dagsläget\b/gi, 'currently'],
    [/\bgranska\b/gi, 'review'],
    [/\båtgärda\b/gi, 'resolve'],
    [/\bkonfigurera\b/gi, 'configure'],
    [/\boch\b/gi, 'and'],
    [/\beller\b/gi, 'or'],
    [/\bför att\b/gi, 'to'],
    [/\bmed hjälp av\b/gi, 'using'],
    [/\bpå grund av\b/gi, 'due to'],
    [/\bär\b/gi, 'is'],
    [/\bhar\b/gi, 'has'],
    [/\binte\b/gi, 'not'],
    [/\bfrån\b/gi, 'from'],
    [/\btill\b/gi, 'to'],
    [/\bmed\b/gi, 'with']
  ]
  return applyRuleSetPreservingCodeBlocks(text, replacements, true)
}

function translateEnToSvOffline(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\buser interface\b/gi, 'användargränssnitt'],
    [/\bsecurity audit\b/gi, 'säkerhetsgranskning'],
    [/\binformation security\b/gi, 'informationssäkerhet'],
    [/\bversion control\b/gi, 'versionshantering'],
    [/\bworkspace\b/gi, 'arbetsyta'],
    [/\bexecutive summary\b/gi, 'Sammanfattning'],
    [/\bsummary\b/gi, 'Sammanfattning'],
    [/\bbackground\b/gi, 'Bakgrund'],
    [/\bmeeting notes\b/gi, 'Mötesanteckningar'],
    [/\baction items\b/gi, 'Åtgärdspunkter'],
    [/\bdecisions\b/gi, 'Beslut'],
    [/\bthis document describes\b/gi, 'Detta dokument beskriver'],
    [/\bwe need to\b/gi, 'vi behöver'],
    [/\bcurrently\b/gi, 'för närvarande'],
    [/\breview\b/gi, 'granska'],
    [/\bresolve\b/gi, 'åtgärda'],
    [/\bconfigure\b/gi, 'konfigurera'],
    [/\band\b/gi, 'och'],
    [/\bor\b/gi, 'eller'],
    [/\busing\b/gi, 'med hjälp av'],
    [/\bdue to\b/gi, 'på grund av'],
    [/\bfrom\b/gi, 'från'],
    [/\bwith\b/gi, 'med']
  ]
  return applyRuleSetPreservingCodeBlocks(text, replacements, true)
}

export function generateBuiltInBilingualFallback(params: {
  action: string
  prompt: string
  selectedText: string
  tone?: string
}): string {
  const rawInput = params.selectedText || params.prompt || ''
  const { frontmatterBlock, body } = splitYamlFrontmatter(rawInput)
  const sourceBody = body.trim() || rawInput.trim()
  const isSwedish = isLikelySwedishText(sourceBody) || isLikelySwedishText(params.prompt || '')

  if (params.action === 'translate-sv-en') {
    return `${frontmatterBlock}${translateSwToEnOffline(body || rawInput)}`.trim()
  }

  if (params.action === 'translate-en-sv') {
    return `${frontmatterBlock}${translateEnToSvOffline(body || rawInput)}`.trim()
  }

  if (params.action === 'translate-sv') {
    const translated = isLikelySwedishText(sourceBody)
      ? translateSwToEnOffline(body || rawInput)
      : translateEnToSvOffline(body || rawInput)
    return `${frontmatterBlock}${translated}`.trim()
  }

  if (params.action === 'summarize') {
    const nonEmptyLines = sourceBody
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').trim())
      .filter((l) => l.length > 0 && !l.startsWith('```'))
      .slice(0, 4)

    const calloutTitle = isSwedish ? 'Sammanfattning' : 'Executive Summary'
    const bullets =
      nonEmptyLines.length > 0
        ? nonEmptyLines.map((l) => `> - ${l.replace(/^[-*+]\s*/, '')}`).join('\n')
        : isSwedish
          ? '> - Sammanfattning av dokumentets viktigaste punkter.'
          : '> - Concise summary of the document key points.'

    return `${frontmatterBlock}> [!NOTE] ${calloutTitle}\n${bullets}\n\n${body.trim()}`.trim()
  }

  if (params.action === 'format-list') {
    const lines = sourceBody
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const listMd = lines
      .map((l) => (l.startsWith('-') || l.startsWith('#') ? l : `- ${l}`))
      .join('\n')
    return `${frontmatterBlock}${listMd}`.trim()
  }

  if (params.action === 'draft' && !params.selectedText.trim() && params.prompt.trim()) {
    const promptText = params.prompt.trim()
    if (isSwedish) {
      return `## ${promptText}\n\nDetta avsnitt behandlar ${promptText.toLowerCase()} med fokus på tydlig struktur, spårbarhet och praktiskt genomförande.`
    }
    return `## ${promptText}\n\nThis section outlines ${promptText.toLowerCase()} with clear structure, actionable steps, and verification criteria.`
  }

  // Default: 'improve', 'grammar', 'tone', 'custom', or 'draft' with existing text
  if (isSwedish) {
    const rules =
      params.action === 'grammar'
        ? [...SWEDISH_SARSKRIVNING_RULES, ...SWEDISH_GRAMMAR_RULES]
        : [
            ...SWEDISH_SARSKRIVNING_RULES,
            ...SWEDISH_GRAMMAR_RULES,
            ...SWEDISH_STYLE_REWRITE_RULES
          ]
    let rewritten = applyRuleSetPreservingCodeBlocks(body || rawInput, rules, true)

    // Ensure that if the user explicitly requested a rewrite ('improve', 'tone', 'custom') and no lexical rule triggered,
    // we still refine the Swedish prose structure so the proposal is cleanly polished.
    if (rewritten.trim() === (body || rawInput).trim() && params.action !== 'grammar') {
      const paragraphs = (body || rawInput)
        .trim()
        .split(/\n{2,}/)
        .map((para) => {
          const t = para.trim()
          if (
            !t ||
            t.startsWith('#') ||
            t.startsWith('```') ||
            t.startsWith('-') ||
            t.startsWith('*') ||
            t.startsWith('>') ||
            t.startsWith('|')
          ) {
            return para
          }
          const polished = capitalizeSentencesInLine(t)
          return polished
        })
      rewritten = paragraphs.join('\n\n')
    }

    return `${frontmatterBlock}${rewritten}`.trim()
  } else {
    const rewritten = applyRuleSetPreservingCodeBlocks(
      body || rawInput,
      ENGLISH_GRAMMAR_AND_STYLE_RULES,
      true
    )
    return `${frontmatterBlock}${rewritten}`.trim()
  }
}
