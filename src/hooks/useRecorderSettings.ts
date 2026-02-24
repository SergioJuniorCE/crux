import { useEffect, useState } from 'react'

import {
  DEFAULT_SETTINGS,
  FPS_OPTIONS,
  RESOLUTION_OPTIONS,
  SETTINGS_STORAGE_KEY,
  type RecorderSettings,
  type ResolutionOption,
} from '../types/recorder'

function loadRecorderSettings(): RecorderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<RecorderSettings>
    const isResolutionValid = RESOLUTION_OPTIONS.includes(parsed.resolution as ResolutionOption)
    const isFpsValid = FPS_OPTIONS.includes(parsed.frameRate as (typeof FPS_OPTIONS)[number])

    const maxVideoCount =
      typeof parsed.maxVideoCount === 'number' && parsed.maxVideoCount >= 1
        ? parsed.maxVideoCount
        : DEFAULT_SETTINGS.maxVideoCount
    const maxFolderSizeGB =
      typeof parsed.maxFolderSizeGB === 'number' && parsed.maxFolderSizeGB > 0
        ? parsed.maxFolderSizeGB
        : DEFAULT_SETTINGS.maxFolderSizeGB

    return {
      resolution: isResolutionValid ? (parsed.resolution as ResolutionOption) : DEFAULT_SETTINGS.resolution,
      frameRate: isFpsValid ? (parsed.frameRate as (typeof FPS_OPTIONS)[number]) : DEFAULT_SETTINGS.frameRate,
      maxVideoCount,
      maxFolderSizeGB,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useRecorderSettings() {
  const [settings, setSettings] = useState<RecorderSettings>(loadRecorderSettings)

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  return { settings, setSettings }
}
