import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Browser } from 'wxt/browser'
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import { MODELS, modelId, type ModelFamily } from '@/lib/llm/models'
import { stripThinking, type Message } from '@/lib/llm/prompt'
import type { FieldTarget, ToContent, ToPanel } from '@/lib/messages'
import { createEmbedder, type EmbedStatus } from '@/lib/search/embedder'
import { rank, type Indexed, type Match } from '@/lib/search/rank'
import { folderSource, loadFolder, pickFolder, unlockFolder, type FolderState } from '@/lib/stories/fs-source'
import type { Entry, Lang } from '@/lib/stories/types'

export const useFolder = () => {
  const [folder, setFolder] = useState<FolderState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFolder().then(setFolder, (e) => setError(String(e)))
  }, [])

  const guard = (action: () => Promise<FolderState>) => () =>
    action().then(
      (next) => {
        setError(null)
        setFolder(next)
      },
      (e: Error) => e.name !== 'AbortError' && setError(e.message),
    )

  const pick = useCallback(guard(pickFolder), [])
  const unlock = useCallback(
    guard(() =>
      folder && folder.status !== 'none' ? unlockFolder(folder.handle) : Promise.reject(new Error('no folder')),
    ),
    [folder],
  )

  return { folder, pick, unlock, error }
}

export const useEmbedder = () => {
  const [status, setStatus] = useState<EmbedStatus>({ state: 'idle' })
  const embedder = useMemo(() => createEmbedder(setStatus), [])
  return { embedder, status }
}

export const useIndex = (folder: FolderState | null, embedder: ReturnType<typeof createEmbedder>) => {
  const [stories, setStories] = useState<Entry[]>([])
  const [entries, setEntries] = useState<Indexed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const source = useMemo(() => (folder?.status === 'ready' ? folderSource(folder.handle) : null), [folder])

  const reload = useCallback(async () => {
    if (!source) return
    const run = ++generation.current
    setLoading(true)
    try {
      const listed = await source.list()
      if (run === generation.current) setStories(listed)
      const indexed = await embedder.index(listed)
      if (run === generation.current) {
        setEntries(indexed)
        setError(null)
      }
    } catch (e) {
      if (run === generation.current) setError(String(e))
    } finally {
      if (run === generation.current) setLoading(false)
    }
  }, [source, embedder])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return { source, stories, entries, loading, error, reload }
}

export const useTarget = () => {
  const [target, setTarget] = useState<FieldTarget | null>(null)

  useEffect(() => {
    let windowId: number | undefined
    const listener = (message: ToPanel, sender: Browser.runtime.MessageSender) => {
      const tab = sender.tab
      if (message?.type !== 'field:focus' || tab?.id === undefined) return
      if (windowId !== undefined && tab.windowId !== windowId) return
      setTarget({ ...message.field, tabId: tab.id, frameId: sender.frameId ?? 0, windowId: tab.windowId })
    }
    browser.runtime.onMessage.addListener(listener)
    browser.windows.getCurrent().then(async (win) => {
      windowId = win.id
      const [tab] = await browser.tabs.query({ active: true, windowId: win.id })
      if (tab?.id !== undefined)
        browser.tabs.sendMessage(tab.id, { type: 'field:announce' } satisfies ToContent).catch(() => undefined)
    })
    return () => browser.runtime.onMessage.removeListener(listener)
  }, [])

  return target
}

export const useMatches = (
  question: string,
  entries: Indexed[],
  lang: Lang,
  embedder: ReturnType<typeof createEmbedder>,
) => {
  const [result, setResult] = useState<{ key: string; matches: Match[] }>({ key: '', matches: [] })
  const key = `${lang}:${question.trim()}`

  useEffect(() => {
    if (!question.trim() || !entries.length) return
    let alive = true
    const timer = setTimeout(async () => {
      const vector = await embedder.query(question).catch(() => null)
      if (alive && vector) setResult({ key, matches: rank(vector, entries, lang, 4) })
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [key, question, entries, lang, embedder])

  return result.key === key ? result.matches : []
}

export type LlmState =
  | { state: 'off' }
  | { state: 'checking' }
  | { state: 'unsupported'; reason: string }
  | { state: 'loading'; progress: number; text: string }
  | { state: 'generating' }
  | { state: 'done' }
  | { state: 'error'; message: string }

const FAMILY_KEY = 'anamnesis:model'

const readFamily = (): ModelFamily => {
  try {
    const saved = localStorage.getItem(FAMILY_KEY)
    return MODELS.find((m) => m.family === saved)?.family ?? MODELS[0].family
  } catch {
    return MODELS[0].family
  }
}

export const useLlm = () => {
  const [state, setState] = useState<LlmState>({ state: 'off' })
  const [family, setFamilyState] = useState<ModelFamily>(readFamily)
  const engineRef = useRef<WebWorkerMLCEngine | null>(null)

  const setFamily = (next: ModelFamily) => {
    setFamilyState(next)
    try {
      localStorage.setItem(FAMILY_KEY, next)
    } catch {}
  }

  const run = useCallback(
    async (messages: Message[], onText: (text: string) => void) => {
      setState({ state: 'checking' })
      const { complete, loadEngine, probeGpu } = await import('@/lib/llm/engine')
      const gpu = await probeGpu()
      if (!gpu.available) return setState({ state: 'unsupported', reason: gpu.reason })
      try {
        const engine = await loadEngine(modelId(family, gpu.f16), (report) =>
          setState({ state: 'loading', progress: report.progress, text: report.text }),
        )
        engineRef.current = engine
        setState({ state: 'generating' })
        let text = ''
        for await (const piece of complete(engine, messages)) {
          text += piece
          onText(stripThinking(text))
        }
        setState({ state: 'done' })
      } catch (e) {
        setState({ state: 'error', message: String(e) })
      }
    },
    [family],
  )

  const stop = useCallback(() => engineRef.current?.interruptGenerate(), [])

  return { state, family, setFamily, run, stop }
}
