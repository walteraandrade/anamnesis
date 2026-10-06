import { parse as parseYaml } from 'yaml'
import type { Draft, Entry, Lang } from './types'

type Frontmatter = { lang?: string; group?: string; aliases?: string[] }

export const isStoryFile = (name: string) => /^answer-.+\.md$/.test(name)
export const isFactsFile = (name: string) => /^facts.*\.md$/.test(name)

const words = (list: string[]) => new RegExp(`(?<!\\p{L})(${list.join('|')})(?!\\p{L})`, 'giu')

const PT_MARKERS = new RegExp(
  `${words(['não', 'você', 'para', 'com', 'uma', 'que', 'também', 'então', 'isso', 'fiz', 'foi', 'meu', 'minha', 'qual', 'como', 'sua', 'seu']).source}|\\p{L}*(ção|ções|ões|ão)(?!\\p{L})`,
  'giu',
)
const EN_MARKERS = words([
  'the',
  'and',
  'with',
  'that',
  'this',
  'was',
  'for',
  'my',
  'of',
  'to',
  'it',
  'is',
  'what',
  'how',
  'your',
  'you',
  'why',
  'describe',
  'tell',
])

export const detectLang = (text: string, fallback: Lang = 'en'): Lang => {
  const prose = text.replace(/\S+:\/\/\S+|\S+@\S+|\S+\.(com|io|dev|br|org)\S*/gi, ' ')
  const pt = prose.match(PT_MARKERS)?.length ?? 0
  const en = prose.match(EN_MARKERS)?.length ?? 0
  return pt > en ? 'pt' : en > pt ? 'en' : fallback
}

const splitFrontmatter = (text: string): [Frontmatter, string] => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return [{}, text]
  const data = parseYaml(match[1] ?? '') ?? {}
  return [data as Frontmatter, text.slice(match[0].length)]
}

const toLang = (value: string | undefined): Lang | undefined =>
  value === 'pt' || value === 'pt-br' || value === 'ptbr' ? 'pt' : value === 'en' ? 'en' : undefined

const langFromName = (file: string): Lang | undefined =>
  /-pt(-?br)?\.md$/i.test(file) ? 'pt' : /-en\.md$/i.test(file) ? 'en' : undefined

const groupFromName = (file: string) =>
  file
    .replace(/^answer-/, '')
    .replace(/-(pt(-?br)?|en)\.md$/i, '.md')
    .replace(/\.md$/, '')

const humanize = (slug: string) => slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const splitAlternatives = (heading: string) =>
  heading
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)

const withoutNotes = (text: string) => text.split(/^\s*(?:---|\*\*\*|___)\s*$/m)[0] ?? ''

export const toPlainText = (markdown: string) =>
  markdown
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const findPlaceholders = (text: string) => text.match(/\[[^\]\n]{3,}\](?!\()/g) ?? []

export const parseStoryFile = (file: string, text: string): Entry => {
  const [fm, body] = splitFrontmatter(text)
  const heading = body.match(/^#\s+(.+)$/m)
  const [question = humanize(groupFromName(file)), ...headingAliases] = heading?.[1]
    ? splitAlternatives(heading[1])
    : []
  const answer = toPlainText(withoutNotes(heading ? body.slice((heading.index ?? 0) + heading[0].length) : body))
  return {
    id: file,
    file,
    kind: 'story',
    group: fm.group ?? groupFromName(file),
    lang: toLang(fm.lang) ?? langFromName(file) ?? detectLang(answer),
    question,
    aliases: [...headingAliases, ...(fm.aliases ?? [])],
    answer,
  }
}

export const parseFactsFile = (file: string, text: string): Entry[] =>
  splitFrontmatter(text)[1]
    .split(/^##\s+/m)
    .slice(1)
    .map((section) => {
      const [headingLine = '', ...rest] = section.split(/\r?\n/)
      const [question = '', ...aliases] = splitAlternatives(headingLine)
      const answer = toPlainText(rest.join('\n'))
      return { question, aliases, answer }
    })
    .filter(({ question, answer }) => question && answer)
    .map(({ question, aliases, answer }) => ({
      id: `${file}#${slugify(question)}`,
      file,
      kind: 'fact' as const,
      group: `fact:${slugify(question)}`,
      lang: detectLang(`${question} ${answer}`),
      question,
      aliases,
      answer,
    }))

export const parseFile = (file: string, text: string): Entry[] =>
  isStoryFile(file) ? [parseStoryFile(file, text)] : isFactsFile(file) ? parseFactsFile(file, text) : []

export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')

export const renderDraft = (draft: Draft, savedAt: string) =>
  [
    '---',
    `lang: ${draft.lang}`,
    `saved: ${savedAt}`,
    ...(draft.from ? [`from: ${draft.from}`] : []),
    '---',
    '',
    `# ${draft.question.replace(/\s+/g, ' ').trim()}`,
    '',
    draft.answer.trim(),
    '',
  ].join('\n')
