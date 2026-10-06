import { describe, expect, it } from 'vitest'
import { browseOrder, filterEntries } from '../lib/stories/browse'
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

const entries = [
  entry({ id: 'f2', kind: 'fact', group: 'fact:phone', question: 'Phone', answer: '+55' }),
  entry({ id: 'b-pt', group: 'broke', lang: 'pt', question: 'Conte sobre um bug', answer: 'Em produção…' }),
  entry({
    id: 'f1',
    kind: 'fact',
    group: 'fact:salary',
    question: 'Salary expectation',
    aliases: ['Pretensão salarial'],
  }),
  entry({ id: 'a', group: 'automation', question: 'Describe an automation', answer: 'BullMQ webhooks' }),
  entry({ id: 'b-en', group: 'broke', lang: 'en', question: 'Tell us about a bug', answer: 'In production…' }),
]

describe('browseOrder', () => {
  it('lists stories by group with language variants together, then facts in file order', () => {
    expect(browseOrder(entries).map((e) => e.id)).toEqual(['a', 'b-en', 'b-pt', 'f2', 'f1'])
  })

  it('does not mutate the input', () => {
    const copy = [...entries]
    browseOrder(entries)
    expect(entries).toEqual(copy)
  })
})

describe('filterEntries', () => {
  it('filters by kind', () => {
    expect(filterEntries(entries, '', 'fact').map((e) => e.id)).toEqual(['f2', 'f1'])
  })

  it('matches every term in question, aliases or answer, ignoring case and accents', () => {
    expect(filterEntries(entries, 'pretensao', 'all').map((e) => e.id)).toEqual(['f1'])
    expect(filterEntries(entries, 'PRODUCAO', 'all').map((e) => e.id)).toEqual(['b-pt'])
    expect(filterEntries(entries, 'bullmq webhooks', 'story').map((e) => e.id)).toEqual(['a'])
    expect(filterEntries(entries, 'bullmq phone', 'all')).toEqual([])
  })
})
