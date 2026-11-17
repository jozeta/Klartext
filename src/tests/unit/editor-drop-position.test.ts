import { describe, it, expect } from 'vitest'
import { resolveDropInsertion, resolveDropInsertPosition } from '../../renderer/features/editor/drop-position'

const doc = '---\ntitle: Note\ntags: [a]\n---\n\n# Heading\n\nBody text\n'
const afterFrontmatter = doc.indexOf('\n# Heading') // the empty line right after the closing ---

describe('resolveDropInsertPosition', () => {
  it('inserts where the file was dropped, not at the (stale) selection', () => {
    const bodyPos = doc.indexOf('Body')
    expect(resolveDropInsertPosition(doc, bodyPos, 0)).toBe(bodyPos)
  })

  it('falls back to the selection when the drop point is outside the text', () => {
    const headingPos = doc.indexOf('# Heading')
    expect(resolveDropInsertPosition(doc, null, headingPos)).toBe(headingPos)
  })

  it('never inserts inside the frontmatter (fresh file: selection at 0)', () => {
    expect(resolveDropInsertPosition(doc, null, 0)).toBe(afterFrontmatter)
    expect(resolveDropInsertPosition(doc, doc.indexOf('tags'), 0)).toBe(afterFrontmatter)
    expect(resolveDropInsertPosition(doc, doc.indexOf('---\n\n'), 0)).toBe(afterFrontmatter)
  })

  it('handles CRLF frontmatter and a document that is only frontmatter', () => {
    const crlf = '---\r\ntitle: A\r\n---\r\nText'
    expect(resolveDropInsertPosition(crlf, 2, 0)).toBe(crlf.indexOf('Text'))
    const only = '---\ntitle: A\n---'
    expect(resolveDropInsertion(only, 0, 0)).toEqual({ pos: only.length, prefix: '\n' })
    expect(resolveDropInsertion(only, only.length, 0)).toEqual({ pos: only.length, prefix: '\n' })
    expect(resolveDropInsertion(doc, 0, 0).prefix).toBe('')
  })

  it('leaves documents without frontmatter alone and clamps to the document', () => {
    expect(resolveDropInsertPosition('Hello', 0, 3)).toBe(0)
    expect(resolveDropInsertPosition('Hello', 99, 0)).toBe(5)
    expect(resolveDropInsertPosition('--- not frontmatter', 1, 0)).toBe(1)
  })
})
