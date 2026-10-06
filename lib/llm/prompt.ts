import type { Lang } from '../stories/types'

export type Limit = { chars?: number; words?: number }
export type AdaptMode = 'fit' | 'focus' | 'translate'
export type Message = { role: 'system' | 'user'; content: string }

const LANG_NAME: Record<Lang, string> = { en: 'English', pt: 'Brazilian Portuguese' }

const limitRule = (limit: Limit) =>
  limit.chars
    ? `The answer must have at most ${limit.chars} characters, counting spaces.`
    : limit.words
      ? `The answer must have at most ${limit.words} words.`
      : 'Keep roughly the original length.'

const MODE_RULE: Record<AdaptMode, string> = {
  fit: 'Shorten the source answer to fit the limit. Keep the most concrete parts: what broke or what was built, what I did, the result.',
  focus:
    'Rewrite the source answer so it answers the question directly in the first sentence. Drop parts that do not serve the question.',
  translate: 'Translate the source answer. Keep the same structure and every number.',
}

export const adaptMessages = (input: {
  question: string
  answer: string
  lang: Lang
  limit: Limit
  mode: AdaptMode
}): Message[] => [
  {
    role: 'system',
    content: [
      'You edit job application answers written by the candidate in first person.',
      'Use only facts that appear in the source answer. Never add companies, products, numbers, dates, technologies or events that are not in it.',
      'If the source does not answer the question, say so in one short sentence instead of inventing.',
      MODE_RULE[input.mode],
      limitRule(input.limit),
      `Write in ${LANG_NAME[input.lang]}.`,
      'Output only the final answer text, with no preamble, no quotes and no markdown headings.',
    ].join('\n'),
  },
  {
    role: 'user',
    content: `Question:\n${input.question}\n\nSource answer:\n${input.answer}`,
  },
]

const NUMBER = /\d+(?:[.,]\d+)*/g

const canonicalNumber = (raw: string) => raw.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')

export const newNumbers = (source: string, output: string) => {
  const known = new Set((source.match(NUMBER) ?? []).map(canonicalNumber))
  return [...new Set((output.match(NUMBER) ?? []).filter((n) => !known.has(canonicalNumber(n))))]
}

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

export const overLimit = (text: string, limit: Limit) =>
  (limit.chars !== undefined && text.length > limit.chars) ||
  (limit.words !== undefined && countWords(text) > limit.words)

export const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trimStart()
