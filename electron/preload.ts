import { ipcRenderer, contextBridge } from 'electron'

type GameStatusPayload = {
  active: boolean
}

type DesktopSource = {
  id: string
  name: string
}

type RecordingSession = {
  filename: string
  path: string
  size: number
  createdAt: number
}

contextBridge.exposeInMainWorld('electronAPI', {
  onGameStatus(listener: (payload: GameStatusPayload) => void) {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: GameStatusPayload) => {
      listener(payload)
    }

    ipcRenderer.on('game-status', wrappedListener)
    return () => {
      ipcRenderer.off('game-status', wrappedListener)
    }
  },
  getDesktopSources() {
    return ipcRenderer.invoke('get-desktop-sources') as Promise<DesktopSource[]>
  },
  saveRecording(recordingBuffer: ArrayBuffer, limits: { maxCount: number; maxSizeGB: number }) {
    return ipcRenderer.invoke('save-recording', recordingBuffer, limits) as Promise<string>
  },
  getRecordings() {
    return ipcRenderer.invoke('get-recordings') as Promise<RecordingSession[]>
  },
  deleteRecording(filePath: string) {
    return ipcRenderer.invoke('delete-recording', filePath) as Promise<boolean>
  },
})
