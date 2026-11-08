/**
 * The renderer's one place for turning untrusted markup into markup that is safe to insert as HTML
 * (SEC-DOM-2, docs/security.md §3).
 *
 * Documents, SVG files and Mermaid sources come from the user's workspace, which can contain files
 * from others (cloned repos, downloads), so everything is treated as hostile. Each sink uses DOMPurify
 * (an allow-list, DOM-based sanitizer; bundled from npm, no network loads) with the narrowest profile
 * that keeps the feature working:
 *
 * - sanitizeMermaidSvg:  Mermaid output. SVG + HTML labels inside <foreignObject>, Mermaid's <style>.
 * - sanitizeSvgDocument: SVG files opened in the visual asset viewer. SVG only, no <foreignObject>.
 * - sanitizePreviewHtml: rendered Markdown (preview pane, slides, KaTeX widgets). HTML + SVG + MathML,
 *                        klartext-asset: image URLs, and Mermaid SVG embedded in slides.
 *
 * Never sanitize, then modify the string, then insert it: sanitize last, right before the sink.
 */
import createDOMPurify, { type Config, type DOMPurify } from 'dompurify'

// Same as DOMPurify's default URI allow-list, plus the app's own klartext-asset: protocol
// (served by the main process from inside a mounted root, through the path guard).
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|klartext-asset):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

const SVG_HREF_ATTRS = ['href', 'xlink:href']

let purifier: DOMPurify | null = null

/**
 * A private DOMPurify instance, so our hook doesn't leak into the copy Mermaid uses internally.
 * Created lazily: it needs the renderer's `window`.
 */
function getPurifier(): DOMPurify {
  if (purifier) return purifier
  const instance = createDOMPurify(window)
  // <use> may only reference something inside the same SVG (#id). External references
  // (other files, data: URLs) are removed; the browser would block most of them anyway.
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName.toLowerCase() !== 'use') return
    for (const name of SVG_HREF_ATTRS) {
      const value = node.getAttribute(name)
      if (value !== null && !value.trim().startsWith('#')) node.removeAttribute(name)
    }
  })
  purifier = instance
  return instance
}

const MERMAID_SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  // Mermaid draws HTML labels in <foreignObject>, reuses shapes with <use href="#…"> and wraps
  // text fallbacks in <switch>. foreignObject is an HTML integration point in the HTML spec;
  // DOMPurify still checks every element and attribute inside it against the allow-list.
  ADD_TAGS: ['foreignObject', 'use', 'switch'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
  ALLOWED_URI_REGEXP
}

const SVG_DOCUMENT_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['use', 'switch'],
  ALLOWED_URI_REGEXP
}

const PREVIEW_HTML_CONFIG: Config = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  // semantics/annotation: KaTeX's MathML (the TeX source, read by screen readers).
  // foreignObject/use/switch: Mermaid diagrams embedded in slides.
  ADD_TAGS: ['semantics', 'annotation', 'foreignObject', 'use', 'switch'],
  // target: bookmark cards open in the system browser via the window-open handler.
  ADD_ATTR: ['target'],
  // Markdown never produces forms (rehype-sanitize drops them); a smuggled one could fake app UI.
  FORBID_TAGS: ['form'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
  ALLOWED_URI_REGEXP
}

/** Mermaid-rendered SVG, keeping its HTML labels, <style> and markers. */
export function sanitizeMermaidSvg(svg: string): string {
  return getPurifier().sanitize(svg, MERMAID_SVG_CONFIG) as string
}

/** An SVG file from the workspace, for the visual asset viewer. */
export function sanitizeSvgDocument(svg: string): string {
  return getPurifier().sanitize(svg, SVG_DOCUMENT_CONFIG) as string
}

/** Rendered Markdown HTML (preview pane, slides) and KaTeX output. */
export function sanitizePreviewHtml(html: string): string {
  return getPurifier().sanitize(html, PREVIEW_HTML_CONFIG) as string
}
