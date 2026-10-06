import { del, get, set } from 'idb-keyval'
import { isFactsFile, isStoryFile, parseFile, renderDraft, slugify } from './parse'
import type { Draft, StorySource } from './types'

const HANDLE_KEY = 'stories-directory'
const MODE = { mode: 'readwrite' } as const

export type FolderState =
  | { status: 'none' }
  | { status: 'locked'; handle: FileSystemDirectoryHandle }
  | { status: 'ready'; handle: FileSystemDirectoryHandle }

export const loadFolder = async (): Promise<FolderState> => {
  const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY)
  if (!handle) return { status: 'none' }
  return (await handle.queryPermission(MODE)) === 'granted' ? { status: 'ready', handle } : { status: 'locked', handle }
}

export const pickFolder = async (): Promise<FolderState> => {
  const handle = await window.showDirectoryPicker({ id: 'anamnesis', mode: 'readwrite', startIn: 'documents' })
  await set(HANDLE_KEY, handle)
  return { status: 'ready', handle }
}

export const unlockFolder = async (handle: FileSystemDirectoryHandle): Promise<FolderState> =>
  (await handle.requestPermission(MODE)) === 'granted' ? { status: 'ready', handle } : { status: 'locked', handle }

export const forgetFolder = () => del(HANDLE_KEY)

const isWanted = (name: string) => isStoryFile(name) || isFactsFile(name)

const fileExists = (dir: FileSystemDirectoryHandle, name: string) =>
  dir.getFileHandle(name).then(
    () => true,
    () => false,
  )

const freeName = async (dir: FileSystemDirectoryHandle, base: string, n = 1): Promise<string> => {
  const name = n === 1 ? `${base}.md` : `${base}-${n}.md`
  return (await fileExists(dir, name)) ? freeName(dir, base, n + 1) : name
}

const today = () => new Date().toISOString().slice(0, 10)

export const folderSource = (dir: FileSystemDirectoryHandle): StorySource => ({
  name: dir.name,
  list: async () => {
    const files: FileSystemFileHandle[] = []
    for await (const handle of dir.values()) {
      if (handle.kind === 'file' && isWanted(handle.name)) files.push(handle)
    }
    const parsed = await Promise.all(
      files.map(async (handle) => parseFile(handle.name, await (await handle.getFile()).text())),
    )
    return parsed.flat()
  },
  save: async (draft: Draft) => {
    const name = await freeName(dir, `answer-saved-${slugify(draft.question) || 'untitled'}`)
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable()
    await writable.write(renderDraft(draft, today()))
    await writable.close()
    return name
  },
})
