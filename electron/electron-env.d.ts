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
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    onGameStatus: (listener: (payload: { active: boolean }) => void) => () => void
    getDesktopSources: () => Promise<Array<{ id: string; name: string }>>
    saveRecording: (recordingBuffer: ArrayBuffer) => Promise<string>
    getRecordings: () => Promise<Array<{ filename: string; path: string; size: number; createdAt: number }>>
    deleteRecording: (filePath: string) => Promise<boolean>
  }
}
