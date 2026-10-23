import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType
} from '@codemirror/view'
import { StateField } from '@codemirror/state'
import katex from 'katex'
import { sanitizeSvgContent } from '../../../shared/serialization/excalidraw-svg'
import { highlightCodeToHtml } from '../../../shared/markdown/syntax-highlight'
import {
  getCachedMermaidSvgSync,
  renderCachedMermaidSvg
} from '../diagrams/DiagramWidgets'
import {
  formatAllTablesInMarkdown,
  formatMarkdownDocument,
  formatMarkdownTable,
  parseImageAltMetadata,
  formatImageAltMetadata
} from '../../../shared/markdown/pipeline'
import { renderUntitledIconToSvgHtml } from '../../../shared/icons/untitled-icon-svg'

export type WorkspaceDocumentEntry = WorkspaceDocEntry

class InlineFootnoteRefWidget extends WidgetType {
  constructor(
    private footnoteId: string,
    private fromPos: number
  ) {
    super()
  }

  eq(other: InlineFootnoteRefWidget): boolean {
    return this.footnoteId === other.footnoteId && this.fromPos === other.fromPos
  }

  toDOM(): HTMLElement {
    const sup = document.createElement('sup')
    sup.className =
      'cm-klartext-footnote-ref px-1 py-0.5 mx-0.5 rounded bg-accent/15 text-accent font-mono text-[10px] font-semibold cursor-pointer hover:bg-accent hover:text-white transition-colors'
    sup.setAttribute('data-footnote-id', this.footnoteId)
    sup.setAttribute('data-testid', `footnote-ref-${this.footnoteId}`)
    sup.textContent = `[${this.footnoteId}]`
    return sup
  }
}

class InlineBookmarkCardWidget extends WidgetType {
  constructor(
    private title: string,
    private url: string,
    private domain: string,
    private description: string,
    private targetPos: number,
    private onNavigate: (target: string, isWiki: boolean) => void
  ) {
    super()
  }

  eq(other: InlineBookmarkCardWidget): boolean {
    return (
      this.title === other.title &&
      this.url === other.url &&
      this.domain === other.domain &&
      this.description === other.description &&
      this.targetPos === other.targetPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const card = document.createElement('div')
    card.className =
      'my-2 p-3 rounded-lg border border-subtle bg-secondary/40 hover:border-accent transition-colors flex items-start justify-between gap-3 text-xs'
    card.setAttribute('data-testid', 'bookmark-card-widget')

    const left = document.createElement('div')
    left.className = 'min-w-0 flex-1 flex flex-col gap-1 cursor-pointer'
    left.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onNavigate(this.url, false)
    })

    const titleEl = document.createElement('div')
    titleEl.className = 'font-semibold text-primary text-sm truncate flex items-center gap-1.5'
    titleEl.setAttribute('data-testid', 'bookmark-card-title')
    titleEl.textContent = `🔖 ${this.title || this.domain || this.url}`
    left.appendChild(titleEl)

    if (this.description) {
      const descEl = document.createElement('div')
      descEl.className = 'text-muted text-[11px] line-clamp-2 leading-relaxed'
      descEl.setAttribute('data-testid', 'bookmark-card-description')
      descEl.textContent = this.description
      left.appendChild(descEl)
    }

    const domainEl = document.createElement('div')
    domainEl.className = 'text-[10px] font-mono text-accent truncate'
    domainEl.setAttribute('data-testid', 'bookmark-card-domain')
    domainEl.textContent = `${this.domain || this.url} · ${this.url}`
    left.appendChild(domainEl)

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className =
      'px-2 py-0.5 rounded bg-panel border border-subtle text-[10px] text-muted hover:text-primary shrink-0'
    editBtn.textContent = 'Edit Card'
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })

    card.appendChild(left)
    card.appendChild(editBtn)
    return card
  }
}

class InlineUntitledIconWidget extends WidgetType {
  constructor(
    private iconName: string,
    private svgHtml: string,
    private targetPos: number
  ) {
    super()
  }

  eq(other: InlineUntitledIconWidget): boolean {
    return this.iconName === other.iconName && this.targetPos === other.targetPos
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    span.className = 'klartext-inline-icon-wrap cursor-pointer'
    span.setAttribute('data-icon', this.iconName)
    span.title = `:icon[${this.iconName}]:`
    span.innerHTML = this.svgHtml
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })
    return span
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private pos: number
  ) {
    super()
  }

  eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.pos === other.pos
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'mr-1.5 accent-accent cursor-pointer align-middle'
    input.setAttribute('aria-label', 'Toggle task checkbox')
    input.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const replacement = this.checked ? '[ ]' : '[x]'
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: replacement }
      })
    })
    return input
  }
}

class InlineMathWidget extends WidgetType {
  constructor(
    private latex: string,
    private displayMode: boolean,
    private targetPos: number
  ) {
    super()
  }

  eq(other: InlineMathWidget): boolean {
    return (
      this.latex === other.latex &&
      this.displayMode === other.displayMode &&
      this.targetPos === other.targetPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement(this.displayMode ? 'div' : 'span')
    wrapper.className = this.displayMode
      ? 'my-2 py-2 px-3 rounded bg-secondary/40 text-center overflow-x-auto cursor-pointer'
      : 'px-0.5 cursor-pointer'
    try {
      wrapper.innerHTML = katex.renderToString(this.latex, {
        displayMode: this.displayMode,
        throwOnError: false
      })
    } catch {
      wrapper.textContent = this.latex
    }
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })
    return wrapper
  }
}

class InlineLinkWidget extends WidgetType {
  constructor(
    private label: string,
    private href: string,
    private isWiki: boolean,
    private onNavigate: (target: string, isWiki: boolean) => void
  ) {
    super()
  }

  eq(other: InlineLinkWidget): boolean {
    return (
      this.label === other.label &&
      this.href === other.href &&
      this.isWiki === other.isWiki
    )
  }

  toDOM(): HTMLElement {
    const a = document.createElement('a')
    a.href = this.href
    a.textContent = this.label
    if (this.isWiki) {
      a.setAttribute('data-wikilink', encodeURIComponent(this.href))
    }
    a.className =
      'text-accent underline underline-offset-2 font-medium cursor-pointer hover:opacity-80'
    a.title = `Click to navigate to ${this.href}`
    a.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onNavigate(this.href, this.isWiki)
    })
    return a
  }
}

class InlineImageOrDrawingWidget extends WidgetType {
  constructor(
    private rawAlt: string,
    private rawUrl: string,
    private rootId: string,
    private isExcalidraw: boolean,
    private fromPos: number,
    private toPos: number,
    private onEditExcalidraw: (relPath: string) => void,
    private onOpenImageLightbox?: (info: {
      src: string
      caption: string
      rawUrl: string
    }) => void
  ) {
    super()
  }

  eq(other: InlineImageOrDrawingWidget): boolean {
    return (
      this.rawAlt === other.rawAlt &&
      this.rawUrl === other.rawUrl &&
      this.rootId === other.rootId &&
      this.isExcalidraw === other.isExcalidraw &&
      this.fromPos === other.fromPos &&
      this.toPos === other.toPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const meta = parseImageAltMetadata(this.rawAlt)
    const displayAlt = meta.caption
    const parsedWidth = meta.width ?? null
    const align = meta.align || 'left'

    const outerRow = document.createElement('div')
    outerRow.setAttribute('data-testid', 'inline-image-outer-row')
    outerRow.setAttribute('data-image-align', align)
    outerRow.className = `w-full flex my-2 ${
      align === 'center'
        ? 'justify-center'
        : align === 'right'
          ? 'justify-end'
          : 'justify-start'
    }`

    const container = document.createElement('figure')
    container.className =
      'klartext-resizable-image-box m-0 p-2 rounded-md border border-subtle bg-panel inline-flex flex-col items-center max-w-full relative select-none transition-shadow'
    container.setAttribute('data-testid', 'inline-resizable-image')

    const cleanRel = this.rawUrl.replace(/^\.\//, '')
    const resolvedSrc =
      this.rawUrl.startsWith('http://') ||
      this.rawUrl.startsWith('https://') ||
      this.rawUrl.startsWith('data:') ||
      this.rawUrl.startsWith('klartext-asset://')
        ? this.rawUrl
        : `klartext-asset://${encodeURIComponent(this.rootId)}/${cleanRel}`

    // Top control toolbar (shown when image is clicked/selected)
    const controlsBar = document.createElement('div')
    controlsBar.setAttribute('data-testid', 'image-widget-controls')
    controlsBar.className =
      'hidden mb-2 px-2 py-1 rounded bg-secondary border border-subtle flex flex-wrap items-center gap-1.5 text-[11px] z-20'

    const dispatchMetaUpdate = (nextMeta: {
      caption: string
      width?: number
      align?: 'left' | 'center' | 'right'
    }) => {
      const formattedAlt = formatImageAltMetadata(nextMeta)
      const updatedMarkdown = `![${formattedAlt}](${this.rawUrl})`
      view.dispatch({
        changes: {
          from: this.fromPos,
          to: this.toPos,
          insert: updatedMarkdown
        }
      })
    }

    const alignOptions: Array<{ id: 'left' | 'center' | 'right'; label: string }> = [
      { id: 'left', label: '⇤ Left' },
      { id: 'center', label: '↔ Center' },
      { id: 'right', label: '⇥ Right' }
    ]
    for (const opt of alignOptions) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-testid', `image-align-${opt.id}`)
      btn.className = `px-1.5 py-0.5 rounded border ${
        align === opt.id
          ? 'bg-accent text-white border-accent'
          : 'bg-panel border-subtle text-primary hover:border-accent'
      }`
      btn.textContent = opt.label
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        dispatchMetaUpdate({
          caption: displayAlt,
          width: parsedWidth ?? undefined,
          align: opt.id
        })
      })
      controlsBar.appendChild(btn)
    }

    const captionInput = document.createElement('input')
    captionInput.type = 'text'
    captionInput.setAttribute('data-testid', 'image-caption-input')
    captionInput.placeholder = 'Image caption...'
    captionInput.value = displayAlt
    captionInput.className =
      'px-2 py-0.5 rounded bg-panel border border-subtle text-primary text-[11px] w-36'
    captionInput.addEventListener('mousedown', (e) => e.stopPropagation())
    captionInput.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        dispatchMetaUpdate({
          caption: captionInput.value.trim(),
          width: parsedWidth ?? undefined,
          align
        })
      }
    })
    controlsBar.appendChild(captionInput)

    const saveCaptionBtn = document.createElement('button')
    saveCaptionBtn.type = 'button'
    saveCaptionBtn.setAttribute('data-testid', 'image-caption-save-btn')
    saveCaptionBtn.className =
      'px-1.5 py-0.5 rounded bg-panel border border-subtle text-primary hover:border-accent'
    saveCaptionBtn.textContent = 'Set Caption'
    saveCaptionBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      dispatchMetaUpdate({
        caption: captionInput.value.trim(),
        width: parsedWidth ?? undefined,
        align
      })
    })
    controlsBar.appendChild(saveCaptionBtn)

    const zoomBtn = document.createElement('button')
    zoomBtn.type = 'button'
    zoomBtn.setAttribute('data-testid', 'image-lightbox-zoom-btn')
    zoomBtn.className =
      'px-2 py-0.5 rounded bg-accent text-white font-medium hover:opacity-90'
    zoomBtn.textContent = '🔍 Lightbox Zoom'
    zoomBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onOpenImageLightbox?.({
        src: resolvedSrc,
        caption: displayAlt,
        rawUrl: this.rawUrl
      })
    })
    controlsBar.appendChild(zoomBtn)

    container.appendChild(controlsBar)

    const imgWrapper = document.createElement('div')
    imgWrapper.className = 'relative inline-block'

    const img = document.createElement('img')
    img.src = resolvedSrc
    img.alt = displayAlt
    img.className = 'rounded mx-auto block max-w-full h-auto cursor-pointer'
    if (parsedWidth) {
      img.style.width = `${parsedWidth}px`
    } else {
      img.className += ' max-h-72 w-auto'
    }
    imgWrapper.appendChild(img)

    // 4 Corner drag handles (shown when image is clicked/selected)
    const corners: Array<{ pos: 'nw' | 'ne' | 'sw' | 'se'; cls: string }> = [
      { pos: 'nw', cls: '-top-1.5 -left-1.5 cursor-nwse-resize' },
      { pos: 'ne', cls: '-top-1.5 -right-1.5 cursor-nesw-resize' },
      { pos: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
      { pos: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' }
    ]

    const handleEls: HTMLElement[] = []
    for (const c of corners) {
      const h = document.createElement('div')
      h.setAttribute('data-testid', `image-resize-handle-${c.pos}`)
      h.className = `hidden absolute ${c.cls} w-3 h-3 rounded-full bg-accent border-2 border-white shadow z-20`
      h.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const startX = e.clientX
        const startWidth = img.getBoundingClientRect().width || parsedWidth || 280
        let latestWidth = Math.round(startWidth)

        const onMove = (moveEv: MouseEvent) => {
          const deltaX =
            c.pos === 'ne' || c.pos === 'se'
              ? moveEv.clientX - startX
              : startX - moveEv.clientX
          latestWidth = Math.max(60, Math.min(1200, Math.round(startWidth + deltaX)))
          img.style.width = `${latestWidth}px`
          img.classList.remove('max-h-72')
        }

        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          dispatchMetaUpdate({
            caption: displayAlt,
            width: latestWidth,
            align
          })
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      })
      handleEls.push(h)
      imgWrapper.appendChild(h)
    }

    let cleanupOutsideListeners: (() => void) | null = null

    const setImageSelected = (selected: boolean) => {
      container.classList.toggle('klartext-image-selected', selected)
      controlsBar.classList.toggle('hidden', !selected)
      handleEls.forEach((h) => h.classList.toggle('hidden', !selected))
      if (!selected && cleanupOutsideListeners) {
        cleanupOutsideListeners()
        cleanupOutsideListeners = null
      }
    }

    // Toggle selection border, controls toolbar, and corner handles when clicking the image,
    // and automatically deselect when clicking outside or typing elsewhere in the editor
    img.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const nextSelected = !container.classList.contains('klartext-image-selected')
      if (nextSelected) {
        // Deselect any other currently selected image widgets first
        document
          .querySelectorAll('.klartext-resizable-image-box.klartext-image-selected')
          .forEach((el) => {
            if (el !== container) {
              el.classList.remove('klartext-image-selected')
              el.querySelector('[data-testid="image-widget-controls"]')?.classList.add('hidden')
              el.querySelectorAll('[data-testid^="image-resize-handle-"]').forEach((h) =>
                h.classList.add('hidden')
              )
            }
          })
      }

      setImageSelected(nextSelected)

      if (nextSelected) {
        const onDocMouseDown = (ev: MouseEvent) => {
          if (!container.isConnected) {
            setImageSelected(false)
            return
          }
          const target = ev.target as Node | null
          if (!target || !container.contains(target)) {
            setImageSelected(false)
          }
        }
        const onDocKeyDown = (ev: KeyboardEvent) => {
          if (!container.isConnected) {
            setImageSelected(false)
            return
          }
          if (ev.key === 'Escape') {
            setImageSelected(false)
            return
          }
          // If typing anywhere outside the image's own caption input, deselect the image
          if (document.activeElement !== captionInput) {
            setImageSelected(false)
          }
        }
        window.addEventListener('mousedown', onDocMouseDown, true)
        window.addEventListener('keydown', onDocKeyDown, true)
        cleanupOutsideListeners = () => {
          window.removeEventListener('mousedown', onDocMouseDown, true)
          window.removeEventListener('keydown', onDocKeyDown, true)
        }
      }
    })

    img.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onOpenImageLightbox?.({
        src: resolvedSrc,
        caption: displayAlt,
        rawUrl: this.rawUrl
      })
    })

    container.appendChild(imgWrapper)

    if (displayAlt) {
      const figcaption = document.createElement('figcaption')
      figcaption.setAttribute('data-testid', 'image-caption-label')
      figcaption.className = 'mt-1.5 text-[11px] text-muted italic text-center'
      figcaption.textContent = displayAlt
      container.appendChild(figcaption)
    }

    outerRow.appendChild(container)
    return outerRow
  }
}

function renderTableCellInlineHtml(rawCell: string): string {
  const unescapedPipes = rawCell.replace(/\\\|/g, '|')
  // Split by inline code spans (`...` or ``...``) so code spans are never formatted as Markdown
  const parts = unescapedPipes.split(/(`+[^`]+`+)/g)
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) {
        const inner = part.replace(/^`+|`+$/g, '')
        const escaped = inner
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        return `<code class="cm-live-code px-1 py-0.5 rounded bg-secondary font-mono text-[11px]">${escaped}</code>`
      }
      let html = part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      // WikiLinks [[Target|Alias]]
      html = html.replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_m, target, alias) => {
        const label = (alias || target).trim()
        return `<span class="text-accent underline underline-offset-2 font-medium">${label}</span>`
      })
      // Markdown Links [label](url)
      html = html.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label) => {
        return `<span class="text-accent underline underline-offset-2 font-medium">${label}</span>`
      })
      // Bold + Italic (***text***, ___text___, **_text_**, _*text*_)
      html = html.replace(/(\*\*\*|___)([^*_\n]+)\1/g, '<strong><em>$2</em></strong>')
      html = html.replace(/\*\*_([^_\n]+)_\*\*/g, '<strong><em>$1</em></strong>')
      html = html.replace(/_\*\*([^*\n]+)\*\*_/g, '<em><strong>$1</strong></em>')
      // Bold (**text** or __text__)
      html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      // Italic (*text* or _text_)
      html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
      html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>')
      // Strikethrough ~~text~~
      html = html.replace(/~~([^~\n]+)~~/g, '<del class="cm-live-strike">$1</del>')
      // Highlight ==text==
      html = html.replace(/==([^=\n]+)==/g, '<mark class="cm-live-highlight">$1</mark>')
      return html
    })
    .join('')
}

class InlineTableWidget extends WidgetType {
  constructor(
    private rawTable: string,
    private targetPos: number
  ) {
    super()
  }

  eq(other: InlineTableWidget): boolean {
    return this.rawTable === other.rawTable && this.targetPos === other.targetPos
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'my-2 overflow-x-auto cursor-pointer'
    const lines = this.rawTable
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const rows = lines.map((line) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim())
    )

    const alignments: Array<'left' | 'center' | 'right'> = []
    if (rows.length > 1) {
      for (const sep of rows[1]) {
        const clean = sep.trim()
        if (clean.startsWith(':') && clean.endsWith(':')) {
          alignments.push('center')
        } else if (clean.endsWith(':')) {
          alignments.push('right')
        } else {
          alignments.push('left')
        }
      }
    }

    const table = document.createElement('table')
    table.className = 'w-full border-collapse text-xs'

    if (rows.length > 0) {
      const thead = document.createElement('thead')
      const tr = document.createElement('tr')
      rows[0].forEach((h, colIdx) => {
        const th = document.createElement('th')
        const align = alignments[colIdx] || 'left'
        th.className = `border border-subtle bg-secondary px-3 py-1.5 font-semibold text-${align}`
        th.innerHTML = renderTableCellInlineHtml(h)
        tr.appendChild(th)
      })
      thead.appendChild(tr)
      table.appendChild(thead)
    }

    if (rows.length > 2) {
      const tbody = document.createElement('tbody')
      for (let i = 2; i < rows.length; i++) {
        const tr = document.createElement('tr')
        rows[i].forEach((cell, colIdx) => {
          const td = document.createElement('td')
          const align = alignments[colIdx] || 'left'
          td.className = `border border-subtle px-3 py-1.5 text-${align}`
          td.innerHTML = renderTableCellInlineHtml(cell)
          tr.appendChild(td)
        })
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
    }

    wrapper.appendChild(table)
    wrapper.title = 'Click to edit Markdown table'
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })
    return wrapper
  }
}

class InlineCodeBlockWidget extends WidgetType {
  constructor(
    private lang: string,
    private code: string,
    private targetPos: number
  ) {
    super()
  }

  eq(other: InlineCodeBlockWidget): boolean {
    return (
      this.lang === other.lang &&
      this.code === other.code &&
      this.targetPos === other.targetPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className =
      'my-2 rounded-md border border-subtle bg-secondary/60 overflow-hidden cursor-pointer klartext-codeblock-widget'
    const header = document.createElement('div')
    header.className =
      'px-3 py-1 bg-secondary border-b border-subtle text-[10px] font-mono text-muted flex justify-between'
    header.textContent = this.lang || 'code'
    const pre = document.createElement('pre')
    pre.className = 'p-3 font-mono overflow-x-auto m-0 klartext-codeblock'
    const codeEl = document.createElement('code')
    codeEl.innerHTML = highlightCodeToHtml(this.code, this.lang)
    pre.appendChild(codeEl)
    wrapper.appendChild(header)
    wrapper.appendChild(pre)
    wrapper.title = 'Click to edit code block'
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })
    return wrapper
  }
}

class InlineMermaidBlockWidget extends WidgetType {
  constructor(
    private code: string,
    private targetPos: number,
    private blockFrom: number,
    private blockTo: number,
    private onOpenVisualBuilder?: (
      currentCode: string,
      blockFrom: number,
      blockTo: number
    ) => void
  ) {
    super()
  }

  eq(other: InlineMermaidBlockWidget): boolean {
    return (
      this.code === other.code &&
      this.targetPos === other.targetPos &&
      this.blockFrom === other.blockFrom &&
      this.blockTo === other.blockTo
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className =
      'my-2 p-3 rounded-md border border-subtle bg-panel flex flex-col items-center cursor-pointer'
    wrapper.setAttribute('data-testid', 'mermaid-widget')

    const header = document.createElement('div')
    header.className = 'w-full flex items-center justify-between text-[11px] text-muted mb-2'
    const labelSpan = document.createElement('span')
    labelSpan.className = 'font-medium'
    labelSpan.textContent = 'Mermaid Diagram'

    const btnGroup = document.createElement('div')
    btnGroup.className = 'flex items-center gap-1.5'

    if (this.onOpenVisualBuilder) {
      const visualBtn = document.createElement('button')
      visualBtn.type = 'button'
      visualBtn.className =
        'px-2 py-0.5 rounded bg-accent text-white font-medium hover:opacity-90'
      visualBtn.setAttribute('data-testid', 'mermaid-open-visual-builder')
      visualBtn.textContent = 'Visual Builder'
      visualBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.onOpenVisualBuilder?.(this.code, this.blockFrom, this.blockTo)
      })
      btnGroup.appendChild(visualBtn)
    }

    const toggleBtn = document.createElement('button')
    toggleBtn.type = 'button'
    toggleBtn.className =
      'px-2 py-0.5 rounded bg-secondary border border-subtle text-primary hover:border-accent'
    toggleBtn.setAttribute('data-testid', 'mermaid-toggle-source')
    toggleBtn.textContent = 'Edit Source'

    btnGroup.appendChild(toggleBtn)
    header.appendChild(labelSpan)
    header.appendChild(btnGroup)
    wrapper.appendChild(header)

    const sourceContainer = document.createElement('div')
    sourceContainer.className = 'w-full mb-2 hidden'
    const textarea = document.createElement('textarea')
    textarea.setAttribute('data-testid', 'mermaid-source-textarea')
    textarea.className =
      'w-full h-24 p-2 rounded bg-app border border-subtle font-mono text-xs text-primary'
    textarea.value = this.code
    sourceContainer.appendChild(textarea)
    wrapper.appendChild(sourceContainer)

    const body = document.createElement('div')
    body.className = 'w-full flex justify-center overflow-x-auto'
    wrapper.appendChild(body)

    const renderCode = (currentCode: string) => {
      const currentTheme =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
      const syncHit = getCachedMermaidSvgSync(currentCode, currentTheme)
      if (syncHit) {
        body.innerHTML = syncHit
        return
      }
      renderCachedMermaidSvg(currentCode, currentTheme)
        .then((sanitizedSvg) => {
          body.innerHTML = sanitizedSvg
        })
        .catch((err) => {
          const errDiv = document.createElement('div')
          errDiv.setAttribute('data-testid', 'mermaid-error-banner')
          errDiv.className = 'text-xs text-danger font-mono p-2 bg-secondary rounded w-full'
          errDiv.textContent = `Mermaid Syntax Diagnostic: ${err?.message || 'Invalid syntax'}`
          body.innerHTML = ''
          body.appendChild(errDiv)
        })
    }

    renderCode(this.code)

    toggleBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      sourceContainer.classList.toggle('hidden')
      if (!sourceContainer.classList.contains('hidden')) {
        textarea.focus()
      }
    })

    textarea.addEventListener('mousedown', (e) => {
      e.stopPropagation()
    })

    textarea.addEventListener('input', () => {
      renderCode(textarea.value)
    })

    body.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })
    return wrapper
  }
}

class ConflictActionLensWidget extends WidgetType {
  constructor(
    private hunkIndex: number,
    private currentLabel: string,
    private incomingLabel: string,
    private onResolve: (
      hunkIndex: number,
      resolution: 'current' | 'incoming' | 'both' | '3way'
    ) => void
  ) {
    super()
  }

  eq(other: ConflictActionLensWidget): boolean {
    return (
      this.hunkIndex === other.hunkIndex &&
      this.currentLabel === other.currentLabel &&
      this.incomingLabel === other.incomingLabel
    )
  }

  toDOM(): HTMLElement {
    const bar = document.createElement('div')
    bar.className =
      'flex items-center gap-2 py-1 px-2.5 my-1 text-xs rounded bg-secondary border border-subtle select-none'
    bar.setAttribute('data-testid', `conflict-lens-${this.hunkIndex}`)

    const title = document.createElement('span')
    title.className = 'font-semibold text-danger mr-2'
    title.textContent = `Merge Conflict #${this.hunkIndex + 1} (${this.currentLabel} vs ${this.incomingLabel})`
    bar.appendChild(title)

    const actions: Array<{
      label: string
      res: 'current' | 'incoming' | 'both' | '3way'
      testId: string
    }> = [
      { label: 'Accept Current (Local)', res: 'current', testId: 'btn-accept-current' },
      { label: 'Accept Incoming (Remote)', res: 'incoming', testId: 'btn-accept-incoming' },
      { label: 'Accept Both', res: 'both', testId: 'btn-accept-both' },
      { label: 'Open 3-Way Diff View', res: '3way', testId: 'btn-open-3way' }
    ]

    for (const act of actions) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className =
        'px-2 py-0.5 rounded bg-panel border border-subtle hover:border-accent text-primary font-medium transition-colors'
      btn.textContent = act.label
      btn.setAttribute('data-testid', `${act.testId}-${this.hunkIndex}`)
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.onResolve(this.hunkIndex, act.res)
      })
      bar.appendChild(btn)
    }

    return bar
  }
}

import {
  extractHeadingSectionFromMarkdown,
  type WorkspaceDocEntry
} from '../../../shared/markdown/knowledge-features'

class InlineTransclusionWidget extends WidgetType {
  constructor(
    private rawTarget: string,
    private alias: string,
    private excerptText: string,
    private resolvedTitle: string,
    private onNavigate: (target: string, isWiki: boolean) => void,
    private targetPos: number
  ) {
    super()
  }

  eq(other: InlineTransclusionWidget): boolean {
    return (
      this.rawTarget === other.rawTarget &&
      this.alias === other.alias &&
      this.excerptText === other.excerptText &&
      this.targetPos === other.targetPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const card = document.createElement('div')
    card.className =
      'my-2 p-3 rounded-md border border-subtle border-l-4 border-l-accent bg-secondary/40 text-xs flex flex-col gap-1.5'
    card.setAttribute('data-testid', 'inline-transclusion-card')

    const header = document.createElement('div')
    header.className = 'flex items-center justify-between gap-2 pb-1 border-b border-subtle/60'

    const link = document.createElement('a')
    link.href = this.rawTarget
    link.setAttribute('data-wikilink', encodeURIComponent(this.rawTarget))
    link.className = 'font-semibold text-accent hover:underline cursor-pointer flex items-center gap-1'
    link.textContent = `📄 ${this.alias || this.resolvedTitle}`
    link.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onNavigate(this.rawTarget.split('#')[0].trim(), true)
    })

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'text-[10px] px-1.5 py-0.5 rounded bg-panel border border-subtle text-muted hover:text-primary'
    editBtn.textContent = 'Edit ![[]]'
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ selection: { anchor: this.targetPos } })
      view.focus()
    })

    header.appendChild(link)
    header.appendChild(editBtn)
    card.appendChild(header)

    const body = document.createElement('div')
    body.className = 'text-primary whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-sans'
    body.textContent = this.excerptText
    card.appendChild(body)

    return card
  }
}

class InlineCalloutHeaderWidget extends WidgetType {
  constructor(
    private readonly kind: string,
    private readonly customTitle: string,
    private readonly editPos: number
  ) {
    super()
  }

  eq(other: InlineCalloutHeaderWidget): boolean {
    return (
      this.kind === other.kind &&
      this.customTitle === other.customTitle &&
      this.editPos === other.editPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    const upper = this.kind.toUpperCase()
    const iconMap: Record<string, string> = {
      NOTE: 'ℹ️',
      TIP: '💡',
      IMPORTANT: '🟣',
      WARNING: '⚠️',
      CAUTION: '🛑'
    }
    const badge = iconMap[upper] || 'ℹ️'
    span.className = `inline-flex items-center gap-1.5 font-semibold cursor-pointer cm-live-callout-badge cm-live-callout-badge-${upper.toLowerCase()}`
    span.setAttribute('data-testid', `inline-callout-badge-${upper.toLowerCase()}`)
    span.textContent = this.customTitle ? `${badge} ${upper} — ${this.customTitle}` : `${badge} ${upper}`
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.editPos } })
      view.focus()
    })
    return span
  }
}

class InlineDetailsBlockWidget extends WidgetType {
  constructor(
    private readonly summaryText: string,
    private readonly bodyText: string,
    private readonly editPos: number
  ) {
    super()
  }

  eq(other: InlineDetailsBlockWidget): boolean {
    return (
      this.summaryText === other.summaryText &&
      this.bodyText === other.bodyText &&
      this.editPos === other.editPos
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const details = document.createElement('details')
    details.open = true
    details.className = 'my-2 rounded-md border border-subtle bg-secondary/40 px-3 py-2 text-xs'
    details.setAttribute('data-testid', 'inline-details-widget')

    const summary = document.createElement('summary')
    summary.className = 'font-semibold text-primary cursor-pointer select-none flex items-center justify-between gap-2'

    const titleSpan = document.createElement('span')
    titleSpan.textContent = this.summaryText || 'Details'

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] text-muted hover:text-primary'
    editBtn.textContent = 'Edit <details>'
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ selection: { anchor: this.editPos } })
      view.focus()
    })

    summary.appendChild(titleSpan)
    summary.appendChild(editBtn)
    details.appendChild(summary)

    const body = document.createElement('div')
    body.className = 'mt-2 pt-2 border-t border-subtle/60 text-primary whitespace-pre-wrap leading-relaxed'
    body.textContent = this.bodyText
    details.appendChild(body)

    return details
  }
}

class InlineTocWidget extends WidgetType {
  constructor(
    private readonly headings: Array<{ level: number; text: string; lineFrom: number }>,
    private readonly editPos: number
  ) {
    super()
  }

  eq(other: InlineTocWidget): boolean {
    return (
      this.editPos === other.editPos &&
      JSON.stringify(this.headings) === JSON.stringify(other.headings)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const nav = document.createElement('nav')
    nav.className = 'my-2 p-3 rounded-md border border-subtle bg-secondary/40 text-xs'
    nav.setAttribute('data-testid', 'inline-toc-widget')

    const header = document.createElement('div')
    header.className = 'flex items-center justify-between pb-1.5 mb-1.5 border-b border-subtle'

    const title = document.createElement('span')
    title.className = 'text-[10px] font-bold uppercase tracking-wider text-muted'
    title.textContent = 'Table of Contents'

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'px-1.5 py-0.5 rounded bg-panel border border-subtle text-[10px] text-muted hover:text-primary'
    editBtn.textContent = 'Edit [[_TOC_]]'
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ selection: { anchor: this.editPos } })
      view.focus()
    })

    header.appendChild(title)
    header.appendChild(editBtn)
    nav.appendChild(header)

    if (this.headings.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'text-muted italic'
      empty.textContent = 'Add headings (#, ##, ###) to populate Table of Contents'
      nav.appendChild(empty)
      return nav
    }

    const ul = document.createElement('ul')
    ul.className = 'space-y-1'
    for (const h of this.headings) {
      const li = document.createElement('li')
      li.style.paddingLeft = `${Math.max(0, h.level - 1) * 12}px`
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'text-left text-accent hover:underline truncate max-w-full'
      btn.textContent = h.text
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        view.dispatch({
          selection: { anchor: h.lineFrom },
          effects: EditorView.scrollIntoView(h.lineFrom, { y: 'center' })
        })
        view.focus()
      })
      li.appendChild(btn)
      ul.appendChild(li)
    }
    nav.appendChild(ul)
    return nav
  }
}

class InlineHorizontalRuleWidget extends WidgetType {
  constructor(private readonly editPos: number) {
    super()
  }

  eq(other: InlineHorizontalRuleWidget): boolean {
    return this.editPos === other.editPos
  }

  toDOM(view: EditorView): HTMLElement {
    const hr = document.createElement('hr')
    hr.className = 'cm-live-hr my-3 border-t border-subtle cursor-pointer'
    hr.setAttribute('data-testid', 'inline-hr-widget')
    hr.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.editPos } })
      view.focus()
    })
    return hr
  }
}

export interface LivePreviewOptions {
  inlineRichMode: boolean
  rootId: string
  getWorkspaceDocuments?: () => WorkspaceDocEntry[]
  onResolveConflict: (
    hunkIndex: number,
    resolution: 'current' | 'incoming' | 'both' | '3way'
  ) => void
  onNavigateLink: (target: string, isWiki: boolean) => void
  onOpenExcalidraw: (drawingRelPath: string) => void
  onOpenMermaidBuilder?: (currentCode: string, blockFrom: number, blockTo: number) => void
  onOpenImageLightbox?: (info: { src: string; caption: string; rawUrl: string }) => void
}

function buildLiveDecorations(
  state: EditorView['state'],
  opts: LivePreviewOptions,
  hasInteracted = false
): DecorationSet {
  const decos: Array<{ from: number; to: number; value: Decoration }> = []
  const doc = state.doc
  const selection = state.selection.main
  const activeStartLine = doc.lineAt(selection.from).number
  const activeEndLine = doc.lineAt(selection.to).number

  const isRangeActive = (startLine: number, endLine: number) =>
    hasInteracted && activeStartLine <= endLine && activeEndLine >= startLine

  // Pre-collect document headings so [[_TOC_]] can render an interactive Table of Contents widget
  const docHeadings: Array<{ level: number; text: string; lineFrom: number }> = []
  if (opts.inlineRichMode) {
    let inFence = false
    for (let i = 1; i <= doc.lines; i++) {
      const l = doc.line(i)
      if (/^\s*```/.test(l.text)) {
        inFence = !inFence
        continue
      }
      if (inFence) continue
      const hm = l.text.match(/^(#{1,6})\s+(.+)$/)
      if (hm) {
        docHeadings.push({
          level: hm[1].length,
          text: hm[2].replace(/[*_`~]/g, '').trim(),
          lineFrom: l.from
        })
      }
    }
  }

  let conflictHunkIndex = 0
  let conflictSection: 'none' | 'current' | 'incoming' = 'none'

  let lineNum = 1
  while (lineNum <= doc.lines) {
    const line = doc.line(lineNum)
    const text = line.text

    // 1. Always highlight Git Merge Conflict blocks (<<<<<<< HEAD, =======, >>>>>>>)
    if (text.startsWith('<<<<<<<')) {
      const currentLabel = text.replace(/^<{7}\s*/, '').trim() || 'HEAD'
      const idx = conflictHunkIndex++
      conflictSection = 'current'
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.widget({
          widget: new ConflictActionLensWidget(
            idx,
            currentLabel,
            'incoming',
            opts.onResolveConflict
          ),
          side: -1
        })
      })
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-conflict-marker-current' })
      })
      lineNum++
      continue
    }
    if (text.startsWith('=======')) {
      conflictSection = 'incoming'
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-conflict-marker-sep' })
      })
      lineNum++
      continue
    }
    if (text.startsWith('>>>>>>>')) {
      conflictSection = 'none'
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-conflict-marker-incoming' })
      })
      lineNum++
      continue
    }
    if (conflictSection === 'current') {
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-conflict-marker-current' })
      })
    } else if (conflictSection === 'incoming') {
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-conflict-marker-incoming' })
      })
    }

    if (!opts.inlineRichMode) {
      lineNum++
      continue
    }

    // 2. Multi-line YAML Frontmatter at top of document (line 1 === '---')
    if (lineNum === 1 && text.trim() === '---') {
      let closeLine = -1
      for (let k = 2; k <= Math.min(doc.lines, 40); k++) {
        if (doc.line(k).text.trim() === '---') {
          closeLine = k
          break
        }
      }
      if (closeLine > 1) {
        if (!isRangeActive(1, closeLine)) {
          for (let k = 1; k <= closeLine; k++) {
            const fl = doc.line(k)
            decos.push({
              from: fl.from,
              to: fl.from,
              value: Decoration.line({ class: 'cm-live-collapsed-line' })
            })
            if (fl.to > fl.from) {
              decos.push({ from: fl.from, to: fl.to, value: Decoration.replace({}) })
            }
          }
        }
        lineNum = closeLine + 1
        continue
      }
    }

    // 2b. Multi-line Notion-style Bookmark Card block (:::bookmark [url] ... :::)
    const bookmarkHeaderMatch = text.match(/^\s*:::bookmark(?:\s+(https?:\/\/\S+))?\s*$/i)
    if (bookmarkHeaderMatch) {
      const startL = lineNum
      let endL = startL + 1
      const props: Record<string, string> = {}
      if (bookmarkHeaderMatch[1]) {
        props.url = bookmarkHeaderMatch[1].trim()
      }
      while (endL <= doc.lines && !/^\s*:::\s*$/.test(doc.line(endL).text)) {
        const kv = doc.line(endL).text.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
        if (kv) {
          props[kv[1].trim().toLowerCase()] = kv[2].trim()
        }
        endL++
      }
      if (endL <= doc.lines) {
        if (!isRangeActive(startL, endL)) {
          const firstLine = doc.line(startL)
          const url = props.url || 'https://example.com'
          let domain = props.domain || ''
          if (!domain && url.startsWith('http')) {
            try {
              domain = new URL(url).hostname.replace(/^www\./, '')
            } catch {
              domain = ''
            }
          }
          decos.push({
            from: firstLine.from,
            to: firstLine.to,
            value: Decoration.replace({
              widget: new InlineBookmarkCardWidget(
                props.title || domain || url,
                url,
                domain,
                props.description || '',
                firstLine.from,
                opts.onNavigateLink
              )
            })
          })
          for (let k = startL + 1; k <= endL; k++) {
            const bl = doc.line(k)
            decos.push({
              from: bl.from,
              to: bl.from,
              value: Decoration.line({ class: 'cm-live-collapsed-line' })
            })
            if (bl.to > bl.from) {
              decos.push({ from: bl.from, to: bl.to, value: Decoration.replace({}) })
            }
          }
        }
        lineNum = endL + 1
        continue
      }
    }

    // 2c. Multi-line Collapsible Details Block (<details> ... </details>)
    if (/^\s*<details(?:\s+open)?>\s*$/i.test(text)) {
      const startL = lineNum
      let endL = startL + 1
      let summaryText = 'Click to expand'
      const bodyLines: string[] = []
      while (endL <= doc.lines && !/^\s*<\/details>\s*$/i.test(doc.line(endL).text)) {
        const curLineText = doc.line(endL).text
        const sumMatch = curLineText.match(/^\s*<summary>(.*)<\/summary>\s*$/i)
        if (sumMatch) {
          summaryText = sumMatch[1].trim()
        } else {
          bodyLines.push(curLineText)
        }
        endL++
      }
      if (endL <= doc.lines) {
        if (!isRangeActive(startL, endL)) {
          const firstLine = doc.line(startL)
          decos.push({
            from: firstLine.from,
            to: firstLine.to,
            value: Decoration.replace({
              widget: new InlineDetailsBlockWidget(
                summaryText,
                bodyLines.join('\n').trim(),
                firstLine.from
              )
            })
          })
          for (let k = startL + 1; k <= endL; k++) {
            const dl = doc.line(k)
            decos.push({
              from: dl.from,
              to: dl.from,
              value: Decoration.line({ class: 'cm-live-collapsed-line' })
            })
            if (dl.to > dl.from) {
              decos.push({ from: dl.from, to: dl.to, value: Decoration.replace({}) })
            }
          }
        }
        lineNum = endL + 1
        continue
      }
    }

    // 3. Multi-line Fenced Code Block or Mermaid Block (```lang ... ``` or ````md ... ````)
    const fenceOpen = text.match(/^\s*(`{3,})([\w-]*)\s*$/)
    if (fenceOpen) {
      const fenceTicks = fenceOpen[1]
      const lang = (fenceOpen[2] || '').toLowerCase()
      const closeFenceRegex = new RegExp(`^\\s*\`{${fenceTicks.length},}\\s*$`)
      const startL = lineNum
      let endL = startL + 1
      const innerLines: string[] = []
      while (endL <= doc.lines && !closeFenceRegex.test(doc.line(endL).text)) {
        innerLines.push(doc.line(endL).text)
        endL++
      }
      if (endL <= doc.lines) {
        if (!isRangeActive(startL, endL)) {
          const innerCode = innerLines.join('\n')
          const firstLine = doc.line(startL)
          const lastLine = doc.line(endL)
          const widget =
            lang === 'mermaid' && fenceTicks.length === 3
              ? new InlineMermaidBlockWidget(
                  innerCode,
                  firstLine.from,
                  firstLine.from,
                  lastLine.to,
                  opts.onOpenMermaidBuilder
                )
              : new InlineCodeBlockWidget(lang, innerCode, firstLine.from)
          decos.push({
            from: firstLine.from,
            to: firstLine.to,
            value: Decoration.replace({ widget })
          })
          for (let k = startL + 1; k <= endL; k++) {
            const cl = doc.line(k)
            decos.push({
              from: cl.from,
              to: cl.from,
              value: Decoration.line({ class: 'cm-live-collapsed-line' })
            })
            if (cl.to > cl.from) {
              decos.push({ from: cl.from, to: cl.to, value: Decoration.replace({}) })
            }
          }
        }
        lineNum = endL + 1
        continue
      }
    }

    // 4. Multi-line Display Math Block ($$ ... $$)
    if (text.trim() === '$$') {
      const startL = lineNum
      let endL = startL + 1
      const latexLines: string[] = []
      while (endL <= doc.lines && doc.line(endL).text.trim() !== '$$') {
        latexLines.push(doc.line(endL).text)
        endL++
      }
      if (endL <= doc.lines) {
        if (!isRangeActive(startL, endL)) {
          const firstLine = doc.line(startL)
          decos.push({
            from: firstLine.from,
            to: firstLine.to,
            value: Decoration.replace({
              widget: new InlineMathWidget(latexLines.join('\n'), true, firstLine.from)
            })
          })
          for (let k = startL + 1; k <= endL; k++) {
            const ml = doc.line(k)
            decos.push({
              from: ml.from,
              to: ml.from,
              value: Decoration.line({ class: 'cm-live-collapsed-line' })
            })
            if (ml.to > ml.from) {
              decos.push({ from: ml.from, to: ml.to, value: Decoration.replace({}) })
            }
          }
        }
        lineNum = endL + 1
        continue
      }
    }

    // 5. Multi-line GFM Table Block (pipe-wrapped or pipe-separated with a separator second line)
    const isTableStart =
      lineNum + 1 <= doc.lines &&
      text.includes('|') &&
      /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(doc.line(lineNum + 1).text)
    if (isTableStart) {
      const startL = lineNum
      let endL = startL
      const tableLines: string[] = []
      while (
        endL <= doc.lines &&
        doc.line(endL).text.trim().length > 0 &&
        doc.line(endL).text.includes('|')
      ) {
        tableLines.push(doc.line(endL).text)
        endL++
      }
      const lastTableLine = endL - 1
      if (!isRangeActive(startL, lastTableLine)) {
        const firstLine = doc.line(startL)
        decos.push({
          from: firstLine.from,
          to: firstLine.to,
          value: Decoration.replace({
            widget: new InlineTableWidget(tableLines.join('\n'), firstLine.from)
          })
        })
        for (let k = startL + 1; k <= lastTableLine; k++) {
          const tl = doc.line(k)
          decos.push({
            from: tl.from,
            to: tl.from,
            value: Decoration.line({ class: 'cm-live-collapsed-line' })
          })
          if (tl.to > tl.from) {
            decos.push({ from: tl.from, to: tl.to, value: Decoration.replace({}) })
          }
        }
      }
      lineNum = lastTableLine + 1
      continue
    }

    const isActiveLine = isRangeActive(lineNum, lineNum)

    // 5b. Standalone Table of Contents token ([[_TOC_]] or [TOC])
    if (/^\s*(?:\[\[_TOC_\]\]|\[TOC\])\s*$/i.test(text)) {
      if (!isActiveLine) {
        decos.push({
          from: line.from,
          to: line.to,
          value: Decoration.replace({
            widget: new InlineTocWidget(docHeadings, line.from)
          })
        })
      }
      lineNum++
      continue
    }

    // 5c. Standalone Horizontal Rule (---, ***, ___, - - -, * * *, _ _ _)
    if (/^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})\s*$/.test(text)) {
      if (!isActiveLine) {
        decos.push({
          from: line.from,
          to: line.to,
          value: Decoration.replace({
            widget: new InlineHorizontalRuleWidget(line.from)
          })
        })
      }
      lineNum++
      continue
    }

    // 6. Single-line Headings (# through ######)
    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const hashes = headingMatch[1]
      const level = Math.min(6, Math.max(1, hashes.length))
      const cls = `cm-live-h${level}`
      decos.push({ from: line.from, to: line.from, value: Decoration.line({ class: cls }) })
      if (!isActiveLine) {
        decos.push({
          from: line.from,
          to: line.from + hashes.length + 1,
          value: Decoration.replace({})
        })
      }
    }

    // 7. Callouts / Blockquotes (> [!NOTE] Title, > [!faq]- Title, or > quote)
    const calloutHeader = text.match(/^>\s*\[!([a-zA-Z0-9_-]+)\]([+-])?\s*(.*)$/i)
    if (calloutHeader) {
      const kind = calloutHeader[1].toUpperCase()
      const customTitle = (calloutHeader[3] || '').trim()
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({
          class: `cm-live-callout-line cm-live-callout-${kind.toLowerCase()} font-semibold`
        })
      })
      if (!isActiveLine) {
        decos.push({
          from: line.from,
          to: line.to,
          value: Decoration.replace({
            widget: new InlineCalloutHeaderWidget(kind, customTitle, line.from)
          })
        })
      }
    } else if (/^>\s?/.test(text)) {
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-live-callout-line' })
      })
      if (!isActiveLine) {
        const prefixLen = text.startsWith('> ') ? 2 : 1
        decos.push({
          from: line.from,
          to: line.from + prefixLen,
          value: Decoration.replace({})
        })
      }
    }

    // 7b. Definition List item (: Definition)
    if (/^:\s+(.+)$/.test(text)) {
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-live-def-dd' })
      })
    }

    // 8. Task list checkboxes (- [ ] or - [x] or - [?] or - [-])
    const taskMatch = text.match(/^(\s*[-*+]\s+)(\[[ xX?-]\])/)
    if (taskMatch && !isActiveLine) {
      const bracketStart = line.from + taskMatch[1].length
      const isChecked = taskMatch[2] !== '[ ]'
      decos.push({
        from: bracketStart,
        to: bracketStart + 3,
        value: Decoration.replace({
          widget: new TaskCheckboxWidget(isChecked, bracketStart)
        })
      })
    }

    // 13. Pre-scan Inline Code (`code` or ``code with ` inside``) so we never apply Markdown formatting inside inline code!
    const codeIntervals: Array<[number, number]> = []
    const codeRegex = /(?<!\\)(`+)([^`\n]+?)\1/g
    let codeMatch: RegExpExecArray | null
    while ((codeMatch = codeRegex.exec(text)) !== null) {
      const ticksLen = codeMatch[1].length
      const relStart = codeMatch.index
      const relEnd = relStart + codeMatch[0].length
      codeIntervals.push([relStart, relEnd])
      const start = line.from + relStart
      const end = line.from + relEnd
      if (!isActiveLine) {
        decos.push({ from: start, to: start + ticksLen, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + ticksLen,
        to: end - ticksLen,
        value: Decoration.mark({ class: 'cm-live-code' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - ticksLen, to: end, value: Decoration.replace({}) })
      }
    }

    const isInCodeSpan = (relStart: number, relEnd: number) =>
      codeIntervals.some(([cs, ce]) => relStart < ce && relEnd > cs)

    // 9. Standalone Image or Embedded Excalidraw Drawing (![alt](url))
    if (!isActiveLine) {
      const imgRegex = /(?<!\\)!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
      let imgMatch: RegExpExecArray | null
      while ((imgMatch = imgRegex.exec(text)) !== null) {
        if (isInCodeSpan(imgMatch.index, imgMatch.index + imgMatch[0].length)) continue
        const start = line.from + imgMatch.index
        const end = start + imgMatch[0].length
        const alt = imgMatch[1]
        const rawUrl = imgMatch[2]
        const isExcalidraw =
          rawUrl.endsWith('.excalidraw.svg') || rawUrl.endsWith('.excalidraw')
        decos.push({
          from: start,
          to: end,
          value: Decoration.replace({
            widget: new InlineImageOrDrawingWidget(
              alt,
              rawUrl,
              opts.rootId,
              isExcalidraw,
              start,
              end,
              opts.onOpenExcalidraw,
              opts.onOpenImageLightbox
            )
          })
        })
      }

      // 9b. Inline Footnote References [^1] (excluding footnote definition lines [^1]: ...)
      const fnRegex = /(?<!\\)\[\^([a-zA-Z0-9_-]+)\](?!:)/g
      let fnMatch: RegExpExecArray | null
      while ((fnMatch = fnRegex.exec(text)) !== null) {
        if (isInCodeSpan(fnMatch.index, fnMatch.index + fnMatch[0].length)) continue
        const start = line.from + fnMatch.index
        const end = start + fnMatch[0].length
        const fnId = fnMatch[1]
        decos.push({
          from: start,
          to: end,
          value: Decoration.replace({
            widget: new InlineFootnoteRefWidget(fnId, start)
          })
        })
      }

      // 10a. Embedded Note Transclusion ![[Target#Heading|Alias]]
      const transcludeRegex = /(?<!\\)!\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g
      let transcludeMatch: RegExpExecArray | null
      while ((transcludeMatch = transcludeRegex.exec(text)) !== null) {
        if (isInCodeSpan(transcludeMatch.index, transcludeMatch.index + transcludeMatch[0].length))
          continue
        const start = line.from + transcludeMatch.index
        const end = start + transcludeMatch[0].length
        const rawTarget = transcludeMatch[1].trim()
        const alias = (transcludeMatch[2] || '').trim()
        if (!/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|pdf)$/i.test(rawTarget)) {
          const hashIdx = rawTarget.indexOf('#')
          const targetNote = (hashIdx !== -1 ? rawTarget.slice(0, hashIdx) : rawTarget).trim()
          const targetHeading = hashIdx !== -1 ? rawTarget.slice(hashIdx + 1).trim() : ''
          const docs = opts.getWorkspaceDocuments?.() || []
          const normTarget = targetNote.toLowerCase().replace(/\.(md|markdown)$/i, '')
          const matchedDoc = docs.find((d) => {
            const base =
              d.relativePath
                .split('/')
                .pop()
                ?.toLowerCase()
                .replace(/\.(md|markdown)$/i, '') || ''
            const relNoExt = d.relativePath.toLowerCase().replace(/\.(md|markdown)$/i, '')
            return (
              base === normTarget ||
              relNoExt === normTarget ||
              d.title.toLowerCase() === normTarget
            )
          })
          const resolvedTitle = matchedDoc
            ? `${matchedDoc.title}${targetHeading ? ` › ${targetHeading}` : ''}`
            : rawTarget
          let excerpt = matchedDoc
            ? matchedDoc.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
            : `Embedded note "${targetNote}" not found in workspace`
          if (matchedDoc && targetHeading) {
            const section = extractHeadingSectionFromMarkdown(matchedDoc.content, targetHeading)
            if (section) excerpt = section
          }
          decos.push({
            from: start,
            to: end,
            value: Decoration.replace({
              widget: new InlineTransclusionWidget(
                rawTarget,
                alias,
                excerpt.slice(0, 600),
                resolvedTitle,
                opts.onNavigateLink,
                start
              )
            })
          })
        }
      }

      // 10b. WikiLinks [[Target|Alias]] (ignoring transclusions starting with ! and _TOC_)
      const wikiRegex = /(?<![!\\])\[\[(?!_TOC_\]\])([^[\]|]+)(?:\|([^[\]]+))?\]\]/g
      let wikiMatch: RegExpExecArray | null
      while ((wikiMatch = wikiRegex.exec(text)) !== null) {
        if (isInCodeSpan(wikiMatch.index, wikiMatch.index + wikiMatch[0].length)) continue
        const start = line.from + wikiMatch.index
        const end = start + wikiMatch[0].length
        const target = wikiMatch[1].trim()
        const label = (wikiMatch[2] || target).trim()
        decos.push({
          from: start,
          to: end,
          value: Decoration.replace({
            widget: new InlineLinkWidget(label, target, true, opts.onNavigateLink)
          })
        })
      }

      // 11. Standard Markdown links [label](url) (ignoring images starting with !)
      const linkRegex = /(?<![!\\])\[([^\]]+)\]\((?:<([^>\n]+)>|([^)\s]+))\)/g
      let linkMatch: RegExpExecArray | null
      while ((linkMatch = linkRegex.exec(text)) !== null) {
        if (isInCodeSpan(linkMatch.index, linkMatch.index + linkMatch[0].length)) continue
        const start = line.from + linkMatch.index
        const end = start + linkMatch[0].length
        const href = linkMatch[2] || linkMatch[3] || '#'
        decos.push({
          from: start,
          to: end,
          value: Decoration.replace({
            widget: new InlineLinkWidget(
              linkMatch[1],
              href,
              false,
              opts.onNavigateLink
            )
          })
        })
      }

      // 12. Inline Math ($...$)
      const mathRegex = /(?<![\\$])\$([^$\n]+)\$(?!\$)/g
      let mathMatch: RegExpExecArray | null
      while ((mathMatch = mathRegex.exec(text)) !== null) {
        if (isInCodeSpan(mathMatch.index, mathMatch.index + mathMatch[0].length)) continue
        const start = line.from + mathMatch.index
        const end = start + mathMatch[0].length
        decos.push({
          from: start,
          to: end,
          value: Decoration.replace({
            widget: new InlineMathWidget(mathMatch[1], false, start)
          })
        })
      }
    }

    // 14a. Inline ***Bold & Italic*** or ___Bold & Italic___ or **_Bold & Italic_**
    const boldItalicRegex = /(?<!\\)(\*\*\*|___|\*\*_|_\*\*)([^*_\n]+)(?:\*\*\*|___|_\*\*|\*\*_)/g
    let boldItalicMatch: RegExpExecArray | null
    while ((boldItalicMatch = boldItalicRegex.exec(text)) !== null) {
      if (isInCodeSpan(boldItalicMatch.index, boldItalicMatch.index + boldItalicMatch[0].length))
        continue
      const start = line.from + boldItalicMatch.index
      const end = start + boldItalicMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 3, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 3,
        to: end - 3,
        value: Decoration.mark({ class: 'cm-live-bold-italic' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 3, to: end, value: Decoration.replace({}) })
      }
    }

    // 14b. Inline **Bold** or __Bold__ (avoiding ***bold-italic*** and escaped \*\*)
    const boldRegex = /(?<![\\*_])(\*\*|__)(?![*_])([^\n]+?)(?<![\\*_])\1(?![*_])/g
    let boldMatch: RegExpExecArray | null
    while ((boldMatch = boldRegex.exec(text)) !== null) {
      if (isInCodeSpan(boldMatch.index, boldMatch.index + boldMatch[0].length)) continue
      const start = line.from + boldMatch.index
      const end = start + boldMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 2, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 2,
        to: end - 2,
        value: Decoration.mark({ class: 'cm-live-bold' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 2, to: end, value: Decoration.replace({}) })
      }
    }

    // 15. Inline ~~Strikethrough~~
    const strikeRegex = /(?<!\\)~~([^~\n]+)~~/g
    let strikeMatch: RegExpExecArray | null
    while ((strikeMatch = strikeRegex.exec(text)) !== null) {
      if (isInCodeSpan(strikeMatch.index, strikeMatch.index + strikeMatch[0].length)) continue
      const start = line.from + strikeMatch.index
      const end = start + strikeMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 2, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 2,
        to: end - 2,
        value: Decoration.mark({ class: 'cm-live-strike' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 2, to: end, value: Decoration.replace({}) })
      }
    }

    // 16. Inline *Italic* or _Italic_ (avoiding **bold**, __bold__, and escaped \*)
    const italicRegex = /(?<![\\*_])(\*|_)(?![*_])([^*\n]+?)(?<![\\*_])\1(?![*_])/g
    let italicMatch: RegExpExecArray | null
    while ((italicMatch = italicRegex.exec(text)) !== null) {
      if (isInCodeSpan(italicMatch.index, italicMatch.index + italicMatch[0].length)) continue
      const start = line.from + italicMatch.index
      const end = start + italicMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 1, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 1,
        to: end - 1,
        value: Decoration.mark({ class: 'cm-live-italic' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 1, to: end, value: Decoration.replace({}) })
      }
    }

    // 17. Inline ==Highlight==
    const highlightRegex = /(?<!\\)==([^=\n]+)==/g
    let highlightMatch: RegExpExecArray | null
    while ((highlightMatch = highlightRegex.exec(text)) !== null) {
      if (isInCodeSpan(highlightMatch.index, highlightMatch.index + highlightMatch[0].length))
        continue
      const start = line.from + highlightMatch.index
      const end = start + highlightMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 2, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 2,
        to: end - 2,
        value: Decoration.mark({ class: 'cm-live-highlight' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 2, to: end, value: Decoration.replace({}) })
      }
    }

    // 17b. Inline <u>Underline</u>
    const underlineRegex = /<u>([^<\n]+)<\/u>/gi
    let underlineMatch: RegExpExecArray | null
    while ((underlineMatch = underlineRegex.exec(text)) !== null) {
      if (isInCodeSpan(underlineMatch.index, underlineMatch.index + underlineMatch[0].length))
        continue
      const start = line.from + underlineMatch.index
      const end = start + underlineMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 3, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 3,
        to: end - 4,
        value: Decoration.mark({ class: 'cm-live-underline' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 4, to: end, value: Decoration.replace({}) })
      }
    }

    // 17c. Inline <sup>Superscript</sup>
    const supRegex = /<sup>([^<\n]+)<\/sup>/gi
    let supMatch: RegExpExecArray | null
    while ((supMatch = supRegex.exec(text)) !== null) {
      if (isInCodeSpan(supMatch.index, supMatch.index + supMatch[0].length)) continue
      const start = line.from + supMatch.index
      const end = start + supMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 5, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 5,
        to: end - 6,
        value: Decoration.mark({ class: 'cm-live-sup' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 6, to: end, value: Decoration.replace({}) })
      }
    }

    // 17d. Inline <sub>Subscript</sub>
    const subRegex = /<sub>([^<\n]+)<\/sub>/gi
    let subMatch: RegExpExecArray | null
    while ((subMatch = subRegex.exec(text)) !== null) {
      if (isInCodeSpan(subMatch.index, subMatch.index + subMatch[0].length)) continue
      const start = line.from + subMatch.index
      const end = start + subMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 5, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 5,
        to: end - 6,
        value: Decoration.mark({ class: 'cm-live-sub' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 6, to: end, value: Decoration.replace({}) })
      }
    }

    // 18. Inline >!Spoiler!<
    const spoilerRegex = />!([^!\n]+)!</g
    let spoilerMatch: RegExpExecArray | null
    while ((spoilerMatch = spoilerRegex.exec(text)) !== null) {
      if (isInCodeSpan(spoilerMatch.index, spoilerMatch.index + spoilerMatch[0].length)) continue
      const start = line.from + spoilerMatch.index
      const end = start + spoilerMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 2, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 2,
        to: end - 2,
        value: Decoration.mark({ class: 'cm-live-spoiler' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 2, to: end, value: Decoration.replace({}) })
      }
    }

    // 19. Inline <kbd>Key</kbd>
    const kbdRegex = /<kbd>([^<\n]+)<\/kbd>/gi
    let kbdMatch: RegExpExecArray | null
    while ((kbdMatch = kbdRegex.exec(text)) !== null) {
      if (isInCodeSpan(kbdMatch.index, kbdMatch.index + kbdMatch[0].length)) continue
      const start = line.from + kbdMatch.index
      const end = start + kbdMatch[0].length
      if (!isActiveLine) {
        decos.push({ from: start, to: start + 5, value: Decoration.replace({}) })
      }
      decos.push({
        from: start + 5,
        to: end - 6,
        value: Decoration.mark({ class: 'cm-live-kbd' })
      })
      if (!isActiveLine) {
        decos.push({ from: end - 6, to: end, value: Decoration.replace({}) })
      }
    }

    // 20. Inline Untitled UI Icon (:icon[IconName]:)
    if (!isActiveLine) {
      const iconRegex = /:icon\[([a-zA-Z0-9_-]+)\]:/g
      let iconMatch: RegExpExecArray | null
      while ((iconMatch = iconRegex.exec(text)) !== null) {
        if (isInCodeSpan(iconMatch.index, iconMatch.index + iconMatch[0].length)) continue
        const start = line.from + iconMatch.index
        const end = start + iconMatch[0].length
        const iconName = iconMatch[1]
        const svgHtml = renderUntitledIconToSvgHtml(iconName, 16)
        if (svgHtml) {
          decos.push({
            from: start,
            to: end,
            value: Decoration.replace({
              widget: new InlineUntitledIconWidget(iconName, svgHtml, start)
            })
          })
        }
      }
    }

    lineNum++
  }

  return Decoration.set(decos, true)
}

export function createLivePreviewExtension(opts: LivePreviewOptions) {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildLiveDecorations(state, opts, false)
    },
    update(deco, tr) {
      if (tr.docChanged || tr.selection) {
        return buildLiveDecorations(tr.state, opts, true)
      }
      return deco
    },
    provide: (f) => EditorView.decorations.from(f)
  })

  return [field]
}

export type MarkdownFormatCommand =
  | 'bold'
  | 'italic'
  | 'bold-italic'
  | 'strikethrough'
  | 'highlight'
  | 'underline'
  | 'superscript'
  | 'subscript'
  | 'code'
  | 'kbd'
  | 'spoiler'
  | 'clear-format'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'bullet'
  | 'numbered'
  | 'task'
  | 'def-list'
  | 'quote'
  | 'callout-note'
  | 'callout-tip'
  | 'callout-important'
  | 'callout-warning'
  | 'callout-caution'
  | 'link'
  | 'wikilink'
  | 'image'
  | 'footnote'
  | 'table'
  | 'table-2x2'
  | 'table-3x3'
  | 'table-4x4'
  | 'format-tables'
  | 'format-doc'
  | 'codeblock'
  | 'math-inline'
  | 'math-block'
  | 'details'
  | 'collapsible'
  | 'hr'
  | 'frontmatter'
  | 'toc'
  | 'date'
  | 'mermaid'
  | 'mermaid-sequence'
  | 'mermaid-state'
  | 'mermaid-class'
  | 'mermaid-er'
  | 'mermaid-gantt'
  | 'mermaid-pie'
  | 'mermaid-mindmap'
  | 'excalidraw'
  | 'bookmark-card'

export function applyMarkdownFormatCommand(
  view: EditorView,
  command: MarkdownFormatCommand
): void {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)

  const wrap = (prefix: string, suffix: string, placeholder: string, allowToggle = true) => {
    if (allowToggle) {
      // Case 1: Selected text itself starts with prefix and ends with suffix -> unwrap
      if (
        selected.length >= prefix.length + suffix.length &&
        selected.startsWith(prefix) &&
        selected.endsWith(suffix)
      ) {
        const inner = selected.slice(prefix.length, selected.length - suffix.length)
        view.dispatch({
          changes: { from: range.from, to: range.to, insert: inner },
          selection: { anchor: range.from, head: range.from + inner.length }
        })
        view.focus()
        return
      }
      // Case 2: Surrounding characters right outside selection match prefix and suffix -> unwrap
      const beforeStart = Math.max(0, range.from - prefix.length)
      const afterEnd = Math.min(state.doc.length, range.to + suffix.length)
      const textBefore = state.sliceDoc(beforeStart, range.from)
      const textAfter = state.sliceDoc(range.to, afterEnd)
      if (range.from < range.to && textBefore === prefix && textAfter === suffix) {
        view.dispatch({
          changes: { from: beforeStart, to: afterEnd, insert: selected },
          selection: { anchor: beforeStart, head: beforeStart + selected.length }
        })
        view.focus()
        return
      }
    }

    const inner = selected || placeholder
    const replacement = `${prefix}${inner}${suffix}`
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: replacement },
      selection: {
        anchor: range.from + prefix.length,
        head: range.from + prefix.length + inner.length
      }
    })
    view.focus()
  }

  const prefixLine = (prefix: string) => {
    const startLine = state.doc.lineAt(range.from)
    const endLine = state.doc.lineAt(range.to)

    if (startLine.number === endLine.number) {
      const line = startLine
      // Toggle off if line already starts with the exact same prefix
      if (line.text.startsWith(prefix)) {
        const toggledOff = line.text.slice(prefix.length)
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: toggledOff },
          selection: { anchor: line.from + toggledOff.length }
        })
        view.focus()
        return
      }
      const stripped = line.text.replace(
        /^(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s+)/,
        ''
      )
      const nextText = `${prefix}${stripped}`
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: nextText },
        selection: { anchor: line.from + nextText.length }
      })
      view.focus()
      return
    }

    // Multi-line selection: apply prefix to each selected line
    const nextLines: string[] = []
    for (let ln = startLine.number; ln <= endLine.number; ln++) {
      const l = state.doc.line(ln)
      const stripped = l.text.replace(
        /^(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s+)/,
        ''
      )
      nextLines.push(`${prefix}${stripped}`)
    }
    const replacement = nextLines.join('\n')
    view.dispatch({
      changes: { from: startLine.from, to: endLine.to, insert: replacement },
      selection: { anchor: startLine.from, head: startLine.from + replacement.length }
    })
    view.focus()
  }

  const insertCallout = (kind: 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION', defaultBody: string) => {
    const bodyText = selected
      ? selected
          .split(/\r?\n/)
          .map((l) => `> ${l}`)
          .join('\n')
      : `> ${defaultBody}`
    const replacement = `\n> [!${kind}]\n${bodyText}\n`
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: replacement },
      selection: { anchor: range.from + replacement.length - 1 }
    })
    view.focus()
  }

  switch (command) {
    case 'bold':
      return wrap('**', '**', 'bold text')
    case 'italic':
      return wrap('*', '*', 'italic text')
    case 'bold-italic':
      return wrap('***', '***', 'bold italic text')
    case 'strikethrough':
      return wrap('~~', '~~', 'struck text')
    case 'highlight':
      return wrap('==', '==', 'highlighted text')
    case 'underline':
      return wrap('<u>', '</u>', 'underlined text')
    case 'superscript':
      return wrap('<sup>', '</sup>', '2')
    case 'subscript':
      return wrap('<sub>', '</sub>', 'i')
    case 'code':
      return wrap('`', '`', 'code')
    case 'kbd':
      return wrap('<kbd>', '</kbd>', '⌘K')
    case 'spoiler':
      return wrap('>! ', ' !<', 'spoiler text')
    case 'clear-format': {
      const targetFrom = selected ? range.from : state.doc.lineAt(range.from).from
      const targetTo = selected ? range.to : state.doc.lineAt(range.from).to
      const rawText = state.sliceDoc(targetFrom, targetTo)
      const cleaned = rawText
        .replace(/^(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s+)/gm, '')
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/==([^=]+)==/g, '$1')
        .replace(/>!\s*([^!]+?)\s*!</g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/<\/?(?:u|sup|sub|kbd|mark)>/gi, '')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_m, t, a) => a || t)
      view.dispatch({
        changes: { from: targetFrom, to: targetTo, insert: cleaned },
        selection: { anchor: targetFrom, head: targetFrom + cleaned.length }
      })
      view.focus()
      return
    }
    case 'h1':
      return prefixLine('# ')
    case 'h2':
      return prefixLine('## ')
    case 'h3':
      return prefixLine('### ')
    case 'h4':
      return prefixLine('#### ')
    case 'h5':
      return prefixLine('##### ')
    case 'h6':
      return prefixLine('###### ')
    case 'bullet':
      return prefixLine('- ')
    case 'numbered':
      return prefixLine('1. ')
    case 'task':
      return prefixLine('- [ ] ')
    case 'def-list':
      return wrap('\n', '\n: Definition of the term\n', 'Term', false)
    case 'quote':
      return prefixLine('> ')
    case 'callout-note':
      return insertCallout('NOTE', 'Key information that users should take into account.')
    case 'callout-tip':
      return insertCallout('TIP', 'Helpful advice for doing things better or more easily.')
    case 'callout-important':
      return insertCallout('IMPORTANT', 'Crucial information necessary for users to succeed.')
    case 'callout-warning':
      return insertCallout('WARNING', 'Urgent info that needs immediate user attention to avoid problems.')
    case 'callout-caution':
      return insertCallout('CAUTION', 'Advises about risks or negative outcomes of certain actions.')
    case 'link':
      return wrap('[', '](https://example.com)', 'link label', false)
    case 'wikilink':
      return wrap('[[', ']]', 'Document Name')
    case 'image':
      return wrap('![', '](assets/images/example.png)', 'Image caption', false)
    case 'footnote': {
      const docText = state.doc.toString()
      const existingRefs = docText.match(/\[\^(\d+)\](?!:)/g) || []
      const nextNum = existingRefs.length + 1
      const marker = `[^${nextNum}]`
      const defLine = `\n\n[^${nextNum}]: ${selected || 'Footnote reference details.'}`
      view.dispatch({
        changes: [
          { from: range.from, to: range.to, insert: marker },
          { from: state.doc.length, to: state.doc.length, insert: defLine }
        ],
        selection: { anchor: range.from + marker.length }
      })
      view.focus()
      return
    }
    case 'table-2x2':
      return wrap(
        '\n| Column A | Column B |\n| :--- | :--- |\n| ',
        ' | Value 2 |\n| Value 3  | Value 4 |\n',
        'Value 1 ',
        false
      )
    case 'table':
    case 'table-3x3':
      return wrap(
        '\n| Column A | Column B | Column C |\n| :--- | :--- | :--- |\n| ',
        ' | Value 2 | Value 3 |\n| Value 4 | Value 5 | Value 6 |\n',
        'Value 1',
        false
      )
    case 'table-4x4':
      return wrap(
        '\n| Column A | Column B | Column C | Column D |\n| :--- | :--- | :--- | :--- |\n| ',
        ' | Value 2 | Value 3 | Value 4 |\n| Value 5 | Value 6 | Value 7 | Value 8 |\n',
        'Value 1',
        false
      )
    case 'format-tables': {
      const docText = state.doc.toString()
      const formatted = formatAllTablesInMarkdown(docText)
      if (formatted !== docText) {
        const safeAnchor = Math.min(range.anchor, formatted.length)
        view.dispatch({
          changes: { from: 0, to: state.doc.length, insert: formatted },
          selection: { anchor: safeAnchor }
        })
      }
      view.focus()
      return
    }
    case 'format-doc': {
      const docText = state.doc.toString()
      const formatted = formatMarkdownDocument(docText)
      if (formatted !== docText) {
        const safeAnchor = Math.min(range.anchor, formatted.length)
        view.dispatch({
          changes: { from: 0, to: state.doc.length, insert: formatted },
          selection: { anchor: safeAnchor }
        })
      }
      view.focus()
      return
    }
    case 'codeblock':
      return wrap('\n```typescript\n', '\n```\n', '// code', false)
    case 'math-inline':
      return wrap('$', '$', 'E = mc^2')
    case 'math-block':
      return wrap('\n$$\n', '\n$$\n', '\\sum_{i=1}^{n} x_i = \\int_{a}^{b} f(x)\\,dx', false)
    case 'details':
    case 'collapsible':
      return wrap(
        '\n<details>\n<summary>',
        '</summary>\n\nExpanded details content goes here.\n</details>\n',
        'Click to expand',
        false
      )
    case 'hr': {
      const insertText = '\n---\n'
      view.dispatch({
        changes: { from: range.to, to: range.to, insert: insertText },
        selection: { anchor: range.to + insertText.length }
      })
      view.focus()
      return
    }
    case 'frontmatter': {
      const docText = state.doc.toString()
      if (docText.startsWith('---\n') || docText.startsWith('---\r\n')) {
        view.dispatch({ selection: { anchor: 4 } })
        view.focus()
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const fm = `---\ntitle: Document Title\ndate: ${today}\ntags:\n  - notes\nstatus: draft\n---\n\n`
      view.dispatch({
        changes: { from: 0, to: 0, insert: fm },
        selection: { anchor: fm.length }
      })
      view.focus()
      return
    }
    case 'toc':
      return wrap('\n', '\n', '[[_TOC_]]', false)
    case 'date': {
      const today = new Date().toISOString().slice(0, 10)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: today },
        selection: { anchor: range.from + today.length }
      })
      view.focus()
      return
    }
    case 'mermaid':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'flowchart LR\n  Start["Start"] --> Process["Process"] --> Finish["Done"]',
        false
      )
    case 'mermaid-sequence':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'sequenceDiagram\n  participant Client\n  participant Server\n  Client->>Server: Request Data\n  Server-->>Client: JSON Response',
        false
      )
    case 'mermaid-state':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Processing: Start\n  Processing --> Complete: Success\n  Complete --> [*]',
        false
      )
    case 'mermaid-class':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'classDiagram\n  class Document {\n    +String title\n    +String content\n    +render() HTML\n  }',
        false
      )
    case 'mermaid-er':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'erDiagram\n  WORKSPACE ||--o{ DOCUMENT : contains\n  DOCUMENT ||--o{ ASSET : references',
        false
      )
    case 'mermaid-gantt':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'gantt\n  title Project Roadmap\n  dateFormat YYYY-MM-DD\n  section Phase 1\n    Design & Specs :a1, 2026-01-01, 7d\n    Implementation :after a1, 10d',
        false
      )
    case 'mermaid-pie':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'pie title Distribution\n  "Markdown Docs" : 55\n  "Diagrams" : 25\n  "Code Blocks" : 20',
        false
      )
    case 'mermaid-mindmap':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'mindmap\n  root((Klartext))\n    Architecture\n      Local First\n      Multi-Root\n    Formatting\n      GFM Tables\n      Mermaid Diagrams',
        false
      )
    case 'excalidraw':
      return wrap(
        '\n![Architecture Sketch](',
        ')\n',
        'assets/drawings/sketch.excalidraw.svg',
        false
      )
    case 'bookmark-card': {
      const url = selected && /^https?:\/\//i.test(selected.trim()) ? selected.trim() : 'https://example.com'
      let domain = 'example.com'
      try {
        domain = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        domain = 'example.com'
      }
      const cardBlock = `\n:::bookmark\ntitle: ${domain} Reference\nurl: ${url}\ndomain: ${domain}\ndescription: Rich bookmark card reference for ${url}\n:::\n`
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: cardBlock },
        selection: { anchor: range.from + cardBlock.length }
      })
      view.focus()
      return
    }
  }
}


