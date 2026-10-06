import { insertText } from '@/lib/field/insert'
import { contextFor, isAnswerField, limitFor, questionFor } from '@/lib/field/label'
import type { FieldInfo, ToContent, ToPanel } from '@/lib/messages'

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    const fields = new Map<string, WeakRef<HTMLElement>>()
    const ids = new WeakMap<HTMLElement, string>()
    let last: HTMLElement | undefined

    const idFor = (el: HTMLElement) => {
      const known = ids.get(el)
      if (known) return known
      const id = crypto.randomUUID()
      ids.set(el, id)
      fields.set(id, new WeakRef(el))
      return id
    }

    const kindOf = (el: HTMLElement): FieldInfo['kind'] =>
      el instanceof HTMLTextAreaElement ? 'textarea' : el instanceof HTMLInputElement ? 'input' : 'rich'

    const describe = (el: HTMLElement): FieldInfo => {
      const question = questionFor(el)
      return {
        id: idFor(el),
        question,
        limit: limitFor(el, `${question} ${contextFor(el)}`),
        kind: kindOf(el),
        pageLang: document.documentElement.lang ?? '',
        site: location.hostname,
      }
    }

    const announce = (el: HTMLElement) =>
      browser.runtime.sendMessage({ type: 'field:focus', field: describe(el) } satisfies ToPanel).catch(() => undefined)

    const deepActive = (root: Document | ShadowRoot): Element | null => {
      const active = root.activeElement
      return active?.shadowRoot ? (deepActive(active.shadowRoot) ?? active) : active
    }

    document.addEventListener(
      'focusin',
      (event) => {
        const target = event.composedPath()[0]
        if (!isAnswerField(target)) return
        last = target
        announce(target)
      },
      true,
    )

    browser.runtime.onMessage.addListener((message: ToContent) => {
      if (message.type === 'field:announce') {
        if (last?.isConnected && deepActive(document) === last) announce(last)
        return
      }
      if (message.type === 'field:insert') {
        const el = fields.get(message.id)?.deref()
        if (!el?.isConnected) return Promise.resolve(false)
        insertText(el, message.text)
        return Promise.resolve(true)
      }
    })
  },
})
