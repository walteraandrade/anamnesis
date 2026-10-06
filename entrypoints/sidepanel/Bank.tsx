import { useEffect, useMemo, useState } from 'react'
import { countWords, type Limit } from '@/lib/llm/prompt'
import { browseOrder, filterEntries, type KindFilter } from '@/lib/stories/browse'
import type { Entry } from '@/lib/stories/types'
import { blanksNote, destinationLabel, KIND_LABEL, LANG_LABEL, overBy, preview } from './format'

const KIND_OPTIONS: { kind: KindFilter; label: string }[] = [
  { kind: 'all', label: 'Todas' },
  { kind: 'story', label: 'Histórias' },
  { kind: 'fact', label: 'Fatos' },
]

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement

export default function Bank(props: {
  entries: Entry[]
  active: boolean
  limit: Limit
  destination?: string
  onInsert: (text: string) => void
  onCopy: (text: string) => void
  onEdit: (entry: Entry) => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const ordered = useMemo(() => browseOrder(props.entries), [props.entries])
  const list = useMemo(() => filterEntries(ordered, query, kind), [ordered, query, kind])
  const index = openId ? list.findIndex((e) => e.id === openId) : -1
  const entry = list[index]

  const go = (step: number) => {
    const next = list[index + step]
    if (next) setOpenId(next.id)
  }

  useEffect(() => {
    if (!props.active || !entry) return
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const action = { ArrowRight: () => go(1), ArrowLeft: () => go(-1), Escape: () => setOpenId(null) }[event.key]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (entry)
    return (
      <Detail
        entry={entry}
        position={index + 1}
        total={list.length}
        limit={props.limit}
        destination={props.destination}
        onBack={() => setOpenId(null)}
        onPrev={index > 0 ? () => go(-1) : undefined}
        onNext={index < list.length - 1 ? () => go(1) : undefined}
        onInsert={props.onInsert}
        onCopy={props.onCopy}
        onEdit={props.onEdit}
      />
    )

  const countOf = (k: KindFilter) => filterEntries(ordered, query, k).length

  return (
    <section className="bank">
      <input
        type="search"
        value={query}
        placeholder="Filtrar por palavra (ex.: salary, bug, produção)"
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="segmented" role="radiogroup" aria-label="Tipo">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.kind}
            role="radio"
            aria-checked={kind === option.kind}
            className={kind === option.kind ? 'on' : ''}
            onClick={() => setKind(option.kind)}
          >
            {option.label} <span className="count">{countOf(option.kind)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="meta">Nada com esse filtro.</p>}
      <ul className="entry-list">
        {list.map((e) => (
          <li key={e.id}>
            <button className="entry" onClick={() => setOpenId(e.id)}>
              <span className="tags">
                <span className={`tag ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                <span className="tag">{LANG_LABEL[e.lang]}</span>
              </span>
              <span className="entry-question">{e.question}</span>
              <span className="entry-answer">{preview(e.answer, 110)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Detail(props: {
  entry: Entry
  position: number
  total: number
  limit: Limit
  destination?: string
  onBack: () => void
  onPrev?: () => void
  onNext?: () => void
  onInsert: (text: string) => void
  onCopy: (text: string) => void
  onEdit: (entry: Entry) => void
}) {
  const { entry } = props
  const over = overBy(entry.answer, props.limit)
  const blanks = blanksNote(entry.answer)

  return (
    <section className="detail">
      <div className="row">
        <button className="ghost" onClick={props.onBack}>
          ← Lista
        </button>
        <div className="pager">
          <button className="icon" onClick={props.onPrev} disabled={!props.onPrev} aria-label="Anterior">
            ‹
          </button>
          <span className="position">
            {props.position} de {props.total}
          </span>
          <button className="icon" onClick={props.onNext} disabled={!props.onNext} aria-label="Próxima">
            ›
          </button>
        </div>
      </div>

      <div className="tags">
        <span className={`tag ${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
        <span className="tag">{LANG_LABEL[entry.lang]}</span>
        <span className="file">{entry.file}</span>
      </div>
      <h2>{entry.question}</h2>
      {entry.aliases.length > 0 && <p className="meta">Também: {entry.aliases.join(' · ')}</p>}

      <div className="fulltext">{entry.answer}</div>
      <p className="meta">
        {entry.answer.length} caracteres · {countWords(entry.answer)} palavras
      </p>
      {over && <p className="warn">{over}. Edite ou adapte antes de inserir.</p>}
      {blanks && <p className="warn">{blanks}</p>}

      <p className="meta">Vai para: {destinationLabel(props.destination)}</p>
      <div className="actions">
        <button className={over ? '' : 'primary'} onClick={() => props.onInsert(entry.answer)}>
          {over ? 'Inserir mesmo assim' : 'Inserir'}
        </button>
        <button onClick={() => props.onCopy(entry.answer)}>Copiar</button>
        <button className={over ? 'primary' : ''} onClick={() => props.onEdit(entry)}>
          Editar / adaptar
        </button>
      </div>
      <p className="hint">Setas ← → do teclado passam de uma em uma. Esc volta para a lista.</p>
    </section>
  )
}
