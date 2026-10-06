/// <reference types="@webgpu/types" />
import { CreateWebWorkerMLCEngine, type InitProgressReport, type WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import type { Message } from './prompt'

export type Gpu = { available: false; reason: string } | { available: true; vendor: string; f16: boolean }

export const probeGpu = async (): Promise<Gpu> => {
  if (!('gpu' in navigator) || !navigator.gpu)
    return { available: false, reason: 'navigator.gpu is missing: WebGPU is off in this browser.' }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter)
    return {
      available: false,
      reason: 'No WebGPU adapter. On Linux, start Chromium with --enable-unsafe-webgpu --enable-features=Vulkan.',
    }
  return { available: true, vendor: adapter.info?.vendor ?? 'unknown', f16: adapter.features.has('shader-f16') }
}

let current: { id: string; engine: Promise<WebWorkerMLCEngine> } | undefined

export const loadEngine = (id: string, onProgress: (report: InitProgressReport) => void) => {
  if (current?.id === id) return current.engine
  const engine = CreateWebWorkerMLCEngine(
    new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' }),
    id,
    { initProgressCallback: onProgress },
  )
  current = { id, engine }
  engine.catch(() => (current = undefined))
  return engine
}

export async function* complete(engine: WebWorkerMLCEngine, messages: Message[]) {
  await engine.resetChat()
  const chunks = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 900,
    extra_body: { enable_thinking: false },
  })
  for await (const chunk of chunks) yield chunk.choices[0]?.delta?.content ?? ''
}
