export type RecordingState = 'idle' | 'recording' | 'saving' | 'saved' | 'error'
export type AppPage = 'recorder' | 'settings'

export const RESOLUTION_OPTIONS = ['1280x720', '1600x900', '1920x1080', '2560x1440'] as const
export type ResolutionOption = (typeof RESOLUTION_OPTIONS)[number]

export const FPS_OPTIONS = [30, 60, 120] as const
export type FrameRateOption = (typeof FPS_OPTIONS)[number]

export type RecorderSettings = {
  resolution: ResolutionOption
  frameRate: FrameRateOption
  maxVideoCount: number
  maxFolderSizeGB: number
}

export const SETTINGS_STORAGE_KEY = 'crux-settings'

export const DEFAULT_SETTINGS: RecorderSettings = {
  resolution: '1920x1080',
  frameRate: 60,
  maxVideoCount: 20,
  maxFolderSizeGB: 10,
}
