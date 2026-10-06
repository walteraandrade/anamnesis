import {
  AutoModel,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from '@huggingface/transformers'
import { EMBED_MODEL, embedText, type EmbedRequest, type EmbedResponse } from './protocol'

const ortBase = new URL('/ort/', self.location.origin).href

env.allowLocalModels = false
env.useWasmCache = false
env.backends.onnx.wasm!.numThreads = 1
env.backends.onnx.wasm!.wasmPaths = {
  mjs: `${ortBase}ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${ortBase}ort-wasm-simd-threaded.asyncify.wasm`,
}

const post = (message: EmbedResponse) => self.postMessage(message)

type ProgressEvent = { status: string; file?: string; loaded?: number; total?: number }

const onProgress = (event: ProgressEvent) =>
  event.status === 'progress' && event.file && event.total
    ? post({ progress: { file: event.file, loaded: event.loaded ?? 0, total: event.total } })
    : undefined

let model: Promise<[PreTrainedTokenizer, PreTrainedModel]> | undefined

const load = () =>
  (model ??= Promise.all([
    AutoTokenizer.from_pretrained(EMBED_MODEL),
    AutoModel.from_pretrained(EMBED_MODEL, { dtype: 'q8', device: 'wasm', progress_callback: onProgress }),
  ]).then((pair) => {
    post({ ready: true })
    return pair
  }))

const BATCH = 4

const chunks = <T>(items: T[], size: number): T[][] =>
  items.length ? [items.slice(0, size), ...chunks(items.slice(size), size)] : []

const embedBatch = async (texts: string[]) => {
  const [tokenizer, encoder] = await load()
  const inputs = tokenizer(texts, { padding: true, truncation: true, max_length: 1024 })
  const { sentence_embedding } = await encoder(inputs)
  return sentence_embedding.tolist() as number[][]
}

self.onmessage = async ({ data }: MessageEvent<EmbedRequest>) => {
  try {
    const texts = data.items.map(embedText)
    const vectors: number[][] = []
    for (const batch of chunks(texts, BATCH)) vectors.push(...(await embedBatch(batch)))
    post({ id: data.id, vectors })
  } catch (error) {
    post({ id: data.id, error: String(error) })
  }
}
