export type Lang = 'en' | 'pt'

export type Entry = {
  id: string
  file: string
  kind: 'story' | 'fact'
  group: string
  lang: Lang
  question: string
  aliases: string[]
  answer: string
}

export type Draft = {
  question: string
  answer: string
  lang: Lang
  from?: string
}

export type StorySource = {
  name: string
  list: () => Promise<Entry[]>
  save: (draft: Draft) => Promise<string>
}
