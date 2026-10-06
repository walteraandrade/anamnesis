// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { insertText } from '../lib/field/insert'
import { contextFor, isAnswerField, limitFor, questionFor } from '../lib/field/label'

const mount = (html: string) => {
  document.body.innerHTML = html
  return document.querySelector<HTMLElement>('[data-target]')!
}

describe('questionFor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('reads aria-labelledby (Greenhouse)', () => {
    const el = mount(`
      <div class="field-wrapper">
        <label id="q1-label" for="q1">Describe a feature you shipped end to end<span aria-hidden="true">*</span></label>
        <textarea id="q1" aria-labelledby="q1-label" data-target></textarea>
      </div>`)
    expect(questionFor(el)).toBe('Describe a feature you shipped end to end')
  })

  it('reads label[for] (Ashby, Workday)', () => {
    const el = mount(`
      <label for="input-5">How did you hear about us?<abbr title="required">*</abbr></label>
      <div><textarea id="input-5" data-target></textarea></div>`)
    expect(questionFor(el)).toBe('How did you hear about us?')
  })

  it('reads a wrapping label without the control text', () => {
    const el = mount(`<label>Portfolio URL <input data-target value="x"></label>`)
    expect(questionFor(el)).toBe('Portfolio URL')
  })

  it('reads text from a sibling of an ancestor (Lever)', () => {
    const el = mount(`
      <li class="application-question">
        <div class="application-label"><div class="text">Tell us about a production incident<span class="required">✱</span></div></div>
        <div class="application-field"><textarea name="cards[abc][field0]" data-target></textarea></div>
      </li>`)
    expect(questionFor(el)).toBe('Tell us about a production incident')
  })

  it('skips length hints next to the field (Lever)', () => {
    const el = mount(`
      <li class="application-question">
        <div class="application-label"><div class="text">Describe a product you owned.<span>✱</span></div></div>
        <div class="application-field"><p>Max 600 characters</p><textarea data-target></textarea></div>
      </li>`)
    expect(questionFor(el)).toBe('Describe a product you owned.')
    expect(limitFor(el, contextFor(el))).toEqual({ chars: 600 })
  })

  it('stops at sibling controls so it does not read the previous question', () => {
    const el = mount(`
      <div>
        <p>First question</p><textarea></textarea>
        <textarea placeholder="Second" data-target></textarea>
      </div>`)
    expect(questionFor(el)).toBe('Second')
  })

  it('falls back to aria-label on contenteditable', () => {
    const el = mount(`<div contenteditable="true" aria-label="Cover letter" data-target></div>`)
    expect(questionFor(el)).toBe('Cover letter')
  })
})

describe('limitFor', () => {
  it('prefers maxlength', () => {
    const el = mount(`<textarea maxlength="300" data-target></textarea>`)
    expect(limitFor(el, 'max 500 characters')).toEqual({ chars: 300 })
  })

  it('reads hints near the field', () => {
    const el = mount(`
      <div><label for="a">Why us?</label><p>Máximo de 1.000 caracteres</p><div><textarea id="a" data-target></textarea></div></div>`)
    expect(limitFor(el, contextFor(el))).toEqual({ chars: 1000 })
    expect(limitFor(el, 'Answer in up to 150 words')).toEqual({ words: 150 })
    expect(limitFor(el, 'Why us?')).toEqual({})
  })

  it('does not read hints from the whole page', () => {
    const el = mount(`<p>Max 600 characters</p><label for="b">LinkedIn</label><input id="b" data-target>`)
    expect(contextFor(el)).toBe('')
  })
})

describe('isAnswerField', () => {
  it('accepts text fields and rejects the rest', () => {
    document.body.innerHTML = `
      <textarea id="a"></textarea><input id="b"><input id="c" type="password">
      <input id="d" type="checkbox"><textarea id="e" readonly></textarea><div id="f"></div>`
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'].filter((id) => isAnswerField(document.getElementById(id)))
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('insertText', () => {
  it('sets the value through the prototype setter so React sees the change', () => {
    const el = mount(`<textarea data-target></textarea>`) as HTMLTextAreaElement
    const protoValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
    const tracked: string[] = []
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: () => protoValue.get!.call(el),
      set: (v: string) => tracked.push(v),
    })
    const events: string[] = []
    ;['input', 'change'].forEach((type) => el.addEventListener(type, () => events.push(type)))

    insertText(el, 'Hello')

    expect(protoValue.get!.call(el)).toBe('Hello')
    expect(tracked).toEqual([])
    expect(events).toEqual(['input', 'change'])
  })

  it('replaces contenteditable content', () => {
    const el = mount(`<div contenteditable="true" data-target>old</div>`)
    insertText(el, 'new')
    expect(el.textContent).toBe('new')
  })
})
