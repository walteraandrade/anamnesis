import type { Limit } from '../llm/prompt'

const MAX_QUESTION = 600
const CONTROLS = 'input, textarea, select, [contenteditable="true"], button'

const clean = (text: string | null | undefined) =>
  (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[*✱]\s*$/, '')
    .replace(/\s*\((required|obrigatório)\)\s*$/i, '')
    .trim()
    .slice(0, MAX_QUESTION)

const textOf = (el: Element) => clean(el.textContent)

const escapeId = (id: string) => ('CSS' in globalThis ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&'))

const byLabelledBy = (el: HTMLElement) =>
  clean(
    (el.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' '),
  )

const byLabelFor = (el: HTMLElement) => {
  const first = 'labels' in el ? (el as HTMLInputElement).labels?.[0] : undefined
  const fromLabels = first ? textOf(first) : ''
  if (fromLabels) return fromLabels
  const forId = el.id ? el.ownerDocument.querySelector(`label[for="${escapeId(el.id)}"]`) : null
  return forId ? textOf(forId) : ''
}

const byWrappingLabel = (el: HTMLElement) => {
  const label = el.closest('label')
  if (!label) return ''
  const copy = label.cloneNode(true) as HTMLElement
  copy.querySelectorAll(CONTROLS).forEach((c) => c.remove())
  return textOf(copy)
}

const byFieldset = (el: HTMLElement) => {
  const legend = el.closest('fieldset')?.querySelector('legend')
  return legend ? textOf(legend) : ''
}

const HINT =
  /^(\(?(max(imum)?|min(imum)?|up to|at most|até|no máximo|máximo|mínimo|optional|opcional)\b.*|.*\d[\d.,]*\s*(characters|chars|words|caracteres|palavras)\b.*)$/i

const isHint = (text: string) => text.length < 80 && HINT.test(text)

const previousTexts = (node: Element) => {
  const found: string[] = []
  for (let sib = node.previousElementSibling; sib && found.length < 3; sib = sib.previousElementSibling) {
    if (sib.matches(CONTROLS) || sib.querySelector(CONTROLS)) break
    const text = textOf(sib)
    if (text && !isHint(text)) found.unshift(text)
  }
  return clean(found.join(' '))
}

const byNearbyText = (el: HTMLElement) => {
  let node: Element | null = el
  for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
    const text = previousTexts(node)
    if (text) return text
  }
  return ''
}

const STRATEGIES = [byLabelledBy, byLabelFor, byWrappingLabel, byFieldset, byNearbyText] as const

export const questionFor = (el: HTMLElement) =>
  STRATEGIES.map((strategy) => strategy(el)).find(Boolean) ||
  clean(el.getAttribute('aria-label')) ||
  clean(el.getAttribute('placeholder')) ||
  clean(el.getAttribute('name'))

const CHAR_HINT = /(\d[\d.,]*)\s*(characters|character|chars|caracteres|caractere)/i
const WORD_HINT = /(\d[\d.,]*)\s*(words|palavras)/i

const toNumber = (raw: string) => Number(raw.replace(/[.,]/g, ''))

const MAX_CONTEXT = 500

const isTooWide = (node: Element) =>
  node === node.ownerDocument.body ||
  node === node.ownerDocument.documentElement ||
  (node.textContent ?? '').length > MAX_CONTEXT

export const contextFor = (el: HTMLElement) => {
  const parent = el.parentElement
  const grand = parent?.parentElement
  const scope = grand && !isTooWide(grand) ? grand : parent && !isTooWide(parent) ? parent : null
  return scope ? textOf(scope) : ''
}

export const limitFor = (el: HTMLElement, hints: string): Limit => {
  const maxLength = (el as HTMLTextAreaElement).maxLength
  if (typeof maxLength === 'number' && maxLength > 0) return { chars: maxLength }
  const chars = hints.match(CHAR_HINT)?.[1]
  if (chars) return { chars: toNumber(chars) }
  const words = hints.match(WORD_HINT)?.[1]
  return words ? { words: toNumber(words) } : {}
}

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel', 'number'])

export const isAnswerField = (el: unknown): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) && !el.disabled && !el.readOnly
  return el.isContentEditable
}
