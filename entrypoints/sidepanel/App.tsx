import { useEffect, useMemo, useState } from 'react'
import { MODELS, type ModelFamily } from '@/lib/llm/models'
import { adaptMessages, countWords, newNumbers, overLimit, type AdaptMode, type Limit } from '@/lib/llm/prompt'
import type { FieldTarget, ToContent } from '@/lib/messages'
import type { EmbedStatus } from '@/lib/search/embedder'
import type { Match } from '@/lib/search/rank'
import type { FolderState } from '@/lib/stories/fs-source'
import { detectLang, findPlaceholders } from '@/lib/stories/parse'
import type { Entry, Lang } from '@/lib/stories/types'
import { useEmbedder, useFolder, useIndex, useLlm, useMatches, useTarget, type LlmState } from './hooks'

const LANG_LABEL: Record<Lang, string> = { en: 'EN', pt: 'PT' }

const pageLang = (target: FieldTarget | null): Lang => (target?.pageLang.toLowerCase().startsWith('pt') ? 'pt' : 'en')

const limitLabel = (limit: Limit) =>
  limit.chars
    ? `limite: ${limit.chars} caracteres`
    : limit.words
      ? `limite: ${limit.words} palavras`
      : 'sem limite detectado'

const preview = (text: string) => text.replace(/\s+/g, ' ').slice(0, 220)

export default function App() {
  const { folder, pick, unlock, error: folderError } = useFolder()
  const { embedder, status: embedStatus } = useEmbedder()
  const { source, entries, loading, error: indexError, reload } = useIndex(folder, embedder)
  const target = useTarget()
  const [question, setQuestion] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (target) setQuestion(target.question)
  }, [target])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const lang = useMemo(() => detectLang(question, pageLang(target)), [question, target])
  const matches = useMatches(question, entries, lang, embedder)

  const insert = async (text: string) => {
    if (!target) return setToast('Clique numa caixa de texto da vaga primeiro.')
    const ok = await browser.tabs
      .sendMessage(target.tabId, { type: 'field:insert', id: target.id, text } satisfies ToContent, {
        frameId: target.frameId,
      })
      .catch(() => false)
    setToast(ok ? 'Inserido. Confira antes de enviar.' : 'Não consegui inserir: a caixa sumiu da página.')
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setToast('Copiado.')
  }

  return (
    <main>
      <header>
        <h1>anamnesis</h1>
        <FolderPill folder={folder} count={entries.length} loading={loading} onReload={reload} />
      </header>

      <FolderGate folder={folder} onPick={pick} onUnlock={unlock} />
      {(folderError || indexError) && <p className="error">{folderError ?? indexError}</p>}
      <EmbedLine status={embedStatus} />

      {source && (
        <>
          <section>
            <label className="eyebrow" htmlFor="question">
              Pergunta
            </label>
            <textarea
              id="question"
              rows={3}
              value={question}
              placeholder="Clique numa caixa de texto da vaga, ou cole a pergunta aqui."
              onChange={(e) => setQuestion(e.target.value)}
            />
            {target && (
              <p className="meta">
                {target.site} · {limitLabel(target.limit)} · resposta em {LANG_LABEL[lang]}
              </p>
            )}
          </section>

          {editing ? (
            <Editor
              key={editing.id}
              source={editing}
              question={question}
              lang={lang}
              limit={target?.limit ?? {}}
              destination={target?.question}
              onClose={() => setEditing(null)}
              onInsert={insert}
              onCopy={copy}
              onSave={async (answer) => {
                const name = await source.save({ question, answer, lang, from: editing.file })
                setToast(`Salvo como ${name}`)
                reload()
              }}
            />
          ) : (
            <Matches
              matches={matches}
              hasQuestion={!!question.trim()}
              limit={target?.limit ?? {}}
              onInsert={insert}
              onEdit={setEditing}
            />
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

function FolderPill(props: { folder: FolderState | null; count: number; loading: boolean; onReload: () => void }) {
  if (props.folder?.status !== 'ready') return null
  return (
    <button className="pill" onClick={props.onReload} title="Ler a pasta de novo">
      {props.folder.handle.name} · {props.loading ? 'lendo…' : `${props.count} respostas`} ↻
    </button>
  )
}

function FolderGate(props: { folder: FolderState | null; onPick: () => void; onUnlock: () => void }) {
  const { folder } = props
  if (!folder || folder.status === 'ready') return null
  if (folder.status === 'locked')
    return (
      <section className="card gate">
        <p>O browser pede para liberar a pasta de novo a cada sessão.</p>
        <button className="primary" onClick={props.onUnlock}>
          Liberar {folder.handle.name}
        </button>
      </section>
    )
  return (
    <section className="card gate">
      <p>
        Escolha a pasta com suas respostas. Leio os arquivos <code>answer-*.md</code> (histórias) e{' '}
        <code>facts*.md</code> (fatos curtos).
      </p>
      <button className="primary" onClick={props.onPick}>
        Escolher pasta
      </button>
    </section>
  )
}

function EmbedLine({ status }: { status: EmbedStatus }) {
  if (status.state === 'loading')
    return <p className="meta">Baixando o modelo de busca (só na primeira vez): {status.percent}%</p>
  if (status.state === 'error') return <p className="error">Busca falhou: {status.message}</p>
  return null
}

const blanksNote = (text: string) => {
  const blanks = findPlaceholders(text)
  return blanks.length ? `Tem trecho para preencher: ${blanks.join(' ')}` : null
}

const overBy = (text: string, limit: Limit) =>
  limit.chars && text.length > limit.chars
    ? `${text.length} caracteres, passa do limite de ${limit.chars}`
    : limit.words && countWords(text) > limit.words
      ? `${countWords(text)} palavras, passa do limite de ${limit.words}`
      : null

function Matches(props: {
  matches: Match[]
  hasQuestion: boolean
  limit: Limit
  onInsert: (text: string) => void
  onEdit: (entry: Entry) => void
}) {
  if (!props.hasQuestion) return null
  if (!props.matches.length) return <p className="meta">Procurando…</p>
  return (
    <section className="matches" data-ready="true">
      <p className="eyebrow">Respostas parecidas</p>
      {props.matches.map(({ entry, score, variants }) => {
        const over = overBy(entry.answer, props.limit)
        const blanks = blanksNote(entry.answer)
        return (
          <article key={entry.group} className="card">
            <div className="tags">
              <span className={`tag ${entry.kind}`}>{entry.kind === 'fact' ? 'fato' : 'história'}</span>
              {variants.map((v) => (
                <span key={v.id} className={`tag ${v.id === entry.id ? 'on' : ''}`}>
                  {LANG_LABEL[v.lang]}
                </span>
              ))}
              <span className="score">{Math.round(score * 100)}%</span>
            </div>
            <h2>{entry.question}</h2>
            <p className="preview">{preview(entry.answer)}</p>
            {over && <p className="warn">{over}. Edite ou adapte antes de inserir.</p>}
            {blanks && <p className="warn">{blanks}</p>}
            <div className="actions">
              <button className={over ? '' : 'primary'} onClick={() => props.onInsert(entry.answer)}>
                {over ? 'Inserir mesmo assim' : 'Inserir'}
              </button>
              <button className={over ? 'primary' : ''} onClick={() => props.onEdit(entry)}>
                Editar / adaptar
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}

const MODE_LABEL: Record<AdaptMode, string> = { fit: 'Encurtar', focus: 'Focar na pergunta', translate: 'Traduzir' }

function Editor(props: {
  source: Entry
  question: string
  lang: Lang
  limit: Limit
  destination?: string
  onClose: () => void
  onInsert: (text: string) => void
  onCopy: (text: string) => void
  onSave: (text: string) => Promise<void>
}) {
  const { source, question, lang, limit } = props
  const [draft, setDraft] = useState(source.answer)
  const [chars, setChars] = useState(limit.chars ? String(limit.chars) : '')
  const llm = useLlm()

  const activeLimit: Limit = chars ? { chars: Number(chars) } : limit.words ? { words: limit.words } : {}
  const invented = newNumbers(source.answer, draft)
  const tooLong = overLimit(draft, activeLimit)
  const busy = ['checking', 'loading', 'generating'].includes(llm.state.state)
  const modes: AdaptMode[] = source.lang === lang ? ['fit', 'focus'] : ['fit', 'focus', 'translate']

  const adapt = (mode: AdaptMode) =>
    llm.run(adaptMessages({ question, answer: source.answer, lang, limit: activeLimit, mode }), setDraft)

  return (
    <section className="editor">
      <div className="row">
        <p className="eyebrow">Editando: {source.question}</p>
        <button className="ghost" onClick={props.onClose}>
          Fechar
        </button>
      </div>
      <textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} />
      <div className="row meta">
        <span className={tooLong ? 'bad' : ''}>
          {draft.length} caracteres · {countWords(draft)} palavras
        </span>
        <label>
          limite{' '}
          <input
            className="limit"
            inputMode="numeric"
            value={chars}
            placeholder="—"
            onChange={(e) => setChars(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      </div>
      {invented.length > 0 && (
        <p className="warn">Números que não estão na história original: {invented.join(', ')}. Confira.</p>
      )}
      {blanksNote(draft) && <p className="warn">{blanksNote(draft)}</p>}

      <p className="meta">
        Vai para: {props.destination ? `“${props.destination.slice(0, 80)}”` : 'nenhuma caixa selecionada'}
      </p>
      <div className="actions">
        <button className="primary" onClick={() => props.onInsert(draft)} disabled={busy}>
          Inserir
        </button>
        <button onClick={() => props.onCopy(draft)}>Copiar</button>
        <button onClick={() => props.onSave(draft)} disabled={busy || draft.trim() === source.answer.trim()}>
          Salvar no banco
        </button>
      </div>

      <div className="card llm">
        <p className="eyebrow">Adaptar com IA local</p>
        <div className="actions">
          {modes.map((mode) => (
            <button key={mode} onClick={() => adapt(mode)} disabled={busy}>
              {MODE_LABEL[mode]}
            </button>
          ))}
          {busy && (
            <button className="ghost" onClick={llm.stop}>
              Parar
            </button>
          )}
        </div>
        <div className="row meta">
          <select value={llm.family} onChange={(e) => llm.setFamily(e.target.value as ModelFamily)} disabled={busy}>
            {MODELS.map((m) => (
              <option key={m.family} value={m.family}>
                {m.label} (~{(m.vramMb / 1024).toFixed(1)} GB)
              </option>
            ))}
          </select>
          <button className="ghost" onClick={() => setDraft(source.answer)} disabled={busy}>
            Voltar ao original
          </button>
        </div>
        <LlmLine state={llm.state} />
      </div>
    </section>
  )
}

function LlmLine({ state }: { state: LlmState }) {
  switch (state.state) {
    case 'checking':
      return <p className="meta">Procurando a placa de vídeo…</p>
    case 'unsupported':
      return <p className="error">{state.reason}</p>
    case 'loading':
      return (
        <div className="progress">
          <div style={{ width: `${Math.round(state.progress * 100)}%` }} />
          <p className="meta">{state.text}</p>
        </div>
      )
    case 'generating':
      return <p className="meta">Escrevendo…</p>
    case 'error':
      return <p className="error">{state.message}</p>
    default:
      return null
  }
}
