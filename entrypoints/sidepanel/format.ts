import { countWords, type Limit } from '@/lib/llm/prompt'
import { findPlaceholders } from '@/lib/stories/parse'
import type { Entry, Lang } from '@/lib/stories/types'

export const LANG_LABEL: Record<Lang, string> = { en: 'EN', pt: 'PT' }

export const KIND_LABEL: Record<Entry['kind'], string> = { story: 'história', fact: 'fato' }

export const preview = (text: string, size = 220) => {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length > size ? `${flat.slice(0, size).trimEnd()}…` : flat
}

export const blanksNote = (text: string) => {
  const blanks = findPlaceholders(text)
  return blanks.length ? `Tem trecho para preencher: ${blanks.join(' ')}` : null
}

export const overBy = (text: string, limit: Limit) =>
  limit.chars && text.length > limit.chars
    ? `${text.length} caracteres, passa do limite de ${limit.chars}`
    : limit.words && countWords(text) > limit.words
      ? `${countWords(text)} palavras, passa do limite de ${limit.words}`
      : null

export const destinationLabel = (destination?: string) =>
  destination ? `“${preview(destination, 80)}”` : 'nenhuma caixa selecionada (clique num campo da vaga)'
