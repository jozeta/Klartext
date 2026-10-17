import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Globe,
  Plus,
  SlidersHorizontal,
  Tag,
  X
} from '../../components/icons/untitled-icons'
import type {
  AppSettings,
  CustomFrontmatterPropertyDef,
  FrontmatterFieldType
} from '../../../shared/types'
import {
  formatTagWithHash,
  parseTagListInput,
  stripTagHash
} from '../../../shared/markdown/dynamic-workspace'

export interface FrontmatterPropertiesPanelProps {
  activeTabKey: string | null
  frontmatter: Record<string, unknown> | null
  allDocumentContents: string[]
  settings: AppSettings
  onUpdateSettings: (partial: Partial<AppSettings>) => void
  onUpdateFrontmatterField: (key: string, value: unknown) => void
  onClose: () => void
}

const DEFAULT_FRONTMATTER_KEYS = ['title', 'author', 'date', 'tags', 'status']
const DEFAULT_STATUS_OPTIONS = [
  'Draft',
  'In Progress',
  'In Review',
  'Approved',
  'Published',
  'Archived'
]
const DEFAULT_KNOWN_TAGS = [
  '#meeting',
  '#notes',
  '#daily',
  '#rfc',
  '#security',
  '#architecture',
  '#incident',
  '#audit',
  '#todo'
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatYmd(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`
}

const MONTH_NAMES = [
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

export const FrontmatterPropertiesPanel: React.FC<FrontmatterPropertiesPanelProps> = ({
  activeTabKey,
  frontmatter,
  allDocumentContents,
  settings,
  onUpdateSettings,
  onUpdateFrontmatterField,
  onClose
}) => {
  const [customKey, setCustomKey] = useState('')
  const [customType, setCustomType] = useState<FrontmatterFieldType>('text')
  const [customIsGlobal, setCustomIsGlobal] = useState(false)

  // Popover state: which field key currently has a calendar, dropdown, or tags menu open
  const [openCalendarKey, setOpenCalendarKey] = useState<string | null>(null)
  const [calendarViewDate, setCalendarViewDate] = useState<{ year: number; month: number }>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null)
  const [newDropdownOptionText, setNewDropdownOptionText] = useState<Record<string, string>>({})
  const [editingDropdownOption, setEditingDropdownOption] = useState<{
    fieldKey: string
    originalOption: string
    draftValue: string
  } | null>(null)

  const [openTagsKey, setOpenTagsKey] = useState<string | null>(null)
  const [focusedTagKey, setFocusedTagKey] = useState<string | null>(null)
  const [tagInputDrafts, setTagInputDrafts] = useState<Record<string, string>>({})

  const panelRef = useRef<HTMLElement | null>(null)

  // Close popovers when clicking outside the panel
  useEffect(() => {
    const handleDocMouseDown = (e: MouseEvent) => {
      if (!panelRef.current) return
      const target = e.target as Node | null
      if (target && !panelRef.current.contains(target)) {
        setOpenCalendarKey(null)
        setOpenDropdownKey(null)
        setOpenTagsKey(null)
      }
    }
    window.addEventListener('mousedown', handleDocMouseDown)
    return () => window.removeEventListener('mousedown', handleDocMouseDown)
  }, [])

  const globalProperties = useMemo(
    () => settings.globalFrontmatterProperties || [],
    [settings.globalFrontmatterProperties]
  )

  const localPropertyTypes = useMemo(
    () => settings.localFrontmatterPropertyTypes || {},
    [settings.localFrontmatterPropertyTypes]
  )

  const statusOptions = useMemo(
    () =>
      Array.isArray(settings.frontmatterStatusOptions) &&
      settings.frontmatterStatusOptions.length > 0
        ? settings.frontmatterStatusOptions
        : DEFAULT_STATUS_OPTIONS,
    [settings.frontmatterStatusOptions]
  )

  // Collect all previously entered tags from settings + open documents + current frontmatter (always formatted with leading #)
  const allKnownTags = useMemo(() => {
    const initialList =
      Array.isArray(settings.frontmatterKnownTags) && settings.frontmatterKnownTags.length > 0
        ? settings.frontmatterKnownTags
        : DEFAULT_KNOWN_TAGS
    const set = new Set<string>(
      initialList.map((t) => formatTagWithHash(t)).filter(Boolean)
    )
    if (frontmatter) {
      for (const [, val] of Object.entries(frontmatter)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'string' && item.trim()) {
              for (const parsed of parseTagListInput(item)) {
                set.add(parsed)
              }
            }
          }
        }
      }
    }
    for (const content of allDocumentContents) {
      const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      if (m) {
        const tagLine = m[1].match(/tags:\s*\[([^\]]*)\]/)
        if (tagLine && tagLine[1]) {
          tagLine[1]
            .split(',')
            .map((s) => s.replace(/['"]/g, '').trim())
            .filter(Boolean)
            .forEach((t) => {
              for (const parsed of parseTagListInput(t)) {
                set.add(parsed)
              }
            })
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [settings.frontmatterKnownTags, frontmatter, allDocumentContents])

  // Merge default keys + global custom properties + current document frontmatter keys
  const allKeys = useMemo(() => {
    const existingKeys = frontmatter ? Object.keys(frontmatter) : []
    const merged = [...DEFAULT_FRONTMATTER_KEYS]
    for (const gp of globalProperties) {
      if (gp.key && !merged.includes(gp.key)) {
        merged.push(gp.key)
      }
    }
    for (const k of existingKeys) {
      if (!merged.includes(k)) {
        merged.push(k)
      }
    }
    return merged
  }, [frontmatter, globalProperties])

  // Resolve field definition (type & dropdown options) for any property key
  const getPropertyDefinition = (key: string): CustomFrontmatterPropertyDef => {
    if (key === 'date') {
      return { key: 'date', type: 'date', options: [] }
    }
    if (key === 'status') {
      return { key: 'status', type: 'dropdown', options: statusOptions }
    }
    if (key === 'tags') {
      return { key: 'tags', type: 'tags', options: [] }
    }
    const scopedKey = activeTabKey ? `${activeTabKey}::${key}` : key
    const localScoped = localPropertyTypes[scopedKey]
    if (localScoped) return localScoped
    const globalMatch = globalProperties.find((g) => g.key === key)
    if (globalMatch) return globalMatch
    const localUnscoped = localPropertyTypes[key]
    if (localUnscoped) return localUnscoped
    return { key, type: 'text', options: [] }
  }

  const updateDropdownOptionsForKey = (key: string, nextOptions: string[]) => {
    if (key === 'status') {
      onUpdateSettings({ frontmatterStatusOptions: nextOptions })
      return
    }
    const globalIdx = globalProperties.findIndex((g) => g.key === key)
    if (globalIdx >= 0) {
      const nextGlobal = globalProperties.map((g, i) =>
        i === globalIdx ? { ...g, options: nextOptions } : g
      )
      onUpdateSettings({ globalFrontmatterProperties: nextGlobal })
      return
    }
    const scopedKey = activeTabKey ? `${activeTabKey}::${key}` : key
    const existingDef = getPropertyDefinition(key)
    onUpdateSettings({
      localFrontmatterPropertyTypes: {
        ...localPropertyTypes,
        [scopedKey]: { ...existingDef, key, options: nextOptions },
        [key]: { ...existingDef, key, options: nextOptions }
      }
    })
  }

  const rememberTag = (tag: string) => {
    const clean = formatTagWithHash(tag)
    if (!clean) return
    if (!allKnownTags.includes(clean)) {
      onUpdateSettings({
        frontmatterKnownTags: [...allKnownTags, clean]
      })
    }
  }

  const handleOpenCalendarForKey = (key: string, currentStrVal: string) => {
    if (openCalendarKey === key) {
      setOpenCalendarKey(null)
      return
    }
    const parsedMatch = currentStrVal.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (parsedMatch) {
      const yr = Number(parsedMatch[1])
      const mo = Number(parsedMatch[2]) - 1
      if (!Number.isNaN(yr) && mo >= 0 && mo <= 11) {
        setCalendarViewDate({ year: yr, month: mo })
      }
    } else {
      const now = new Date()
      setCalendarViewDate({ year: now.getFullYear(), month: now.getMonth() })
    }
    setOpenCalendarKey(key)
    setOpenDropdownKey(null)
    setOpenTagsKey(null)
  }

  const renderCalendarPopover = (key: string, currentStrVal: string) => {
    const { year, month } = calendarViewDate
    const firstDayOfMonth = new Date(year, month, 1)
    // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: Array<number | null> = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    const today = new Date()
    const todayStr = formatYmd(today.getFullYear(), today.getMonth(), today.getDate())

    return (
      <div
        data-testid={`frontmatter-calendar-popover-${key}`}
        className="mt-1 p-2.5 rounded-md bg-panel border border-subtle shadow-lg z-30 space-y-2"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-primary">
          <button
            type="button"
            data-testid={`calendar-prev-month-${key}`}
            onClick={() =>
              setCalendarViewDate((prev) =>
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
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            type="button"
            data-testid={`calendar-next-month-${key}`}
            onClick={() =>
              setCalendarViewDate((prev) =>
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
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-6" />
            }
            const dateStr = formatYmd(year, month, day)
            const isSelected = currentStrVal === dateStr
            const isToday = todayStr === dateStr
            return (
              <button
                key={dateStr}
                type="button"
                data-testid={`calendar-day-${key}-${dateStr}`}
                onClick={() => {
                  onUpdateFrontmatterField(key, dateStr)
                  setOpenCalendarKey(null)
                }}
                className={`h-6 rounded flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-accent text-white font-semibold'
                    : isToday
                      ? 'border border-accent text-accent font-medium hover:bg-secondary'
                      : 'text-primary hover:bg-secondary'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-subtle text-[11px]">
          <button
            type="button"
            data-testid={`calendar-today-btn-${key}`}
            onClick={() => {
              onUpdateFrontmatterField(key, todayStr)
              setOpenCalendarKey(null)
            }}
            className="px-2 py-0.5 rounded bg-secondary text-primary hover:bg-accent hover:text-white font-medium"
          >
            Today ({todayStr})
          </button>
          <button
            type="button"
            data-testid={`calendar-clear-btn-${key}`}
            onClick={() => {
              onUpdateFrontmatterField(key, '')
              setOpenCalendarKey(null)
            }}
            className="px-2 py-0.5 rounded text-muted hover:text-danger"
          >
            Clear
          </button>
        </div>
      </div>
    )
  }

  const renderDropdownField = (
    key: string,
    strVal: string,
    options: string[]
  ) => {
    const isOpen = openDropdownKey === key
    const newItemText = newDropdownOptionText[key] || ''

    const handleAddOption = () => {
      const trimmed = newItemText.trim()
      if (!trimmed) return
      const nextOpts = options.includes(trimmed) ? options : [...options, trimmed]
      updateDropdownOptionsForKey(key, nextOpts)
      onUpdateFrontmatterField(key, trimmed)
      setNewDropdownOptionText((prev) => ({ ...prev, [key]: '' }))
    }

    return (
      <div className="relative">
        <div className="flex items-center gap-1">
          <input
            type="text"
            data-testid={`frontmatter-input-${key}`}
            placeholder={`Select or enter ${key}...`}
            value={strVal}
            onFocus={() => {
              setOpenDropdownKey(key)
              setOpenCalendarKey(null)
              setOpenTagsKey(null)
            }}
            onChange={(e) => onUpdateFrontmatterField(key, e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            title={`Toggle ${key} options`}
            data-testid={`frontmatter-dropdown-btn-${key}`}
            onClick={() => {
              setOpenDropdownKey(isOpen ? null : key)
              setOpenCalendarKey(null)
              setOpenTagsKey(null)
            }}
            className={`px-2 py-1.5 rounded border transition-colors shrink-0 ${
              isOpen
                ? 'bg-accent text-white border-accent'
                : 'bg-panel border-subtle text-muted hover:text-primary hover:border-accent'
            }`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {isOpen && (
          <div
            data-testid={`frontmatter-dropdown-menu-${key}`}
            className="mt-1 rounded-md bg-panel border border-subtle shadow-lg z-30 overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto divide-y divide-subtle/40">
              {options.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-muted">
                  No options yet. Add one below.
                </div>
              ) : (
                options.map((opt) => {
                  const isEditingThis =
                    editingDropdownOption?.fieldKey === key &&
                    editingDropdownOption?.originalOption === opt
                  const isSelected = strVal === opt

                  if (isEditingThis) {
                    return (
                      <div
                        key={opt}
                        className="flex items-center gap-1 px-2 py-1 bg-secondary/40"
                      >
                        <input
                          type="text"
                          data-testid={`frontmatter-option-edit-input-${key}-${opt}`}
                          value={editingDropdownOption.draftValue}
                          onChange={(e) =>
                            setEditingDropdownOption({
                              ...editingDropdownOption,
                              draftValue: e.target.value
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const nextName = editingDropdownOption.draftValue.trim()
                              if (nextName) {
                                const nextOpts = options.map((o) =>
                                  o === opt ? nextName : o
                                )
                                updateDropdownOptionsForKey(key, nextOpts)
                                if (strVal === opt) {
                                  onUpdateFrontmatterField(key, nextName)
                                }
                              }
                              setEditingDropdownOption(null)
                            } else if (e.key === 'Escape') {
                              setEditingDropdownOption(null)
                            }
                          }}
                          className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-panel border border-accent text-primary text-xs"
                          autoFocus
                        />
                        <button
                          type="button"
                          title="Save option name"
                          data-testid={`frontmatter-option-edit-save-${key}-${opt}`}
                          onClick={() => {
                            const nextName = editingDropdownOption.draftValue.trim()
                            if (nextName) {
                              const nextOpts = options.map((o) =>
                                o === opt ? nextName : o
                              )
                              updateDropdownOptionsForKey(key, nextOpts)
                              if (strVal === opt) {
                                onUpdateFrontmatterField(key, nextName)
                              }
                            }
                            setEditingDropdownOption(null)
                          }}
                          className="p-1 rounded bg-accent text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={opt}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-secondary/60 ${
                        isSelected ? 'bg-accent/10 text-accent font-medium' : 'text-primary'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid={`frontmatter-option-select-${key}-${opt}`}
                        onClick={() => {
                          onUpdateFrontmatterField(key, opt)
                          setOpenDropdownKey(null)
                        }}
                        className="flex-1 text-left truncate pr-2"
                      >
                        {opt}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={`Edit "${opt}"`}
                          data-testid={`frontmatter-option-edit-${key}-${opt}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingDropdownOption({
                              fieldKey: key,
                              originalOption: opt,
                              draftValue: opt
                            })
                          }}
                          className="p-0.5 rounded text-muted hover:text-primary hover:bg-secondary"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title={`Remove "${opt}"`}
                          data-testid={`frontmatter-option-remove-${key}-${opt}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            const nextOpts = options.filter((o) => o !== opt)
                            updateDropdownOptionsForKey(key, nextOpts)
                            if (strVal === opt) {
                              onUpdateFrontmatterField(key, '')
                            }
                          }}
                          className="p-0.5 rounded text-muted hover:text-danger hover:bg-secondary"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Bottom input + '+' button to add new items to the dropdown list */}
            <div className="flex items-center gap-1 p-1.5 bg-app border-t border-subtle">
              <input
                type="text"
                data-testid={`frontmatter-option-new-input-${key}`}
                placeholder={`New ${key} option...`}
                value={newItemText}
                onChange={(e) =>
                  setNewDropdownOptionText((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddOption()
                  }
                }}
                className="flex-1 min-w-0 px-2 py-1 rounded bg-panel border border-subtle text-primary text-xs focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                title="Add new option"
                data-testid={`frontmatter-option-add-btn-${key}`}
                onClick={handleAddOption}
                className="px-2 py-1 rounded bg-accent text-white hover:opacity-90 shrink-0 flex items-center justify-center"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTagsField = (key: string, rawVal: unknown, strVal: string) => {
    const currentTags: string[] = Array.isArray(rawVal)
      ? Array.from(
          new Set(
            rawVal
              .flatMap((t) => parseTagListInput(String(t ?? '')))
              .filter(Boolean)
          )
        )
      : parseTagListInput(strVal)

    const formattedTagsStr = currentTags.join(', ')
    const isFocused = focusedTagKey === key
    const displayInputValue = isFocused
      ? tagInputDrafts[key] ?? formattedTagsStr
      : formattedTagsStr

    const isOpen = openTagsKey === key

    // Filter known tags based on the last segment being typed
    const segments = displayInputValue.split(/[\s,]+/)
    const activeQuery = stripTagHash(segments[segments.length - 1] || '').toLowerCase()

    const matchingSuggestions = allKnownTags.filter((t) =>
      activeQuery ? stripTagHash(t).toLowerCase().includes(activeQuery) : true
    )

    const handleSelectSuggestedTag = (tag: string) => {
      const normalized = formatTagWithHash(tag)
      if (!normalized) return
      rememberTag(normalized)
      if (currentTags.some((t) => stripTagHash(t).toLowerCase() === stripTagHash(normalized).toLowerCase())) {
        return
      }
      const nextList = [...currentTags, normalized]
      setTagInputDrafts((prev) => ({ ...prev, [key]: nextList.join(', ') }))
      onUpdateFrontmatterField(key, nextList)
    }

    const handleRemoveTag = (tagToRemove: string) => {
      const nextList = currentTags.filter((t) => t !== tagToRemove)
      setTagInputDrafts((prev) => ({ ...prev, [key]: nextList.join(', ') }))
      onUpdateFrontmatterField(key, nextList)
    }

    return (
      <div className="space-y-1">
        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {currentTags.map((tag) => (
              <span
                key={tag}
                data-testid={`frontmatter-tag-chip-${key}-${stripTagHash(tag)}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[11px] font-medium font-mono"
              >
                <span>{formatTagWithHash(tag)}</span>
                <button
                  type="button"
                  title={`Remove tag ${formatTagWithHash(tag)}`}
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-danger"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1">
          <input
            type="text"
            data-testid={`frontmatter-input-${key}`}
            placeholder="#tag1, #tag2 or #tag1 Tag2..."
            value={displayInputValue}
            onFocus={() => {
              setFocusedTagKey(key)
              setTagInputDrafts((prev) => ({ ...prev, [key]: formattedTagsStr }))
              setOpenTagsKey(key)
              setOpenCalendarKey(null)
              setOpenDropdownKey(null)
            }}
            onChange={(e) => {
              const val = e.target.value
              setTagInputDrafts((prev) => ({ ...prev, [key]: val }))
              const parsed = parseTagListInput(val)
              onUpdateFrontmatterField(key, parsed)
              setOpenTagsKey(key)
            }}
            onBlur={() => {
              setFocusedTagKey((prev) => (prev === key ? null : prev))
              setTagInputDrafts((prev) => ({ ...prev, [key]: currentTags.join(', ') }))
              currentTags.forEach(rememberTag)
            }}
            className="flex-1 min-w-0 px-2 py-1.5 rounded bg-panel border border-subtle text-primary font-mono focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            title="Show previously used tags"
            data-testid={`frontmatter-tags-dropdown-btn-${key}`}
            onClick={() => {
              setOpenTagsKey(isOpen ? null : key)
              setOpenCalendarKey(null)
              setOpenDropdownKey(null)
            }}
            className={`px-2 py-1.5 rounded border transition-colors shrink-0 ${
              isOpen
                ? 'bg-accent text-white border-accent'
                : 'bg-panel border-subtle text-muted hover:text-primary hover:border-accent'
            }`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {isOpen && (
          <div
            data-testid={`frontmatter-tags-dropdown-${key}`}
            className="mt-1 p-1.5 rounded-md bg-panel border border-subtle shadow-lg z-30 space-y-1 max-h-40 overflow-y-auto"
          >
            <div className="text-[10px] font-semibold uppercase text-muted px-1">
              Previously Entered Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {matchingSuggestions.map((tag) => {
                const bareTag = stripTagHash(tag)
                const hashedTag = formatTagWithHash(tag)
                const isSelected = currentTags.some(
                  (t) => stripTagHash(t).toLowerCase() === bareTag.toLowerCase()
                )
                return (
                  <button
                    key={hashedTag}
                    type="button"
                    data-testid={`frontmatter-tag-suggestion-${key}-${bareTag}`}
                    onClick={() => handleSelectSuggestedTag(hashedTag)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                      isSelected
                        ? 'bg-accent text-white border-accent'
                        : 'bg-app border-subtle text-primary hover:border-accent'
                    }`}
                  >
                    <span>{hashedTag}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleAddCustomProperty = () => {
    const cleanKey = customKey.trim()
    if (!cleanKey) return

    const defaultOptions =
      customType === 'dropdown' ? ['Option 1', 'Option 2', 'Option 3'] : []

    if (customIsGlobal) {
      const existingIdx = globalProperties.findIndex((g) => g.key === cleanKey)
      const newDef: CustomFrontmatterPropertyDef = {
        key: cleanKey,
        type: customType,
        options: existingIdx >= 0 ? globalProperties[existingIdx].options : defaultOptions
      }
      const nextGlobal =
        existingIdx >= 0
          ? globalProperties.map((g, i) => (i === existingIdx ? newDef : g))
          : [...globalProperties, newDef]
      onUpdateSettings({ globalFrontmatterProperties: nextGlobal })
    } else {
      const scopedKey = activeTabKey ? `${activeTabKey}::${cleanKey}` : cleanKey
      const newDef: CustomFrontmatterPropertyDef = {
        key: cleanKey,
        type: customType,
        options: defaultOptions
      }
      onUpdateSettings({
        localFrontmatterPropertyTypes: {
          ...localPropertyTypes,
          [scopedKey]: newDef,
          [cleanKey]: newDef
        }
      })
    }

    const initialValue =
      customType === 'checkbox'
        ? false
        : customType === 'tags'
          ? []
          : customType === 'date'
            ? formatYmd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
            : ''

    onUpdateFrontmatterField(cleanKey, initialValue)
    setCustomKey('')
  }

  return (
    <aside
      ref={panelRef}
      data-testid="right-frontmatter-window"
      className="h-full w-full bg-app border-l border-subtle flex flex-col overflow-hidden select-none"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-panel border-b border-subtle text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
          <span>Frontmatter Properties</span>
        </div>
        <button
          type="button"
          title="Hide Frontmatter Window"
          data-testid="close-frontmatter-window-btn"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-secondary text-muted hover:text-primary"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {!frontmatter && (
          <div className="text-[11px] text-muted bg-panel border border-subtle rounded p-2">
            No YAML frontmatter in this document yet. Type in any field below to create it automatically.
          </div>
        )}

        {allKeys.map((key) => {
          const rawVal = frontmatter?.[key]
          const strVal = Array.isArray(rawVal)
            ? rawVal.join(', ')
            : rawVal !== undefined && rawVal !== null
              ? String(rawVal)
              : ''
          const propDef = getPropertyDefinition(key)
          const isGlobalCustom = globalProperties.some((g) => g.key === key)
          const isBuiltIn = DEFAULT_FRONTMATTER_KEYS.includes(key)

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[11px] font-medium text-muted capitalize">
                  <span>{key}</span>
                  {isGlobalCustom && (
                    <span
                      title="Global Custom Property (shown on all pages)"
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-accent/15 text-accent text-[9px] uppercase font-semibold"
                    >
                      <Globe className="w-2.5 h-2.5" />
                      Global
                    </span>
                  )}
                  {!isBuiltIn && propDef.type !== 'text' && (
                    <span className="px-1 py-0.2 rounded bg-secondary text-muted text-[9px] uppercase">
                      {propDef.type}
                    </span>
                  )}
                </label>

                {isGlobalCustom && (
                  <button
                    type="button"
                    title={`Remove global property "${key}" from all pages`}
                    data-testid={`remove-global-prop-${key}`}
                    onClick={() => {
                      onUpdateSettings({
                        globalFrontmatterProperties: globalProperties.filter(
                          (g) => g.key !== key
                        )
                      })
                    }}
                    className="text-[10px] text-muted hover:text-danger"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Render appropriate input control based on property type */}
              {propDef.type === 'date' ? (
                <div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      data-testid={`frontmatter-input-${key}`}
                      placeholder="YYYY-MM-DD"
                      value={strVal}
                      onChange={(e) => onUpdateFrontmatterField(key, e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      title="Open Calendar Date Picker"
                      data-testid={`frontmatter-date-picker-btn-${key}`}
                      onClick={() => handleOpenCalendarForKey(key, strVal)}
                      className={`px-2 py-1.5 rounded border transition-colors shrink-0 ${
                        openCalendarKey === key
                          ? 'bg-accent text-white border-accent'
                          : 'bg-panel border-subtle text-muted hover:text-primary hover:border-accent'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {openCalendarKey === key && renderCalendarPopover(key, strVal)}
                </div>
              ) : propDef.type === 'dropdown' ? (
                renderDropdownField(key, strVal, propDef.options)
              ) : propDef.type === 'tags' ? (
                renderTagsField(key, rawVal, strVal)
              ) : propDef.type === 'checkbox' ? (
                <label className="inline-flex items-center gap-2 px-2 py-1.5 rounded bg-panel border border-subtle cursor-pointer w-full">
                  <input
                    type="checkbox"
                    data-testid={`frontmatter-input-${key}`}
                    checked={rawVal === true || strVal.toLowerCase() === 'true'}
                    onChange={(e) => onUpdateFrontmatterField(key, e.target.checked)}
                    className="rounded border-subtle text-accent focus:ring-accent"
                  />
                  <span className="text-xs text-primary">
                    {rawVal === true || strVal.toLowerCase() === 'true' ? 'Enabled (true)' : 'Disabled (false)'}
                  </span>
                </label>
              ) : propDef.type === 'number' ? (
                <input
                  type="number"
                  data-testid={`frontmatter-input-${key}`}
                  placeholder={`Enter ${key}...`}
                  value={strVal}
                  onChange={(e) => {
                    const num = e.target.value === '' ? '' : Number(e.target.value)
                    onUpdateFrontmatterField(key, Number.isNaN(num) ? e.target.value : num)
                  }}
                  className="w-full px-2 py-1.5 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
                />
              ) : (
                <input
                  type="text"
                  data-testid={`frontmatter-input-${key}`}
                  placeholder={`Enter ${key}...`}
                  value={strVal}
                  onChange={(e) => onUpdateFrontmatterField(key, e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
                />
              )}
            </div>
          )
        })}

        {/* Add Custom Property Section */}
        <div className="pt-2.5 border-t border-subtle space-y-2">
          <label className="block text-[10px] font-semibold uppercase text-muted">
            Add Custom Property
          </label>

          <div className="flex gap-1">
            <input
              type="text"
              data-testid="frontmatter-custom-key-input"
              placeholder="Property key..."
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddCustomProperty()
                }
              }}
              className="flex-1 min-w-0 px-2 py-1 rounded bg-panel border border-subtle text-primary focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              title="Add Custom Property"
              data-testid="frontmatter-custom-add-btn"
              onClick={handleAddCustomProperty}
              className="px-2.5 py-1 rounded bg-accent text-white hover:opacity-90 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted shrink-0">Field Type:</label>
            <select
              data-testid="frontmatter-custom-type-select"
              value={customType}
              onChange={(e) => setCustomType(e.target.value as FrontmatterFieldType)}
              className="flex-1 min-w-0 px-2 py-1 rounded bg-panel border border-subtle text-primary text-[11px] focus:outline-none focus:border-accent"
            >
              <option value="text">Text</option>
              <option value="date">Date (Calendar Picker)</option>
              <option value="dropdown">Dropdown List</option>
              <option value="tags">Tags (Autocomplete)</option>
              <option value="number">Number</option>
              <option value="checkbox">Checkbox (Boolean)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-muted hover:text-primary cursor-pointer pt-0.5">
            <input
              type="checkbox"
              data-testid="frontmatter-custom-global-checkbox"
              checked={customIsGlobal}
              onChange={(e) => setCustomIsGlobal(e.target.checked)}
              className="rounded border-subtle text-accent focus:ring-accent"
            />
            <Globe className="w-3 h-3 text-accent shrink-0" />
            <span>Global custom property (add to all frontmatter pages)</span>
          </label>
        </div>
      </div>
    </aside>
  )
}
