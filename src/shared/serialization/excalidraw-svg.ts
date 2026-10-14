export interface ExcalidrawElementItem {
  id: string
  type: 'rectangle' | 'ellipse' | 'arrow' | 'text'
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  backgroundColor: string
  text?: string
}

export interface ExcalidrawSceneData {
  type: 'excalidraw'
  version: number
  source: string
  elements: ExcalidrawElementItem[]
  appState: {
    viewBackgroundColor: string
    theme?: 'light' | 'dark'
  }
}

const EXCALIDRAW_METADATA_TAG = 'klartext-excalidraw-scene'

export function createDefaultExcalidrawScene(theme: 'light' | 'dark' = 'light'): ExcalidrawSceneData {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://klartext.local',
    elements: [
      {
        id: 'node-1',
        type: 'rectangle',
        x: 60,
        y: 60,
        width: 180,
        height: 76,
        strokeColor: theme === 'dark' ? '#8AB6C3' : '#426B79',
        backgroundColor: theme === 'dark' ? '#202428' : '#EEF1F3',
        text: 'Architecture Node'
      },
      {
        id: 'node-2',
        type: 'rectangle',
        x: 310,
        y: 60,
        width: 180,
        height: 76,
        strokeColor: theme === 'dark' ? '#6BAF89' : '#3B7A57',
        backgroundColor: theme === 'dark' ? '#202428' : '#FFFFFF',
        text: 'Local First Store'
      }
    ],
    appState: {
      viewBackgroundColor: theme === 'dark' ? '#171A1D' : '#FFFFFF',
      theme
    }
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function utf8ToBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64')
  }
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUtf8(b64: string): string {
  const clean = b64.replace(/\s+/g, '')
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(clean, 'base64').toString('utf-8')
  }
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export function serializeExcalidrawSvg(scene: ExcalidrawSceneData): string {
  const jsonPayload = JSON.stringify(scene)
  const encodedBase64 = utf8ToBase64(jsonPayload)

  const shapesSvg = scene.elements
    .map((el) => {
      if (el.type === 'ellipse') {
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        return `<g data-element-id="${escapeXml(el.id)}">
          <ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(el.width / 2)}" ry="${Math.abs(el.height / 2)}" fill="${escapeXml(el.backgroundColor)}" stroke="${escapeXml(el.strokeColor)}" stroke-width="2" />
          ${el.text ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="${escapeXml(el.strokeColor)}" font-family="Inter, sans-serif" font-size="13">${escapeXml(el.text)}</text>` : ''}
        </g>`
      }
      if (el.type === 'arrow') {
        return `<g data-element-id="${escapeXml(el.id)}">
          <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${escapeXml(el.strokeColor)}" stroke-width="2" />
        </g>`
      }
      if (el.type === 'text') {
        return `<g data-element-id="${escapeXml(el.id)}">
          <text x="${el.x}" y="${el.y + 16}" fill="${escapeXml(el.strokeColor)}" font-family="Inter, sans-serif" font-size="14">${escapeXml(el.text || '')}</text>
        </g>`
      }
      // rectangle default
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      return `<g data-element-id="${escapeXml(el.id)}">
        <rect x="${el.x}" y="${el.y}" width="${Math.max(10, el.width)}" height="${Math.max(10, el.height)}" rx="6" fill="${escapeXml(el.backgroundColor)}" stroke="${escapeXml(el.strokeColor)}" stroke-width="2" />
        ${el.text ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="${escapeXml(el.strokeColor)}" font-family="Inter, sans-serif" font-size="13">${escapeXml(el.text)}</text>` : ''}
      </g>`
    })
    .join('\n  ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 260" width="100%" height="260">
  <metadata>
    <${EXCALIDRAW_METADATA_TAG} encoding="base64">${encodedBase64}</${EXCALIDRAW_METADATA_TAG}>
  </metadata>
  <rect width="100%" height="100%" rx="8" fill="${escapeXml(scene.appState.viewBackgroundColor || '#FFFFFF')}" />
  ${shapesSvg}
</svg>`
}

export function extractExcalidrawSceneFromSvgOrJson(rawContent: string): ExcalidrawSceneData | null {
  const trimmed = rawContent.trim()
  if (!trimmed) return null

  // Direct JSON (.excalidraw)
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && parsed.type === 'excalidraw' && Array.isArray(parsed.elements)) {
        return parsed as ExcalidrawSceneData
      }
    } catch {
      return null
    }
  }

  // Embedded in .excalidraw.svg metadata
  const regex = new RegExp(
    `<${EXCALIDRAW_METADATA_TAG}[^>]*>([A-Za-z0-9+/=\\s]+)<\\/${EXCALIDRAW_METADATA_TAG}>`,
    'i'
  )
  const match = trimmed.match(regex)
  if (!match) return null

  try {
    const decoded = base64ToUtf8(match[1])
    const parsed = JSON.parse(decoded)
    if (parsed && parsed.type === 'excalidraw' && Array.isArray(parsed.elements)) {
      return parsed as ExcalidrawSceneData
    }
  } catch {
    return null
  }
  return null
}

export function sanitizeSvgContent(svgString: string): string {
  return svgString
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']\s*(javascript|vbscript|data:text\/html):[^"']*["']/gi, '')
}
