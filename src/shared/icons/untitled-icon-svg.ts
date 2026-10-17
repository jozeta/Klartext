import * as UntitledIcons from '@untitledui/icons'

const ICON_LOOKUP = new Map<string, (props: Record<string, unknown>) => unknown>()

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase()
}

for (const [key, val] of Object.entries(UntitledIcons)) {
  if (/^[A-Z]/.test(key) && typeof val === 'function') {
    const fn = val as (props: Record<string, unknown>) => unknown
    ICON_LOOKUP.set(key.toLowerCase(), fn)
    ICON_LOOKUP.set(toKebabCase(key).toLowerCase(), fn)
  }
}
if (typeof UntitledIcons.Stars01 === 'function') {
  ICON_LOOKUP.set('sparkles', UntitledIcons.Stars01 as (props: Record<string, unknown>) => unknown)
}

function reactElToSvgHtml(el: unknown): string {
  if (!el || typeof el !== 'object') return ''
  const node = el as { type?: string; props?: Record<string, unknown> }
  if (typeof node.type !== 'string') return ''
  const props = node.props || {}
  const attrs = Object.entries(props)
    .filter(([k, v]) => k !== 'children' && v !== undefined && v !== null)
    .map(([k, v]) => {
      const attrName =
        k === 'className'
          ? 'class'
          : k === 'viewBox'
            ? 'viewBox'
            : k.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      return `${attrName}="${String(v).replace(/"/g, '&quot;')}"`
    })
    .join(' ')
  const rawChildren = props.children
  const childrenHtml = Array.isArray(rawChildren)
    ? rawChildren.map(reactElToSvgHtml).join('')
    : reactElToSvgHtml(rawChildren)
  return `<${node.type}${attrs ? ` ${attrs}` : ''}>${childrenHtml}</${node.type}>`
}

export function renderUntitledIconToSvgHtml(nameOrSlug: string, size = 16): string | null {
  const clean = nameOrSlug.trim().toLowerCase()
  if (!clean) return null
  const normalized = clean.replace(/[-_\s]+/g, '')
  const fn =
    ICON_LOOKUP.get(clean) ||
    ICON_LOOKUP.get(normalized) ||
    ICON_LOOKUP.get(`${clean}-01`) ||
    ICON_LOOKUP.get(`${normalized}01`)
  if (!fn) return null
  try {
    const el = fn({
      width: size,
      height: size,
      className: 'klartext-inline-icon',
      'data-untitled-icon': nameOrSlug.trim()
    })
    return reactElToSvgHtml(el) || null
  } catch {
    return null
  }
}

export const renderUntitledIconSvgHtml = renderUntitledIconToSvgHtml

