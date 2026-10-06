type FileSystemPermissionMode = 'read' | 'readwrite'

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: FileSystemPermissionMode }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: FileSystemPermissionMode }): Promise<PermissionState>
}

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string
    mode?: FileSystemPermissionMode
    startIn?: string
  }): Promise<FileSystemDirectoryHandle>
}
