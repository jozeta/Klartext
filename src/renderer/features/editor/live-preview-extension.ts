import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

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

class ConflictActionLensWidget extends WidgetType {
  constructor(
    private hunkIndex: number,
    private currentLabel: string,
    private incomingLabel: string,
    private onResolve: (hunkIndex: number, resolution: 'current' | 'incoming' | 'both' | '3way') => void
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

    const actions: Array<{ label: string; res: 'current' | 'incoming' | 'both' | '3way'; testId: string }> = [
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

function buildLiveDecorations(
  view: EditorView,
  inlineRichMode: boolean,
  onResolveConflict: (hunkIndex: number, resolution: 'current' | 'incoming' | 'both' | '3way') => void
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const selection = view.state.selection.main
  const activeStartLine = doc.lineAt(selection.from).number
  const activeEndLine = doc.lineAt(selection.to).number

  let conflictHunkIndex = 0

  for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
    const line = doc.line(lineNum)
    const text = line.text
    const isLineActive = lineNum >= activeStartLine && lineNum <= activeEndLine

    // Highlight Git Conflict Markers in all modes
    if (text.startsWith('<<<<<<<')) {
      const currentLabel = text.replace(/^<{7}\s*/, '').trim() || 'HEAD'
      const idx = conflictHunkIndex++
      builder.add(
        line.from,
        line.from,
        Decoration.widget({
          widget: new ConflictActionLensWidget(idx, currentLabel, 'incoming', onResolveConflict),
          block: false,
          side: -1
        })
      )
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-conflict-marker-current' }))
      continue
    }
    if (text.startsWith('>>>>>>>')) {
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-conflict-marker-incoming' }))
      continue
    }

    if (!inlineRichMode || isLineActive) {
      continue
    }

    // Live Inline Rich Mode decorations on inactive lines:
    // 1. Headings (#, ##, ###)
    const headingMatch = text.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const hashes = headingMatch[1]
      const level = hashes.length
      const cls = level === 1 ? 'cm-live-h1' : level === 2 ? 'cm-live-h2' : 'cm-live-h3'
      builder.add(line.from, line.from, Decoration.line({ class: cls }))
      builder.add(line.from, line.from + hashes.length + 1, Decoration.replace({}))
      continue
    }

    // 2. Callout / Blockquote lines
    if (text.startsWith('> ')) {
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-live-callout-line' }))
    }

    // 3. Task list checkboxes (- [ ] or - [x])
    const taskMatch = text.match(/^(\s*[-*+]\s+)(\[[ xX]\])/)
    if (taskMatch) {
      const bracketStart = line.from + taskMatch[1].length
      const isChecked = taskMatch[2].toLowerCase() === '[x]'
      builder.add(
        bracketStart,
        bracketStart + 3,
        Decoration.replace({
          widget: new TaskCheckboxWidget(isChecked, bracketStart)
        })
      )
    }

    // 4. Inline **bold** tokens
    const boldRegex = /\*\*([^*]+)\*\*/g
    let m: RegExpExecArray | null
    while ((m = boldRegex.exec(text)) !== null) {
      const start = line.from + m.index
      const end = start + m[0].length
      builder.add(start, start + 2, Decoration.replace({}))
      builder.add(start + 2, end - 2, Decoration.mark({ class: 'cm-live-bold' }))
      builder.add(end - 2, end, Decoration.replace({}))
    }
  }

  return builder.finish()
}

export function createLivePreviewExtension(
  inlineRichMode: boolean,
  onResolveConflict: (hunkIndex: number, resolution: 'current' | 'incoming' | 'both' | '3way') => void
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildLiveDecorations(view, inlineRichMode, onResolveConflict)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildLiveDecorations(update.view, inlineRichMode, onResolveConflict)
        }
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )
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
    const stripped = line.text.replace(/^(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s+)/, '')
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
