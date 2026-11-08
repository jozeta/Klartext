/**
 * Puts the rendered Mermaid SVG for each ```mermaid block of a slide in place of the
 * `<div class="klartext-mermaid-placeholder" data-mermaid-index="N">` the Markdown pipeline left there.
 *
 * The result is not safe to insert yet: the caller must run sanitizePreviewHtml() on it last,
 * right before the sink (SEC-DOM-2).
 */
export async function spliceSlideMermaid(
  html: string,
  blocks: ReadonlyArray<{ index: number; code: string }>,
  renderSvg: (code: string) => Promise<string>
): Promise<string> {
  let result = html
  for (const block of blocks) {
    let svg: string
    try {
      svg = await renderSvg(block.code)
    } catch {
      // Diagram syntax is incomplete: leave the placeholder.
      continue
    }
    const placeholder = new RegExp(
      `<div class="klartext-mermaid-placeholder" data-mermaid-index="${block.index}"[^>]*></div>`,
      'g'
    )
    // A function replacer, so `$&`/`$1` in diagram text isn't treated as a replacement pattern.
    result = result.replace(
      placeholder,
      () => `<div class="klartext-slide-mermaid" data-testid="slide-mermaid-diagram">${svg}</div>`
    )
  }
  return result
}
