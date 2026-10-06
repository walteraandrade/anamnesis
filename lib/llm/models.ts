export const MODELS = [
  { family: 'Qwen3-4B', label: 'Qwen3 4B', vramMb: 4330 },
  { family: 'Qwen3.5-4B', label: 'Qwen3.5 4B', vramMb: 4680 },
  { family: 'Qwen3-1.7B', label: 'Qwen3 1.7B', vramMb: 2640 },
] as const

export type ModelFamily = (typeof MODELS)[number]['family']

export const modelId = (family: ModelFamily, f16: boolean) => `${family}-q4f${f16 ? 16 : 32}_1-MLC`
