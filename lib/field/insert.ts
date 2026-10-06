const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter ? setter.call(el, text) : (el.value = text)
}

export const insertText = (el: HTMLElement, text: string) => {
  el.focus()
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
    return
  }
  const selection = el.ownerDocument.getSelection()
  const range = el.ownerDocument.createRange()
  range.selectNodeContents(el)
  selection?.removeAllRanges()
  selection?.addRange(range)
  const inserted = el.ownerDocument.execCommand?.('insertText', false, text)
  if (!inserted) {
    el.textContent = text
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
  }
}
