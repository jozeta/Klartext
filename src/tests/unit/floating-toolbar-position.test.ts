import { describe, it, expect } from 'vitest'
import {
  computeFloatingToolbarPosition,
  FLOATING_TOOLBAR_HEIGHT,
  FLOATING_TOOLBAR_WIDTH,
  type Box
} from '../../renderer/features/editor/floating-toolbar-position'

// Editor pane between a 240 px sidebar and a 300 px AI panel in a 1024x768 window.
const pane: Box = { top: 48, bottom: 740, left: 240, right: 724 }

const insidePane = ({ top, left }: { top: number; left: number }) => {
  expect(left).toBeGreaterThanOrEqual(pane.left)
  expect(left + FLOATING_TOOLBAR_WIDTH).toBeLessThanOrEqual(pane.right)
  expect(top).toBeGreaterThanOrEqual(pane.top)
  expect(top + FLOATING_TOOLBAR_HEIGHT).toBeLessThanOrEqual(pane.bottom)
}

describe('floating selection toolbar position', () => {
  it('sits just above a selection in the middle of the pane', () => {
    const pos = computeFloatingToolbarPosition({ top: 400, bottom: 420, left: 300, right: 360 }, pane)
    insidePane(pos)
    expect(pos.top + FLOATING_TOOLBAR_HEIGHT).toBeLessThanOrEqual(400)
  })

  it('never spills into the side panel when the selection is near the right edge', () => {
    insidePane(computeFloatingToolbarPosition({ top: 400, bottom: 420, left: 690, right: 720 }, pane))
  })

  it('stays inside the pane for a selection on the first line (no room above)', () => {
    insidePane(computeFloatingToolbarPosition({ top: 60, bottom: 80, left: 260, right: 400 }, pane))
  })

  it('stays visible for select-all, whose end is far below the window', () => {
    insidePane(computeFloatingToolbarPosition({ top: 60, bottom: 4800, left: 260, right: 700 }, pane))
  })
})
