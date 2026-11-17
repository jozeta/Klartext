// Where a dropped file's Markdown link goes in the document.
//
// The drop point (where the mouse is, shown by the editor's drop cursor) wins over the selection:
// a freshly opened file has its selection at position 0, inside the YAML frontmatter, so using the
// selection put dropped images into the frontmatter unless the user had clicked in the text first.
// A link is never inserted inside the frontmatter, since that breaks the YAML.

const FRONTMATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(\r?\n|$)/

/**
 * Offset of the first line after the leading frontmatter block (past the closing `---` and its line
 * break), or -1 if there is none. Equals doc.length when the document is only frontmatter.
 */
export function frontmatterEnd(doc: string): number {
  const m = FRONTMATTER.exec(doc)
  return m ? m[0].length : -1
}

export interface DropInsertion {
  /** Offset to insert at. */
  pos: number
  /** Text to put before the link: a line break when the document ends right after the closing `---`. */
  prefix: string
}

export function resolveDropInsertion(
  doc: string,
  dropPos: number | null,
  selectionPos: number
): DropInsertion {
  const raw = dropPos ?? selectionPos
  const pos = Math.max(0, Math.min(raw, doc.length))
  const fmEnd = frontmatterEnd(doc)
  if (fmEnd >= 0) {
    const endsOnFence = !/\n$/.test(doc.slice(0, fmEnd))
    if (pos < fmEnd || (pos === fmEnd && endsOnFence)) {
      return { pos: fmEnd, prefix: endsOnFence ? '\n' : '' }
    }
  }
  return { pos, prefix: '' }
}

/** Insert offset only (see resolveDropInsertion). */
export function resolveDropInsertPosition(
  doc: string,
  dropPos: number | null,
  selectionPos: number
): number {
  return resolveDropInsertion(doc, dropPos, selectionPos).pos
}
