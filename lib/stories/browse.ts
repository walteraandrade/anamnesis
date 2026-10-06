import type { Entry } from './types'

export type KindFilter = 'all' | Entry['kind']

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const KIND_RANK: Record<Entry['kind'], number> = { story: 0, fact: 1 }

export const browseOrder = (entries: Entry[]) =>
  [...entries].sort(
    (a, b) =>
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      (a.kind === 'story' ? a.group.localeCompare(b.group) || a.lang.localeCompare(b.lang) : 0),
  )

const haystack = (entry: Entry) => fold([entry.question, ...entry.aliases, entry.answer].join(' '))

export const filterEntries = (entries: Entry[], query: string, kind: KindFilter) => {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  return entries.filter(
    (entry) => (kind === 'all' || entry.kind === kind) && terms.every((term) => haystack(entry).includes(term)),
  )
}
