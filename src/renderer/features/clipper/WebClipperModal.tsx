import React, { useState } from 'react'
import { Globe, Download, FilePlus, CornerDownLeft, X } from 'lucide-react'

interface WebClipperModalProps {
  onCreateNoteFromClip: (title: string, markdownContent: string) => Promise<void>
  onInsertIntoCurrentDocument: (markdownContent: string) => void
  onClose: () => void
}

export const WebClipperModal: React.FC<WebClipperModalProps> = ({
  onCreateNoteFromClip,
  onInsertIntoCurrentDocument,
  onClose
}) => {
  const [urlInput, setUrlInput] = useState('')
  const [clippedTitle, setClippedTitle] = useState('')
  const [clippedMarkdown, setClippedMarkdown] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFetchUrl = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      const res = await window.klartext.clipWebUrl({ url: normalizedUrl })
      setClippedTitle(res.title || 'Clipped Article')
      setClippedMarkdown(res.markdown)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-testid="web-clipper-modal"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl bg-panel border border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[84vh]"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-secondary border-b border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-primary">
              Web Clipper — Import Web Page / URL as Markdown
            </span>
          </div>
          <button
            type="button"
            data-testid="close-web-clipper-btn"
            onClick={onClose}
            className="p-1 rounded hover:bg-panel text-muted hover:text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-muted mb-1">
              Web Page or Documentation URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                data-testid="web-clipper-url-input"
                placeholder="https://example.com/docs/guide"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleFetchUrl()
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded bg-app border border-subtle text-primary font-mono text-xs focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                data-testid="web-clipper-fetch-btn"
                disabled={loading || !urlInput.trim()}
                onClick={handleFetchUrl}
                className="px-3 py-1.5 rounded bg-accent text-white font-medium flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{loading ? 'Fetching...' : 'Fetch & Convert'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              data-testid="web-clipper-error"
              className="p-2.5 rounded bg-danger/10 border border-danger text-danger text-xs"
            >
              {error}
            </div>
          )}

          {clippedMarkdown && (
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-muted mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  data-testid="web-clipper-title-input"
                  value={clippedTitle}
                  onChange={(e) => setClippedTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-app border border-subtle text-primary text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-muted mb-1">
                  Converted Markdown Preview (Editable)
                </label>
                <textarea
                  data-testid="web-clipper-preview-textarea"
                  value={clippedMarkdown}
                  onChange={(e) => setClippedMarkdown(e.target.value)}
                  rows={11}
                  className="w-full p-3 rounded bg-app border border-subtle text-primary font-mono text-xs leading-relaxed resize-y"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-2.5 bg-secondary border-t border-subtle flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-muted">
            Extracts article headings, paragraphs, code blocks, lists & links into clean local Markdown.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="web-clipper-insert-btn"
              disabled={!clippedMarkdown.trim()}
              onClick={() => {
                onInsertIntoCurrentDocument(clippedMarkdown)
                onClose()
              }}
              className="px-3 py-1.5 rounded bg-panel border border-subtle text-primary hover:border-accent flex items-center gap-1.5 disabled:opacity-40"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>Insert into Current Note</span>
            </button>
            <button
              type="button"
              data-testid="web-clipper-save-note-btn"
              disabled={!clippedMarkdown.trim()}
              onClick={async () => {
                await onCreateNoteFromClip(clippedTitle || 'Clipped-Page', clippedMarkdown)
                onClose()
              }}
              className="px-3 py-1.5 rounded bg-accent text-white font-medium flex items-center gap-1.5 disabled:opacity-40"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>Save as New Note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
