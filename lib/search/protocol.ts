export type EmbedKind = 'query' | 'document'
export type EmbedItem = { kind: EmbedKind; text: string; title?: string }

export type EmbedRequest = { id: number; items: EmbedItem[] }

export type EmbedResponse =
  | { id: number; vectors: number[][] }
  | { id: number; error: string }
  | { progress: { file: string; loaded: number; total: number } }
  | { ready: true }

export const EMBED_MODEL = 'onnx-community/embeddinggemma-300m-ONNX'

export const embedText = ({ kind, text, title }: EmbedItem) =>
  kind === 'query' ? `task: search result | query: ${text}` : `title: ${title ?? 'none'} | text: ${text}`
