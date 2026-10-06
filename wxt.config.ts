import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'wxt'

const ortDist = resolve(import.meta.dirname, 'node_modules/onnxruntime-web/dist')

const ortFiles = () =>
  readdirSync(ortDist)
    .filter((name) => /^ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/.test(name))
    .map((name) => ({ absoluteSrc: resolve(ortDist, name), relativeDest: `ort/${name}` }))

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'anamnesis',
    description: 'Answers job application questions from your own story bank, locally.',
    permissions: ['sidePanel', 'storage', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'anamnesis' },
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+A' } },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
  hooks: {
    'build:publicAssets': (_, files) => {
      files.push(...ortFiles())
    },
  },
})
