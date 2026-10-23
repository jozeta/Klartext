import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Crosshair,
  X,
  LayoutGrid,
  PanelLeft,
  Clock,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles
} from 'lucide-react'
import {
  parseSlideDeck,
  type SlideSplitMode
} from '../../../shared/markdown/export-formats'
import { renderMarkdownDocument } from '../../../shared/markdown/pipeline'
import { renderCachedMermaidSvg } from '../diagrams/DiagramWidgets'

interface SlideDeckModalProps {
  markdown: string
  rootId: string
  documentTitle: string
  onClose: () => void
}

type PresentationThemeId = 'nordic-dark' | 'nordic-light' | 'midnight' | 'editorial'

interface PresentationThemeConfig {
  id: PresentationThemeId
  label: string
  mermaidTheme: 'dark' | 'light'
  stageBg: string
  cardBg: string
  cardBorder: string
  cardText: string
  cardMuted: string
  accentColor: string
  accentBg: string
}

const PRESENTATION_THEMES: Record<PresentationThemeId, PresentationThemeConfig> = {
  'nordic-dark': {
    id: 'nordic-dark',
    label: 'Nordic Dark',
    mermaidTheme: 'dark',
    stageBg: 'bg-[#0D1117]',
    cardBg: 'bg-[#161C23]',
    cardBorder: 'border-[#2B3643]',
    cardText: 'text-[#EEF2F6]',
    cardMuted: 'text-[#8B98A9]',
    accentColor: '#67B7D1',
    accentBg: 'from-[#67B7D1] via-[#426B79] to-[#2E4F5B]'
  },
  'nordic-light': {
    id: 'nordic-light',
    label: 'Daylight',
    mermaidTheme: 'light',
    stageBg: 'bg-[#E6ECF2]',
    cardBg: 'bg-[#FFFFFF]',
    cardBorder: 'border-[#CBD5E1]',
    cardText: 'text-[#18212B]',
    cardMuted: 'text-[#5A6877]',
    accentColor: '#3B6978',
    accentBg: 'from-[#3B6978] via-[#52899B] to-[#2C5260]'
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    mermaidTheme: 'dark',
    stageBg: 'bg-[#090B14]',
    cardBg: 'bg-gradient-to-br from-[#12172A] via-[#161D34] to-[#0F1425]',
    cardBorder: 'border-[#2D3A5E]',
    cardText: 'text-[#F1F5F9]',
    cardMuted: 'text-[#94A3B8]',
    accentColor: '#818CF8',
    accentBg: 'from-[#818CF8] via-[#6366F1] to-[#38BDF8]'
  },
  editorial: {
    id: 'editorial',
    label: 'Warm Paper',
    mermaidTheme: 'light',
    stageBg: 'bg-[#E5E0D8]',
    cardBg: 'bg-[#FAF7F2]',
    cardBorder: 'border-[#D6CFC2]',
    cardText: 'text-[#231F1C]',
    cardMuted: 'text-[#6E665E]',
    accentColor: '#9C4221',
    accentBg: 'from-[#9C4221] via-[#C05621] to-[#7B341E]'
  }
}

export const SlideDeckModal: React.FC<SlideDeckModalProps> = ({
  markdown,
  rootId,
  documentTitle,
  onClose
}) => {
  const [splitMode, setSplitMode] = useState<SlideSplitMode>('auto')
  const slides = useMemo(() => parseSlideDeck(markdown, splitMode), [markdown, splitMode])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [slideHtml, setSlideHtml] = useState('')
  const [showFilmstrip, setShowFilmstrip] = useState(() => slides.length > 1)
  const [showGridOverview, setShowGridOverview] = useState(false)
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false)
  const [laserPointerActive, setLaserPointerActive] = useState(false)
  const [laserCoords, setLaserCoords] = useState<{ x: number; y: number } | null>(null)
  const [slideThemeId, setSlideThemeId] = useState<PresentationThemeId>(() =>
    document.documentElement.getAttribute('data-theme') === 'light'
      ? 'nordic-light'
      : 'nordic-dark'
  )
  const [fontScale, setFontScale] = useState<number>(100)
  const [wideStage, setWideStage] = useState<boolean>(false)

  // Presentation elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(true)

  const filmstripItemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const slideScrollContainerRef = useRef<HTMLDivElement | null>(null)

  const safeIndex = Math.min(currentIndex, Math.max(0, slides.length - 1))
  const activeSlide = slides[safeIndex] || slides[0]
  const nextSlide = safeIndex + 1 < slides.length ? slides[safeIndex + 1] : null
  const themeConfig = PRESENTATION_THEMES[slideThemeId]

  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(Math.max(0, slides.length - 1))
    }
  }, [slides.length, currentIndex])

  // Scroll active filmstrip thumbnail into view and reset slide scroll position on slide change
  useEffect(() => {
    const btn = filmstripItemRefs.current[safeIndex]
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    if (slideScrollContainerRef.current) {
      slideScrollContainerRef.current.scrollTop = 0
    }
  }, [safeIndex])

  // Render active slide Markdown + hydrate any Mermaid diagrams inline
  useEffect(() => {
    let cancelled = false
    async function renderSlideWithDiagrams() {
      const res = await renderMarkdownDocument(activeSlide.markdown, { rootId })
      if (cancelled) return

      let finalHtml = res.html
      if (res.mermaidBlocks.length > 0) {
        for (const block of res.mermaidBlocks) {
          try {
            const svg = await renderCachedMermaidSvg(
              block.code,
              themeConfig.mermaidTheme,
              themeConfig.mermaidTheme === 'dark' ? 'dark' : 'neutral'
            )
            const placeholderRegex = new RegExp(
              `<div class="klartext-mermaid-placeholder" data-mermaid-index="${block.index}"[^>]*></div>`,
              'g'
            )
            finalHtml = finalHtml.replace(
              placeholderRegex,
              `<div class="klartext-slide-mermaid" data-testid="slide-mermaid-diagram">${svg}</div>`
            )
          } catch {
            // Keep fallback code block if diagram syntax is incomplete
          }
        }
      }
      if (!cancelled) {
        setSlideHtml(finalHtml)
      }
    }
    void renderSlideWithDiagrams()
    return () => {
      cancelled = true
    }
  }, [activeSlide.markdown, rootId, themeConfig.mermaidTheme])

  // Elapsed presentation timer
  useEffect(() => {
    if (!timerRunning) return
    const timer = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timerRunning])

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showGridOverview) {
          setShowGridOverview(false)
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        setShowGridOverview(false)
        setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setShowGridOverview(false)
        setCurrentIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentIndex(Math.max(0, slides.length - 1))
      } else if (e.key.toLowerCase() === 's') {
        setShowSpeakerNotes((v) => !v)
      } else if (e.key.toLowerCase() === 'l') {
        setLaserPointerActive((v) => !v)
      } else if (e.key.toLowerCase() === 'g') {
        setShowGridOverview((v) => !v)
      } else if (e.key.toLowerCase() === 'o') {
        setShowFilmstrip((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [slides.length, showGridOverview, onClose])

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const cleanDocTitle = documentTitle.replace(/\.md$/i, '')

  return (
    <div
      data-testid="slide-deck-modal"
      onMouseMove={(e) => {
        if (laserPointerActive) {
          setLaserCoords({ x: e.clientX, y: e.clientY })
        }
      }}
      className="fixed inset-0 z-50 bg-[#0B0E14] text-primary flex flex-col select-none"
    >
      {/* Top Studio Controls Bar */}
      <div className="h-12 px-4 bg-panel border-b border-subtle flex items-center justify-between gap-3 shrink-0">
        {/* Left: Filmstrip Toggle, Grid Toggle, Title & Slide Counter */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            data-testid="slide-filmstrip-toggle-btn"
            onClick={() => setShowFilmstrip((v) => !v)}
            title="Toggle Slide Filmstrip Sidebar (O)"
            className={`px-2 py-1 rounded border text-xs flex items-center gap-1.5 transition-colors ${
              showFilmstrip
                ? 'bg-accent/15 border-accent text-accent font-medium'
                : 'bg-secondary border-subtle text-muted hover:text-primary'
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Slides</span>
          </button>

          <button
            type="button"
            data-testid="slide-grid-overview-btn"
            onClick={() => setShowGridOverview((v) => !v)}
            title="Toggle Slide Grid Overview (G)"
            className={`px-2 py-1 rounded border text-xs flex items-center gap-1.5 transition-colors ${
              showGridOverview
                ? 'bg-accent text-white border-accent font-medium'
                : 'bg-secondary border-subtle text-muted hover:text-primary'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Grid (G)</span>
          </button>

          <span className="h-4 w-px bg-subtle mx-0.5" />

          <Presentation className="w-4 h-4 text-accent shrink-0" />
          <span className="font-semibold text-xs text-primary truncate max-w-[180px]">
            {cleanDocTitle}
          </span>
          <span
            data-testid="slide-counter"
            className="px-2.5 py-0.5 rounded-full bg-secondary border border-subtle text-[11px] font-mono text-accent shrink-0"
          >
            Slide {safeIndex + 1} / {slides.length}
          </span>
        </div>

        {/* Center: Split Mode Selector, Theme Selector & Scale */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center bg-secondary border border-subtle rounded p-0.5 text-[11px]">
            <span className="px-2 text-[10px] uppercase tracking-wider text-muted font-semibold">
              Split:
            </span>
            {(
              [
                { id: 'auto', label: 'Smart Auto' },
                { id: 'hr', label: '--- Rules' },
                { id: 'h1-h2', label: 'H1 / H2' },
                { id: 'all-headings', label: 'H1–H3' }
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-testid={`slide-split-mode-${mode.id}`}
                onClick={() => {
                  setSplitMode(mode.id)
                  setCurrentIndex(0)
                }}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  splitMode === mode.id
                    ? 'bg-accent text-white font-medium shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Theme Selector */}
          <div className="flex items-center bg-secondary border border-subtle rounded p-0.5 text-[11px]">
            {(Object.values(PRESENTATION_THEMES) as PresentationThemeConfig[]).map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`slide-theme-${t.id}`}
                onClick={() => setSlideThemeId(t.id)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  slideThemeId === t.id
                    ? 'bg-panel text-primary font-medium border border-subtle shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Font Scale & Stage Fit */}
          <div className="flex items-center bg-secondary border border-subtle rounded p-0.5 text-[11px]">
            <button
              type="button"
              title="Decrease Slide Text Scale"
              onClick={() => setFontScale((s) => Math.max(75, s - 10))}
              className="px-1.5 py-0.5 rounded text-muted hover:text-primary font-mono"
            >
              A-
            </button>
            <button
              type="button"
              title="Reset Slide Text Scale"
              onClick={() => setFontScale(100)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-primary"
            >
              {fontScale}%
            </button>
            <button
              type="button"
              title="Increase Slide Text Scale"
              onClick={() => setFontScale((s) => Math.min(150, s + 10))}
              className="px-1.5 py-0.5 rounded text-muted hover:text-primary font-mono"
            >
              A+
            </button>
            <span className="h-3 w-px bg-subtle mx-0.5" />
            <button
              type="button"
              title={wideStage ? 'Switch to 16:9 Stage' : 'Expand Slide to Wide Stage'}
              onClick={() => setWideStage((v) => !v)}
              className="px-1.5 py-0.5 rounded text-muted hover:text-primary"
            >
              {wideStage ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Right: Timer, Navigation, Speaker Notes, Laser Pointer, Exit */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Elapsed Presentation Timer */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-secondary border border-subtle text-[11px] font-mono text-muted">
            <Clock className="w-3 h-3 text-accent" />
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              title={timerRunning ? 'Pause Timer' : 'Resume Timer'}
              className="hover:text-primary"
            >
              {formatTimer(elapsedSeconds)}
            </button>
            <button
              type="button"
              onClick={() => setElapsedSeconds(0)}
              title="Reset Presentation Timer"
              className="hover:text-primary ml-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>

          <button
            type="button"
            data-testid="slide-prev-btn"
            disabled={safeIndex === 0}
            onClick={() => {
              setShowGridOverview(false)
              setCurrentIndex((i) => Math.max(0, i - 1))
            }}
            className="px-2.5 py-1 rounded bg-secondary border border-subtle text-xs text-primary hover:border-accent disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev (←)</span>
          </button>
          <button
            type="button"
            data-testid="slide-next-btn"
            disabled={safeIndex >= slides.length - 1}
            onClick={() => {
              setShowGridOverview(false)
              setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))
            }}
            className="px-2.5 py-1 rounded bg-secondary border border-subtle text-xs text-primary hover:border-accent disabled:opacity-40 flex items-center gap-1"
          >
            <span>Next (→)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-subtle mx-0.5" />

          <button
            type="button"
            data-testid="slide-speaker-notes-btn"
            onClick={() => setShowSpeakerNotes((v) => !v)}
            className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 ${
              showSpeakerNotes
                ? 'bg-accent text-white border-accent'
                : 'bg-secondary border-subtle text-primary hover:border-accent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Speaker Notes (S)</span>
          </button>

          <button
            type="button"
            data-testid="slide-laser-pointer-btn"
            onClick={() => {
              setLaserPointerActive((v) => {
                const next = !v
                if (next && !laserCoords) {
                  setLaserCoords({ x: 480, y: 320 })
                }
                return next
              })
            }}
            className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 ${
              laserPointerActive
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-secondary border-subtle text-primary hover:border-accent'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Laser Pointer (L)</span>
          </button>

          <button
            type="button"
            data-testid="slide-close-btn"
            onClick={onClose}
            className="ml-1 px-2.5 py-1 rounded bg-secondary border border-subtle text-xs text-muted hover:text-primary flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit (Esc)</span>
          </button>
        </div>
      </div>

      {/* Main Studio Workspace: Filmstrip Sidebar + Stage / Grid Overview + Speaker Notes */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Slide Filmstrip Navigator */}
        {showFilmstrip && !showGridOverview && (
          <aside
            data-testid="slide-filmstrip-sidebar"
            className="w-60 bg-panel border-r border-subtle flex flex-col shrink-0 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-subtle flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span>Slide Navigator ({slides.length})</span>
              <span className="font-mono text-[10px] text-accent">{splitMode}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {slides.map((s, idx) => {
                const isSelected = idx === safeIndex
                return (
                  <button
                    key={idx}
                    ref={(el) => {
                      filmstripItemRefs.current[idx] = el
                    }}
                    type="button"
                    data-testid={`slide-thumbnail-${idx}`}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-full text-left rounded-lg p-2.5 border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-accent/15 border-accent shadow-sm ring-1 ring-accent/40'
                        : 'bg-secondary/50 border-subtle hover:border-accent/50 hover:bg-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-accent text-white'
                            : 'bg-panel text-muted border border-subtle'
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] font-mono text-muted">
                        {s.hasMermaid && (
                          <span
                            title="Contains Mermaid Diagram"
                            className="px-1 py-0.2 rounded bg-accent/15 text-accent"
                          >
                            ◇
                          </span>
                        )}
                        {s.hasTable && (
                          <span
                            title="Contains Table"
                            className="px-1 py-0.2 rounded bg-panel border border-subtle"
                          >
                            ⊞
                          </span>
                        )}
                        {s.hasCode && (
                          <span
                            title="Contains Code Block"
                            className="px-1 py-0.2 rounded bg-panel border border-subtle"
                          >
                            &lt;/&gt;
                          </span>
                        )}
                        {s.hasImage && (
                          <span
                            title="Contains Image"
                            className="px-1 py-0.2 rounded bg-panel border border-subtle"
                          >
                            🖼
                          </span>
                        )}
                        {s.speakerNotes && (
                          <span
                            title="Has Speaker Notes"
                            className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400"
                          >
                            🗒
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-primary line-clamp-2 leading-snug">
                      {s.title}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        )}

        {/* Center Stage or Grid Overview */}
        {showGridOverview ? (
          <div
            data-testid="slide-grid-overview"
            className={`flex-1 overflow-y-auto p-8 ${themeConfig.stageBg}`}
          >
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-accent" />
                    <span>Slide Deck Overview — {cleanDocTitle}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any slide card to jump directly into presentation stage ({slides.length}{' '}
                    slides total)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGridOverview(false)}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium"
                >
                  Return to Stage (G)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {slides.map((s, idx) => {
                  const isCurrent = idx === safeIndex
                  const previewSnippet = s.markdown
                    .replace(/^#{1,6}\s+.+$/gm, '')
                    .replace(/```[\s\S]*?```/g, '[Diagram / Code Block]')
                    .trim()
                    .slice(0, 180)
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`slide-grid-card-${idx}`}
                      onClick={() => {
                        setCurrentIndex(idx)
                        setShowGridOverview(false)
                      }}
                      className={`text-left rounded-xl p-5 border transition-all flex flex-col justify-between h-48 ${
                        themeConfig.cardBg
                      } ${themeConfig.cardText} ${
                        isCurrent
                          ? 'ring-2 ring-accent border-accent shadow-xl scale-[1.01]'
                          : `${themeConfig.cardBorder} hover:border-accent/60 shadow-lg`
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider opacity-70">
                            Slide {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex items-center gap-1 text-[10px]">
                            {s.hasMermaid && (
                              <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-mono">
                                Diagram
                              </span>
                            )}
                            {s.hasTable && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-500/20 font-mono">
                                Table
                              </span>
                            )}
                            {s.speakerNotes && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                                Notes
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-base font-bold line-clamp-2 mb-2">{s.title}</div>
                        <p className={`text-xs line-clamp-3 ${themeConfig.cardMuted}`}>
                          {previewSnippet || 'Title / Cover Slide'}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] opacity-60 font-mono">
                        <span>{cleanDocTitle}</span>
                        <span>
                          {idx + 1} / {slides.length}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`flex-1 flex items-center justify-center p-6 md:p-10 overflow-hidden relative ${
              themeConfig.stageBg
            } ${laserPointerActive ? 'cursor-none' : ''}`}
          >
            {/* Subtle Left Stage Hover Paddle */}
            {safeIndex > 0 && (
              <button
                type="button"
                aria-label="Previous Slide"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/30 hover:bg-black/60 text-white/60 hover:text-white border border-white/10 transition-all opacity-0 hover:opacity-100 focus:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Subtle Right Stage Hover Paddle */}
            {safeIndex < slides.length - 1 && (
              <button
                type="button"
                aria-label="Next Slide"
                onClick={() => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/30 hover:bg-black/60 text-white/60 hover:text-white border border-white/10 transition-all opacity-0 hover:opacity-100 focus:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* 16:9 Presentation Stage Card */}
            <div
              data-testid="slide-stage-card"
              className={`w-full ${
                wideStage ? 'max-w-[92vw] h-[84vh]' : 'max-w-5xl h-[78vh]'
              } rounded-2xl ${themeConfig.cardBg} border ${
                themeConfig.cardBorder
              } ${themeConfig.cardText} shadow-[0_25px_70px_-15px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden transition-all duration-200`}
            >
              {/* Top Decorative Accent Gradient Bar */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${themeConfig.accentBg} shrink-0`} />

              {/* Subtle Slide Header Metadata Bar */}
              <div
                className={`px-10 pt-5 pb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest ${themeConfig.cardMuted} shrink-0`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Sparkles className="w-3 h-3 opacity-75" />
                  <span>{cleanDocTitle}</span>
                </span>
                <span>
                  {String(safeIndex + 1).padStart(2, '0')} /{' '}
                  {String(slides.length).padStart(2, '0')}
                </span>
              </div>

              {/* Scrollable Slide Body Content */}
              <div
                ref={slideScrollContainerRef}
                className={`flex-1 overflow-y-auto px-10 md:px-14 py-6 flex flex-col ${
                  activeSlide.layout === 'cover' ? 'justify-center text-center' : 'justify-start'
                }`}
              >
                <div
                  data-testid="slide-rendered-content"
                  style={{ fontSize: `${(fontScale / 100) * 1.12}rem` }}
                  className="klartext-preview-body klartext-slide-typography select-text"
                  dangerouslySetInnerHTML={{ __html: slideHtml }}
                />
              </div>

              {/* Slide Footer Bar */}
              <div
                className={`px-10 py-3 border-t border-slate-500/15 flex items-center justify-between text-[11px] ${themeConfig.cardMuted} shrink-0`}
              >
                <span className="truncate max-w-md font-medium">{activeSlide.title}</span>
                <div className="flex items-center gap-3 font-mono text-[10px]">
                  {activeSlide.speakerNotes && (
                    <span className="text-amber-500 flex items-center gap-1">
                      ● Speaker Notes Available
                    </span>
                  )}
                  <span>
                    Slide {safeIndex + 1} of {slides.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Speaker Notes & Presenter View Drawer */}
        {showSpeakerNotes && (
          <div
            data-testid="slide-speaker-notes-panel"
            className="w-80 bg-panel border-l border-subtle p-4 flex flex-col gap-3 shrink-0"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-accent">
                Speaker Notes — Slide {safeIndex + 1}
              </div>
              <span className="text-[10px] font-mono text-muted">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
            <div className="text-xs text-primary whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto bg-secondary/40 rounded-lg p-3.5 border border-subtle">
              {activeSlide.speakerNotes ||
                'No speaker notes on this slide.\n\nTip: Add "Note: ..." or "<!-- note: ... -->" inside a slide section to display presenter talking points here.'}
            </div>

            {/* Presenter View: Up Next Preview Card */}
            <div className="border-t border-subtle pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                Up Next
              </div>
              {nextSlide ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(safeIndex + 1)}
                  className="w-full text-left p-2.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-subtle transition-colors"
                >
                  <div className="text-[10px] font-mono text-accent mb-0.5">
                    Slide {safeIndex + 2} / {slides.length}
                  </div>
                  <div className="text-xs font-semibold text-primary truncate">
                    {nextSlide.title}
                  </div>
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-secondary/30 border border-subtle text-[11px] text-muted italic">
                  End of presentation deck
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Interactive Slide Scrubber & Shortcut Legend */}
      <div className="h-8 px-4 bg-panel border-t border-subtle flex items-center justify-between gap-4 text-[11px] text-muted shrink-0">
        {/* Interactive Segment Scrubber */}
        <div className="flex-1 flex items-center gap-1 max-w-xl">
          {slides.map((s, idx) => (
            <button
              key={idx}
              type="button"
              title={`Jump to Slide ${idx + 1}: ${s.title}`}
              onClick={() => {
                setShowGridOverview(false)
                setCurrentIndex(idx)
              }}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                idx === safeIndex
                  ? 'bg-accent h-2'
                  : idx < safeIndex
                    ? 'bg-accent/45 hover:bg-accent/75'
                    : 'bg-secondary hover:bg-subtle'
              }`}
            />
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-muted">
          <span>←/→/Space: Navigate</span>
          <span>O: Filmstrip</span>
          <span>G: Grid</span>
          <span>S: Notes</span>
          <span>L: Laser</span>
          <span>Esc: Exit</span>
        </div>
      </div>

      {/* Laser Pointer Glowing Red Dot */}
      {laserPointerActive && laserCoords && (
        <div
          data-testid="slide-laser-dot"
          style={{
            left: `${laserCoords.x - 8}px`,
            top: `${laserCoords.y - 8}px`,
            boxShadow: '0 0 18px 7px rgba(239, 68, 68, 0.8)'
          }}
          className="fixed w-4 h-4 rounded-full bg-red-500 pointer-events-none z-50"
        />
      )}
    </div>
  )
}
