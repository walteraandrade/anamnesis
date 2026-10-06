import { createStore, getMany, setMany } from 'idb-keyval'
import type { Entry } from '../stories/types'
import { EMBED_MODEL, embedText, type EmbedItem, type EmbedResponse } from './protocol'
import { documentsFor, normalize, type Indexed } from './rank'

export type EmbedStatus =
  { state: 'idle' } | { state: 'loading'; percent: number } | { state: 'ready' } | { state: 'error'; message: string }

const cache = createStore('anamnesis-embeddings', 'vectors')

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

const splitBy = <T>(items: T[], [size, ...rest]: number[]): T[][] =>
  size === undefined ? [] : [items.slice(0, size), ...splitBy(items.slice(size), rest)]

const cacheKey = (item: EmbedItem) => sha256(`${EMBED_MODEL}\n${embedText(item)}`)

export const createEmbedder = (onStatus: (status: EmbedStatus) => void) => {
  const worker = new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>()
  const progress = new Map<string, { loaded: number; total: number }>()
  let nextId = 0

  worker.onmessage = ({ data }: MessageEvent<EmbedResponse>) => {
    if ('progress' in data) {
      progress.set(data.progress.file, data.progress)
      const all = [...progress.values()]
      const percent = (100 * all.reduce((s, p) => s + p.loaded, 0)) / all.reduce((s, p) => s + p.total, 0)
      return onStatus({ state: 'loading', percent: Math.round(percent) })
    }
    if ('ready' in data) return onStatus({ state: 'ready' })
    const request = pending.get(data.id)
    pending.delete(data.id)
    if ('error' in data) {
      onStatus({ state: 'error', message: data.error })
      return request?.reject(new Error(data.error))
    }
    request?.resolve(data.vectors.map(normalize))
  }

  const run = (items: EmbedItem[]) =>
    new Promise<number[][]>((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      worker.postMessage({ id, items })
    })

  const embed = async (items: EmbedItem[]) => {
    const keys = await Promise.all(items.map(cacheKey))
    const cached = await getMany<number[] | undefined>(keys, cache)
    const missing = items.map((item, i) => ({ item, i })).filter(({ i }) => !cached[i])
    if (missing.length) {
      const fresh = await run(missing.map(({ item }) => item))
      await setMany(
        missing.map(({ i }, j) => [keys[i], fresh[j]] as [string, number[]]),
        cache,
      )
      missing.forEach(({ i }, j) => (cached[i] = fresh[j]))
    }
    return cached as number[][]
  }

  const index = async (entries: Entry[]): Promise<Indexed[]> => {
    const perEntry = entries.map((entry) => documentsFor(entry).map((doc): EmbedItem => ({ kind: 'document', ...doc })))
    const groups = splitBy(
      await embed(perEntry.flat()),
      perEntry.map((docs) => docs.length),
    )
    return entries.map((entry, i) => ({ ...entry, vectors: groups[i] ?? [] }))
  }

  const query = async (text: string) => (await embed([{ kind: 'query', text }]))[0]

  return { index, query }
}

export type Embedder = ReturnType<typeof createEmbedder>
