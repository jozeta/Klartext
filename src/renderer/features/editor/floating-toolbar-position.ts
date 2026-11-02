// Where to place the floating selection toolbar (Bold/Italic/Headings/AI… shown when text is
// selected), and how wide to make it. It is rendered with `position: fixed`, so these are window
// (viewport) coordinates.
//
// It used to be clamped to the window only and sized by its content (~640 px), so with a side panel
// open (AI assistant, outline, …) the editor pane is often narrower than the toolbar and it covered
// that panel's buttons. Select-all also anchored it below the *end* of the selection, which can be
// far off-screen. Both call sites in MarkdownEditorWorkspace.tsx use this function so mouse and
// keyboard selections behave the same.

export interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

/** Width the toolbar takes when there's room (its natural content width). */
export const FLOATING_TOOLBAR_MAX_WIDTH = 640
/** Narrowest it can get: 16 grid columns of 22 px (one icon button) plus gaps and padding. */
export const FLOATING_TOOLBAR_MIN_WIDTH = 400
/** Rendered height of the two button rows. */
export const FLOATING_TOOLBAR_HEIGHT = 76
/** Gap between the selected text (or the pane's edge) and the toolbar. */
export const FLOATING_TOOLBAR_GAP = 8

/**
 * @param selection Bounding box of the selected text (from CodeMirror's coordsAtPos for the
 *   selection's start and end). For a long selection, `bottom` can be far below the window.
 * @param pane The visible editor pane (the scroll wrapper's getBoundingClientRect()), i.e. the area
 *   the toolbar should stay inside so it never covers side panels or the title bar.
 * @returns Window coordinates for the toolbar's top-left corner, and its width.
 */
export function computeFloatingToolbarPosition(
  selection: Box,
  pane: Box
): { top: number; left: number; width: number } {
  const gap = FLOATING_TOOLBAR_GAP
  // Width: fill the pane (minus a margin) up to the natural width, but never below the width the
  // buttons need. Only a pane narrower than ~416 px makes it overhang on the right.
  const width = Math.max(
    FLOATING_TOOLBAR_MIN_WIDTH,
    Math.min(FLOATING_TOOLBAR_MAX_WIDTH, pane.right - pane.left - 2 * gap)
  )
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
  // Horizontal: start where the selection starts, clamped inside the pane.
  const left = Math.max(pane.left + gap, Math.min(selection.left, pane.right - width - gap))
  return { top, left, width }
}
