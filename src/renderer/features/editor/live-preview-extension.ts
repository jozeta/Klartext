import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType
} from '@codemirror/view'
import { StateField } from '@codemirror/state'
import katex from 'katex'
import mermaid from 'mermaid'
import { sanitizeSvgContent } from '../../../shared/serialization/excalidraw-svg'
import { highlightCodeToHtml } from '../../../shared/markdown/syntax-highlight'

let mermaidInitialized = false

function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      fontFamily: 'Inter, -apple-system, sans-serif'
    })
    mermaidInitialized = true
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
    private onEditExcalidraw: (relPath: string) => void
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
    // Parse optional width suffix from alt text: ![Caption|360](url)
    const pipeIdx = this.rawAlt.lastIndexOf('|')
    let displayAlt = this.rawAlt
    let parsedWidth: number | null = null
    if (pipeIdx !== -1) {
      const maybeNum = Number(this.rawAlt.slice(pipeIdx + 1).trim())
      if (!Number.isNaN(maybeNum) && maybeNum >= 40 && maybeNum <= 2000) {
        displayAlt = this.rawAlt.slice(0, pipeIdx)
        parsedWidth = maybeNum
      }
    }

    const container = document.createElement('div')
    container.className =
      'klartext-resizable-image-box my-2 p-2 rounded-md border border-subtle bg-panel inline-block max-w-full relative select-none transition-shadow'
    container.setAttribute('data-testid', 'inline-resizable-image')

    const cleanRel = this.rawUrl.replace(/^\.\//, '')
    const resolvedSrc =
      this.rawUrl.startsWith('http://') ||
      this.rawUrl.startsWith('https://') ||
      this.rawUrl.startsWith('data:') ||
      this.rawUrl.startsWith('klartext-asset://')
        ? this.rawUrl
        : `klartext-asset://${encodeURIComponent(this.rootId)}/${cleanRel}`

    const imgWrapper = document.createElement('div')
    imgWrapper.className = 'relative inline-block'

    const img = document.createElement('img')
    img.src = resolvedSrc
    img.alt = displayAlt
    img.className = 'rounded mx-auto block max-w-full h-auto'
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
          const updatedMarkdown = `![${displayAlt}|${latestWidth}](${this.rawUrl})`
          view.dispatch({
            changes: {
              from: this.fromPos,
              to: this.toPos,
              insert: updatedMarkdown
            }
          })
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      })
      handleEls.push(h)
      imgWrapper.appendChild(h)
    }

    // Toggle selection border and corner handles when clicking the image
    img.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const isSelected = container.classList.toggle('klartext-image-selected')
      handleEls.forEach((h) => h.classList.toggle('hidden', !isSelected))
    })

    container.appendChild(imgWrapper)
    return container
  }
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
        .split('|')
        .map((c) => c.trim())
    )

    const table = document.createElement('table')
    table.className = 'w-full border-collapse text-xs'

    if (rows.length > 0) {
      const thead = document.createElement('thead')
      const tr = document.createElement('tr')
      for (const h of rows[0]) {
        const th = document.createElement('th')
        th.className = 'border border-subtle bg-secondary px-3 py-1.5 text-left font-semibold'
        th.textContent = h.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
    }

    if (rows.length > 2) {
      const tbody = document.createElement('tbody')
      for (let i = 2; i < rows.length; i++) {
        const tr = document.createElement('tr')
        for (const cell of rows[i]) {
          const td = document.createElement('td')
          td.className = 'border border-subtle px-3 py-1.5 text-left'
          td.textContent = cell.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
          tr.appendChild(td)
        }
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
      ensureMermaidInit()
      const id = `cm-mermaid-${Math.random().toString(36).slice(2, 10)}`
      mermaid
        .render(id, currentCode)
        .then(({ svg }) => {
          body.innerHTML = sanitizeSvgContent(svg)
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

export interface LivePreviewOptions {
  inlineRichMode: boolean
  rootId: string
  onResolveConflict: (
    hunkIndex: number,
    resolution: 'current' | 'incoming' | 'both' | '3way'
  ) => void
  onNavigateLink: (target: string, isWiki: boolean) => void
  onOpenExcalidraw: (drawingRelPath: string) => void
  onOpenMermaidBuilder?: (currentCode: string, blockFrom: number, blockTo: number) => void
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

    // 3. Multi-line Fenced Code Block or Mermaid Block (```lang ... ```)
    const fenceOpen = text.match(/^\s*```([\w-]*)\s*$/)
    if (fenceOpen) {
      const lang = (fenceOpen[1] || '').toLowerCase()
      const startL = lineNum
      let endL = startL + 1
      const innerLines: string[] = []
      while (endL <= doc.lines && !/^\s*```\s*$/.test(doc.line(endL).text)) {
        innerLines.push(doc.line(endL).text)
        endL++
      }
      if (endL <= doc.lines) {
        if (!isRangeActive(startL, endL)) {
          const innerCode = innerLines.join('\n')
          const firstLine = doc.line(startL)
          const lastLine = doc.line(endL)
          const widget =
            lang === 'mermaid'
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

    // 5. Multi-line GFM Table Block (consecutive lines starting with '|')
    if (text.trim().startsWith('|') && lineNum + 1 <= doc.lines && doc.line(lineNum + 1).text.trim().startsWith('|')) {
      const startL = lineNum
      let endL = startL
      const tableLines: string[] = []
      while (endL <= doc.lines && doc.line(endL).text.trim().startsWith('|')) {
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

    // If cursor is on this single line, reveal raw Markdown tokens
    if (isRangeActive(lineNum, lineNum)) {
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
      decos.push({
        from: line.from,
        to: line.from + hashes.length + 1,
        value: Decoration.replace({})
      })
    }

    // 7. Callouts / Blockquotes (> [!NOTE] Title or > quote)
    const calloutHeader = text.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i)
    if (calloutHeader) {
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-live-callout-line font-semibold text-accent' })
      })
      const tokenLen = text.indexOf(']') + 1
      decos.push({
        from: line.from,
        to: line.from + tokenLen,
        value: Decoration.replace({})
      })
    } else if (text.startsWith('> ')) {
      decos.push({
        from: line.from,
        to: line.from,
        value: Decoration.line({ class: 'cm-live-callout-line' })
      })
      decos.push({
        from: line.from,
        to: line.from + 2,
        value: Decoration.replace({})
      })
    }

    // 8. Task list checkboxes (- [ ] or - [x])
    const taskMatch = text.match(/^(\s*[-*+]\s+)(\[[ xX]\])/)
    if (taskMatch) {
      const bracketStart = line.from + taskMatch[1].length
      const isChecked = taskMatch[2].toLowerCase() === '[x]'
      decos.push({
        from: bracketStart,
        to: bracketStart + 3,
        value: Decoration.replace({
          widget: new TaskCheckboxWidget(isChecked, bracketStart)
        })
      })
    }

    // 9. Standalone Image or Embedded Excalidraw Drawing (![alt](url))
    const imgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
    let imgMatch: RegExpExecArray | null
    while ((imgMatch = imgRegex.exec(text)) !== null) {
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
            opts.onOpenExcalidraw
          )
        })
      })
    }

    // 10. WikiLinks [[Target|Alias]]
    const wikiRegex = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g
    let wikiMatch: RegExpExecArray | null
    while ((wikiMatch = wikiRegex.exec(text)) !== null) {
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
    const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkRegex.exec(text)) !== null) {
      const start = line.from + linkMatch.index
      const end = start + linkMatch[0].length
      decos.push({
        from: start,
        to: end,
        value: Decoration.replace({
          widget: new InlineLinkWidget(
            linkMatch[1],
            linkMatch[2],
            false,
            opts.onNavigateLink
          )
        })
      })
    }

    // 12. Inline Math ($...$)
    const mathRegex = /(?<!\$)\$([^$\n]+)\$(?!\$)/g
    let mathMatch: RegExpExecArray | null
    while ((mathMatch = mathRegex.exec(text)) !== null) {
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

    // 13. Inline Code (`code`)
    const codeRegex = /`([^`\n]+)`/g
    let codeMatch: RegExpExecArray | null
    while ((codeMatch = codeRegex.exec(text)) !== null) {
      const start = line.from + codeMatch.index
      const end = start + codeMatch[0].length
      decos.push({ from: start, to: start + 1, value: Decoration.replace({}) })
      decos.push({
        from: start + 1,
        to: end - 1,
        value: Decoration.mark({ class: 'cm-live-code' })
      })
      decos.push({ from: end - 1, to: end, value: Decoration.replace({}) })
    }

    // 14. Inline **Bold**
    const boldRegex = /\*\*([^*]+)\*\*/g
    let boldMatch: RegExpExecArray | null
    while ((boldMatch = boldRegex.exec(text)) !== null) {
      const start = line.from + boldMatch.index
      const end = start + boldMatch[0].length
      decos.push({ from: start, to: start + 2, value: Decoration.replace({}) })
      decos.push({
        from: start + 2,
        to: end - 2,
        value: Decoration.mark({ class: 'cm-live-bold' })
      })
      decos.push({ from: end - 2, to: end, value: Decoration.replace({}) })
    }

    // 15. Inline ~~Strikethrough~~
    const strikeRegex = /~~([^~]+)~~/g
    let strikeMatch: RegExpExecArray | null
    while ((strikeMatch = strikeRegex.exec(text)) !== null) {
      const start = line.from + strikeMatch.index
      const end = start + strikeMatch[0].length
      decos.push({ from: start, to: start + 2, value: Decoration.replace({}) })
      decos.push({
        from: start + 2,
        to: end - 2,
        value: Decoration.mark({ class: 'cm-live-strike' })
      })
      decos.push({ from: end - 2, to: end, value: Decoration.replace({}) })
    }

    // 16. Inline *Italic* (avoiding **bold**)
    const italicRegex = /(?<!\*)\*([^*\n]+)\*(?!\*)/g
    let italicMatch: RegExpExecArray | null
    while ((italicMatch = italicRegex.exec(text)) !== null) {
      const start = line.from + italicMatch.index
      const end = start + italicMatch[0].length
      decos.push({ from: start, to: start + 1, value: Decoration.replace({}) })
      decos.push({
        from: start + 1,
        to: end - 1,
        value: Decoration.mark({ class: 'cm-live-italic' })
      })
      decos.push({ from: end - 1, to: end, value: Decoration.replace({}) })
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

export function applyMarkdownFormatCommand(
  view: EditorView,
  command:
    | 'bold'
    | 'italic'
    | 'strikethrough'
    | 'code'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'link'
    | 'image'
    | 'table'
    | 'codeblock'
    | 'bullet'
    | 'numbered'
    | 'task'
    | 'quote'
    | 'mermaid'
    | 'excalidraw'
): void {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)

  const wrap = (prefix: string, suffix: string, placeholder: string) => {
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
    const line = state.doc.lineAt(range.from)
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
  }

  switch (command) {
    case 'bold':
      return wrap('**', '**', 'bold text')
    case 'italic':
      return wrap('*', '*', 'italic text')
    case 'strikethrough':
      return wrap('~~', '~~', 'struck text')
    case 'code':
      return wrap('`', '`', 'code')
    case 'h1':
      return prefixLine('# ')
    case 'h2':
      return prefixLine('## ')
    case 'h3':
      return prefixLine('### ')
    case 'bullet':
      return prefixLine('- ')
    case 'numbered':
      return prefixLine('1. ')
    case 'task':
      return prefixLine('- [ ] ')
    case 'quote':
      return prefixLine('> ')
    case 'link':
      return wrap('[', '](https://example.com)', 'link label')
    case 'image':
      return wrap('![', '](assets/images/example.png)', 'Image caption')
    case 'table':
      return wrap(
        '\n| Column A | Column B | Column C |\n| :--- | :--- | :--- |\n| ',
        ' | Value 2 | Value 3 |\n',
        'Value 1'
      )
    case 'codeblock':
      return wrap('\n```typescript\n', '\n```\n', '// code')
    case 'mermaid':
      return wrap(
        '\n```mermaid\n',
        '\n```\n',
        'flowchart LR\n  Start["Start"] --> Finish["Done"]'
      )
    case 'excalidraw':
      return wrap(
        '\n![Architecture Sketch](',
        ')\n',
        'assets/drawings/sketch.excalidraw.svg'
      )
  }
}
