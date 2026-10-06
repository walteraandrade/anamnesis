import { describe, expect, it } from 'vitest'
import { documentsFor, normalize, rank, type Indexed } from '../lib/search/rank'
import type { Entry } from '../lib/stories/types'

const entry = (over: Partial<Entry>): Entry => ({
  id: 'x',
  file: 'x.md',
  kind: 'story',
  group: 'x',
  lang: 'en',
  question: 'q',
  aliases: [],
  answer: 'a',
  ...over,
})

const indexed = (over: Partial<Entry>, vectors: number[][]): Indexed => ({
  ...entry(over),
  vectors: vectors.map(normalize),
})

describe('rank', () => {
  const index = [
    indexed({ id: 'bug-en', group: 'bug', lang: 'en' }, [[1, 0, 0]]),
    indexed({ id: 'bug-pt', group: 'bug', lang: 'pt' }, [[0.9, 0.1, 0]]),
    indexed({ id: 'feature', group: 'feature' }, [
      [0, 1, 0],
      [0.5, 0.5, 0],
    ]),
    indexed({ id: 'salary', group: 'salary', kind: 'fact' }, [[0, 0, 1]]),
  ]

  it('orders groups by their best vector', () => {
    expect(rank(normalize([0.2, 1, 0]), index, 'en').map((m) => m.entry.id)).toEqual(['feature', 'bug-en', 'salary'])
  })

  it('returns one match per group, in the query language when available', () => {
    const [top] = rank(normalize([1, 0, 0]), index, 'pt')
    expect(top?.entry.id).toBe('bug-pt')
    expect(top?.variants.map((v) => v.id)).toEqual(['bug-en', 'bug-pt'])
    expect(top?.score).toBeCloseTo(1)
  })

  it('falls back to any variant when the language is missing', () => {
    expect(rank(normalize([0, 0, 1]), index, 'pt', 1)[0]?.entry.id).toBe('salary')
  })
})

describe('documentsFor', () => {
  it('embeds the question, each alias and the answer with its title', () => {
    const docs = documentsFor(entry({ question: 'Q', aliases: ['A1'], answer: 'x'.repeat(2000) }))
    expect(docs.map((d) => d.title)).toEqual(['none', 'none', 'Q'])
    expect(docs[2]?.text).toHaveLength(1500)
  })
})
