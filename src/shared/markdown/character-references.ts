/**
 * HTML character references, shared by the Markdown pipeline (code blocks, HTML paste) and the Web
 * Clipper. Pure string code: no DOM, so it also runs in the main process.
 */

// The basic named references; the upper-case forms are valid HTML too (old pages use `&AMP;`).
const NAMED_REFERENCES: Record<string, string> = {
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: '\u00a0'
}

/**
 * Turns the character references in serialized HTML text back into the characters they stand for:
 * decimal (`&#60;`), hex (`&#x3C;`, which rehype-stringify writes) and the basic named ones. One pass,
 * so `&#x26;lt;` becomes the text `&lt;`, not `<`. Unknown names stay as they are; code points that
 * aren't valid characters (0, surrogates, > U+10FFFF) become U+FFFD, as in the HTML spec.
 *
 * The result is plain text and must be escaped again before it is used as HTML.
 */
export function decodeCharacterReferences(text: string): string {
  return text.replace(
    /&(?:#(\d{1,8})|#[xX]([0-9a-fA-F]{1,7})|([a-zA-Z]+));/g,
    (match, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
      if (name !== undefined) {
        return Object.prototype.hasOwnProperty.call(NAMED_REFERENCES, name)
          ? NAMED_REFERENCES[name]
          : match
      }
      const codePoint = dec !== undefined ? parseInt(dec, 10) : parseInt(hex as string, 16)
      if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return '\ufffd'
      }
      return String.fromCodePoint(codePoint)
    }
  )
}
