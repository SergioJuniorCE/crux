import { ipcRenderer, contextBridge } from "electron";

type GameStatusPayload = {
  active: boolean;
};

type DesktopSource = {
  id: string;
  name: string;
};

type RecordingSession = {
  filename: string;
  path: string;
  size: number;
  createdAt: number;
};

type ExportParams = {
  sourcePath: string;
  startSec?: number;
  endSec?: number;
  speedMultiplier?: number;
};

type ExportResult = {
  success: boolean;
  session?: RecordingSession;
  error?: string;
};

type LcuCurrentSummonerResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

type LcuChampSelectSessionResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

contextBridge.exposeInMainWorld("electronAPI", {
  openExternalUrl(url: string) {
    return ipcRenderer.invoke("open-external-url", url) as Promise<boolean>;
  },
  onGameStatus(listener: (payload: GameStatusPayload) => void) {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: GameStatusPayload,
    ) => {
      listener(payload);
    };

    ipcRenderer.on("game-status", wrappedListener);
    return () => {
      ipcRenderer.off("game-status", wrappedListener);
    };
  },
  getDesktopSources() {
    return ipcRenderer.invoke("get-desktop-sources") as Promise<
      DesktopSource[]
    >;
  },
  saveRecording(
    recordingBuffer: ArrayBuffer,
    limits: { maxCount: number; maxSizeGB: number },
  ) {
    return ipcRenderer.invoke(
      "save-recording",
      recordingBuffer,
      limits,
    ) as Promise<string>;
  },
  getRecordings() {
    return ipcRenderer.invoke("get-recordings") as Promise<RecordingSession[]>;
  },
  deleteRecording(filePath: string) {
    return ipcRenderer.invoke("delete-recording", filePath) as Promise<boolean>;
  },
  exportRecording(params: ExportParams) {
    return ipcRenderer.invoke(
      "export-recording",
      params,
    ) as Promise<ExportResult>;
  },
  getCurrentSummonerFromClient() {
    return ipcRenderer.invoke(
      "lcu-get-current-summoner",
    ) as Promise<LcuCurrentSummonerResult>;
  },
  getChampSelectSessionFromClient() {
    return ipcRenderer.invoke(
      "lcu-get-champ-select-session",
    ) as Promise<LcuChampSelectSessionResult>;
  },
});
