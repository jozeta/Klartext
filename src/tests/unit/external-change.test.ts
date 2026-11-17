import { describe, it, expect } from 'vitest'
import { decideExternalChange } from '../../renderer/features/editor/external-change'

describe('decideExternalChange', () => {
  const tab = { content: 'mine', savedContent: 'base', dirty: false }

  it('reloads a tab without unsaved edits', () => {
    expect(decideExternalChange(tab, 'theirs')).toBe('reload')
  })

  it('flags a conflict instead of ignoring the change when the tab has unsaved edits', () => {
    expect(decideExternalChange({ ...tab, dirty: true }, 'theirs')).toBe('conflict')
  })

  it('ignores a change that matches what the editor already shows or last saved', () => {
    expect(decideExternalChange(tab, 'mine')).toBe('ignore')
    expect(decideExternalChange({ ...tab, dirty: true }, 'mine')).toBe('ignore')
    expect(decideExternalChange({ ...tab, dirty: true }, 'base')).toBe('ignore')
  })
})
