/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.mjs
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
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

// Used in Renderer process, exposed in `preload.ts`
interface Window {
  electronAPI: {
    onGameStatus: (listener: (payload: { active: boolean }) => void) => () => void
    getDesktopSources: () => Promise<Array<{ id: string; name: string }>>
    saveRecording: (
      recordingBuffer: ArrayBuffer,
      limits: { maxCount: number; maxSizeGB: number },
    ) => Promise<string>
    getRecordings: () => Promise<RecordingSession[]>
    deleteRecording: (filePath: string) => Promise<boolean>
    exportRecording: (params: ExportParams) => Promise<ExportResult>
    getRiotSummoner: (
      params: import('../src/types/riot').RiotFetchParams,
    ) => Promise<import('../src/types/riot').RiotFetchResult>
    getRiotEnvStatus: () => Promise<{ hasEnvKey: boolean }>
    getCurrentSummonerFromClient: () => Promise<
      import('../src/types/riot').LcuCurrentSummonerResult
    >
  }
}
