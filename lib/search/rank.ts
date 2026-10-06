import type { Entry, Lang } from '../stories/types'

export type Indexed = Entry & { vectors: number[][] }
export type Match = { entry: Entry; score: number; variants: Entry[] }

export const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0)

export const normalize = (v: number[]) => {
  const norm = Math.sqrt(dot(v, v)) || 1
  return v.map((value) => value / norm)
}

const bestScore = (query: number[], entry: Indexed) => Math.max(...entry.vectors.map((v) => dot(query, v)))

const pickVariant = (variants: Entry[], lang: Lang) => variants.find((v) => v.lang === lang) ?? variants[0]

export const rank = (query: number[], index: Indexed[], lang: Lang, limit = 3): Match[] => {
  const scored = index.map((entry) => ({ entry, score: bestScore(query, entry) }))
  const groups = Map.groupBy(scored, ({ entry }) => entry.group)
  return [...groups.values()]
    .flatMap((members) => {
      const variants = members.map((m) => m.entry)
      const entry = pickVariant(variants, lang)
      return entry ? [{ entry, score: Math.max(...members.map((m) => m.score)), variants }] : []
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export const documentsFor = (entry: Entry) => [
  { title: 'none', text: entry.question },
  ...entry.aliases.map((alias) => ({ title: 'none', text: alias })),
  { title: entry.question, text: entry.answer.slice(0, 1500) },
]
