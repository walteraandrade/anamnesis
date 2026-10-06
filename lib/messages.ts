import type { Limit } from './llm/prompt'

export type FieldInfo = {
  id: string
  question: string
  limit: Limit
  kind: 'input' | 'textarea' | 'rich'
  pageLang: string
  site: string
}

export type ToPanel = { type: 'field:focus'; field: FieldInfo }

export type ToContent = { type: 'field:insert'; id: string; text: string } | { type: 'field:announce' }

export type FieldTarget = FieldInfo & { tabId: number; frameId: number; windowId: number }
