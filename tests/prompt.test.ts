import { describe, expect, it } from 'vitest'
import { adaptMessages, newNumbers, overLimit, stripThinking } from '../lib/llm/prompt'

describe('adaptMessages', () => {
  const messages = adaptMessages({
    question: 'Describe a bug',
    answer: 'It broke.',
    lang: 'pt',
    limit: { chars: 500 },
    mode: 'fit',
  })

  it('puts the rules in the system message', () => {
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('at most 500 characters')
    expect(messages[0]?.content).toContain('Brazilian Portuguese')
    expect(messages[0]?.content).toContain('Never add companies')
  })

  it('sends the question and the source answer', () => {
    expect(messages[1]?.content).toBe('Question:\nDescribe a bug\n\nSource answer:\nIt broke.')
  })
})

describe('newNumbers', () => {
  const source = 'Ingestion went from 2.3 GB to 78.7 GB, about 16,400 spans; cost US$340–430.'

  it('accepts numbers that exist in the source, in any thousands format', () => {
    expect(newNumbers(source, 'From 2,3 GB to 78.7 GB and 16.400 spans, US$340.')).toEqual([])
  })

  it('flags numbers the model invented', () => {
    expect(newNumbers(source, 'Saved 90% and 12 hours, from 2.3 GB.')).toEqual(['90', '12'])
  })
})

describe('overLimit', () => {
  it('checks characters or words', () => {
    expect(overLimit('abcdef', { chars: 5 })).toBe(true)
    expect(overLimit('one two three', { words: 3 })).toBe(false)
    expect(overLimit('anything', {})).toBe(false)
  })
})

describe('stripThinking', () => {
  it('removes closed and unclosed think blocks', () => {
    expect(stripThinking('<think>hmm</think>\nAnswer')).toBe('Answer')
    expect(stripThinking('<think>still going')).toBe('')
  })
})
