// What to do when an open document changed on disk outside Klartext (git pull, sync tool, another
// editor). A tab without unsaved edits simply reloads. A tab with unsaved edits used to ignore the
// change, and its next autosave then overwrote it without a word; now the user is asked.

export type ExternalChangeAction = 'ignore' | 'reload' | 'conflict'

export function decideExternalChange(
  tab: { content: string; savedContent: string; dirty: boolean },
  diskContent: string
): ExternalChangeAction {
  if (diskContent === tab.content || diskContent === tab.savedContent) return 'ignore'
  return tab.dirty ? 'conflict' : 'reload'
}
