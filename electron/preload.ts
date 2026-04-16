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

type ExportParams = {
  sourcePath: string
  startSec?: number
  endSec?: number
  speedMultiplier?: number
}

type ExportResult = {
  success: boolean
  session?: RecordingSession
  error?: string
}

type RiotFetchParams = {
  platform: string
  gameName: string
  tagLine: string
  apiKey?: string
  matchCount?: number
}

type RiotFetchResult =
  | { success: true; data: unknown }
  | { success: false; error: string; status?: number }

type LcuCurrentSummonerResult =
  | { success: true; data: unknown }
  | { success: false; error: string }

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
  exportRecording(params: ExportParams) {
    return ipcRenderer.invoke('export-recording', params) as Promise<ExportResult>
  },
  getRiotSummoner(params: RiotFetchParams) {
    return ipcRenderer.invoke('riot-get-summoner', params) as Promise<RiotFetchResult>
  },
  getRiotEnvStatus() {
    return ipcRenderer.invoke('riot-env-status') as Promise<{ hasEnvKey: boolean }>
  },
  getCurrentSummonerFromClient() {
    return ipcRenderer.invoke('lcu-get-current-summoner') as Promise<LcuCurrentSummonerResult>
  },
})
