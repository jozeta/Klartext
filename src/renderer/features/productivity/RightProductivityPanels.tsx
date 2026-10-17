import React, { useState } from 'react'
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  X
} from '../../components/icons/untitled-icons'
import {
  normalizeFrontmatterDate,
  type DynamicCandidateDocument
} from '../../../shared/markdown/dynamic-workspace'
import { extractFrontmatter } from '../../../shared/markdown/pipeline'
import type { GlobalTaskItem } from '../../../shared/markdown/knowledge-features'

export interface DailyNotesCalendarPanelProps {
  dynamicCandidateDocuments: DynamicCandidateDocument[]
  onOpenDailyNote: (dateYmd?: string) => void
  onOpenDocument: (rootId: string, relativePath: string) => void
  onClose: () => void
}

export const DailyNotesCalendarPanel: React.FC<DailyNotesCalendarPanelProps> = ({
  dynamicCandidateDocuments,
  onOpenDailyNote,
  onOpenDocument,
  onClose
}) => {
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const now = new Date()
    const pad2 = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  })

  const { year, month } = calendarMonth
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]

  // Index documents by date (filename YYYY-MM-DD or frontmatter date)
  const docsByDate = new Map<string, DynamicCandidateDocument[]>()
  for (const doc of dynamicCandidateDocuments) {
    const fileMatch = doc.name.match(/(\d{4}-\d{2}-\d{2})/)
    const { frontmatter } = extractFrontmatter(doc.content)
    const fmDate = normalizeFrontmatterDate(frontmatter?.date)
    const dateKeys = new Set<string>()
    if (fileMatch) dateKeys.add(fileMatch[1])
    if (fmDate) dateKeys.add(fmDate)
    for (const dk of dateKeys) {
      const list = docsByDate.get(dk) || []
      list.push(doc)
      docsByDate.set(dk, list)
    }
  }

  const selectedDateDocs = docsByDate.get(selectedCalendarDate) || []

  return (
    <aside
      data-testid="daily-calendar-panel"
      className="flex-1 min-h-0 flex flex-col border-l border-subtle bg-app select-none overflow-hidden"
    >
      {/* Header */}
      <div className="h-9 px-3 border-b border-subtle flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <Calendar className="w-3.5 h-3.5 text-accent" />
          <span>Daily Notes &amp; Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="calendar-open-today-note-btn"
            onClick={() => onOpenDailyNote()}
            className="px-2 py-0.5 rounded bg-accent text-white text-[11px] font-medium hover:opacity-90 flex items-center gap-1"
          >
            <Calendar className="w-3 h-3" />
            <span>Today&apos;s Note</span>
          </button>
          <button
            type="button"
            title="Close Daily Notes Panel"
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div className="p-2.5 rounded-md bg-panel border border-subtle space-y-2">
          <div className="flex items-center justify-between font-semibold text-primary">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth((prev) =>
                  prev.month === 0
                    ? { year: prev.year - 1, month: 11 }
                    : { year: prev.year, month: prev.month - 1 }
                )
              }
              className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth((prev) =>
                  prev.month === 11
                    ? { year: prev.year + 1, month: 0 }
                    : { year: prev.year, month: prev.month + 1 }
                )
              }
              className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="h-7" />
              const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`
              const hasDocs = (docsByDate.get(dateStr)?.length || 0) > 0
              const isSelected = selectedCalendarDate === dateStr
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-testid={`mini-calendar-day-${dateStr}`}
                  onClick={() => setSelectedCalendarDate(dateStr)}
                  onDoubleClick={() => onOpenDailyNote(dateStr)}
                  className={`h-7 rounded flex flex-col items-center justify-center relative transition-colors ${
                    isSelected
                      ? 'bg-accent text-white font-semibold'
                      : 'hover:bg-secondary text-primary'
                  }`}
                >
                  <span>{day}</span>
                  {hasDocs && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-accent'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-muted">
              Notes on {selectedCalendarDate} ({selectedDateDocs.length})
            </span>
            <button
              type="button"
              data-testid={`calendar-create-or-open-daily-${selectedCalendarDate}`}
              onClick={() => onOpenDailyNote(selectedCalendarDate)}
              className="text-[11px] text-accent hover:underline font-medium"
            >
              Open Daily Note ({selectedCalendarDate})
            </button>
          </div>
          {selectedDateDocs.length === 0 ? (
            <div className="text-muted text-[11px] italic">
              No notes dated {selectedCalendarDate}. Click above to create one.
            </div>
          ) : (
            selectedDateDocs.map((doc) => (
              <button
                key={`${doc.rootId}::${doc.relativePath}`}
                type="button"
                onClick={() => onOpenDocument(doc.rootId, doc.relativePath)}
                className="w-full text-left p-2 rounded bg-panel border border-subtle hover:border-accent flex items-center justify-between"
              >
                <span className="truncate font-medium text-primary">{doc.name}</span>
                <span className="text-[10px] font-mono text-muted shrink-0">
                  {doc.rootName}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}

export interface GlobalTasksRightPanelProps {
  globalTasks: GlobalTaskItem[]
  onToggleGlobalTask: (task: GlobalTaskItem) => void
  onNavigateToLine: (rootId: string, relativePath: string, lineNumber: number) => void
  onClose: () => void
}

export const GlobalTasksRightPanel: React.FC<GlobalTasksRightPanelProps> = ({
  globalTasks,
  onToggleGlobalTask,
  onNavigateToLine,
  onClose
}) => {
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'open' | 'completed'>('open')
  const [taskSearchQuery, setTaskSearchQuery] = useState('')

  const filteredTasks = globalTasks.filter((t) => {
    if (taskStatusFilter === 'open' && t.checked) return false
    if (taskStatusFilter === 'completed' && !t.checked) return false
    if (taskSearchQuery.trim()) {
      const q = taskSearchQuery.trim().toLowerCase()
      return (
        t.text.toLowerCase().includes(q) ||
        t.docName.toLowerCase().includes(q) ||
        t.tags.some((tg) => tg.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <aside
      data-testid="global-tasks-panel"
      className="flex-1 min-h-0 flex flex-col border-l border-subtle bg-app select-none overflow-hidden"
    >
      {/* Header */}
      <div className="h-9 px-3 border-b border-subtle flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <CheckSquare className="w-3.5 h-3.5 text-accent" />
          <span>
            Global Tasks ({filteredTasks.length}/{globalTasks.length})
          </span>
        </div>
        <button
          type="button"
          title="Close Global Tasks Panel"
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted hover:text-primary"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-muted">Status Filter</span>
          <div className="inline-flex rounded bg-panel border border-subtle p-0.5 text-[10px]">
            {(['open', 'completed', 'all'] as const).map((status) => (
              <button
                key={status}
                type="button"
                data-testid={`tasks-filter-${status}`}
                onClick={() => setTaskStatusFilter(status)}
                className={`px-2 py-0.5 rounded capitalize font-medium ${
                  taskStatusFilter === status
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          data-testid="tasks-search-input"
          value={taskSearchQuery}
          onChange={(e) => setTaskSearchQuery(e.target.value)}
          placeholder="Filter tasks by text, note, or #tag..."
          className="w-full px-2.5 py-1.5 rounded bg-panel border border-subtle text-primary text-xs focus:outline-none focus:border-accent"
        />

        {filteredTasks.length === 0 ? (
          <div className="text-muted text-[11px] italic py-2">
            No matching tasks across workspace roots.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                data-testid={`global-task-card-${task.rootId}-${task.relativePath}-${task.lineNumber}`}
                className="p-2 rounded bg-panel border border-subtle hover:border-accent space-y-1"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    data-testid={`global-task-toggle-${task.rootId}-${task.relativePath}-${task.lineNumber}`}
                    checked={task.checked}
                    onChange={() => onToggleGlobalTask(task)}
                    className="mt-0.5 rounded border-subtle accent-[var(--color-accent)] cursor-pointer"
                  />
                  <span
                    onClick={() =>
                      onNavigateToLine(task.rootId, task.relativePath, task.lineNumber)
                    }
                    className={`flex-1 cursor-pointer hover:underline ${
                      task.checked ? 'line-through text-muted' : 'text-primary font-medium'
                    }`}
                  >
                    {task.text}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-5 text-[10px] text-muted font-mono">
                  <span>
                    {task.docName} · L{task.lineNumber}
                  </span>
                  <span>{task.rootName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
