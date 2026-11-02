// Where to place the floating selection toolbar (Bold/Italic/Headings/AI… shown when text is
// selected). It is rendered with `position: fixed`, so these are window (viewport) coordinates.
//
// It used to be clamped to the window only, so with a side panel open (AI assistant, outline, …)
// in a narrower window it could cover that panel's buttons. Select-all also anchored it below the
// *end* of the selection, which can be far off-screen. Both call sites in
// MarkdownEditorWorkspace.tsx use this function so mouse and keyboard selections behave the same.

export interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

/** Approximate rendered size of the toolbar (two rows of 16 equal-width buttons). */
export const FLOATING_TOOLBAR_WIDTH = 420
export const FLOATING_TOOLBAR_HEIGHT = 60
/** Gap between the selected text and the toolbar. */
export const FLOATING_TOOLBAR_GAP = 8

/**
 * @param selection Bounding box of the selected text (from CodeMirror's coordsAtPos for the
 *   selection's start and end). For a long selection, `bottom` can be far below the window.
 * @param pane The visible editor pane (the scroll wrapper's getBoundingClientRect()), i.e. the area
 *   the toolbar should stay inside so it never covers side panels or the title bar.
 * @returns Window coordinates for the toolbar's top-left corner.
 */
export function computeFloatingToolbarPosition(selection: Box, pane: Box): { top: number; left: number } {
  const gap = FLOATING_TOOLBAR_GAP
  // Vertical: above the selection if there's room; else below its end if that is visible; else
  // (e.g. select-all, whose end is far off-screen) pinned to the top edge of the pane.
  const above = selection.top - FLOATING_TOOLBAR_HEIGHT - gap
  const below = selection.bottom + gap
  const top =
    above >= pane.top
      ? above
      : below + FLOATING_TOOLBAR_HEIGHT <= pane.bottom
        ? below
        : pane.top + gap
  // Horizontal: start where the selection starts, clamped inside the pane. A pane narrower than the
  // toolbar aligns it to the pane's left edge (it may then overhang on the right).
  const maxLeft = pane.right - FLOATING_TOOLBAR_WIDTH - gap
  const left = Math.max(pane.left + gap, Math.min(selection.left, maxLeft))
  return { top, left }
}
