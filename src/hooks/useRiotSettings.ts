import { useEffect, useState } from 'react'

import { PLATFORM_REGIONS, type PlatformRegion } from '../types/riot'

export type RiotSettings = {
  apiKey: string
  gameName: string
  tagLine: string
  platform: PlatformRegion
}

const RIOT_SETTINGS_KEY = 'crux-riot-settings'

export const DEFAULT_RIOT_SETTINGS: RiotSettings = {
  apiKey: '',
  gameName: '',
  tagLine: '',
  platform: 'na1',
}

function loadRiotSettings(): RiotSettings {
  try {
    const raw = localStorage.getItem(RIOT_SETTINGS_KEY)
    if (!raw) {
      return DEFAULT_RIOT_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<RiotSettings>
    const platform = PLATFORM_REGIONS.includes(parsed.platform as PlatformRegion)
      ? (parsed.platform as PlatformRegion)
      : DEFAULT_RIOT_SETTINGS.platform

    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      gameName: typeof parsed.gameName === 'string' ? parsed.gameName : '',
      tagLine: typeof parsed.tagLine === 'string' ? parsed.tagLine : '',
      platform,
    }
  } catch {
    return DEFAULT_RIOT_SETTINGS
  }
}

export function useRiotSettings() {
  const [settings, setSettings] = useState<RiotSettings>(loadRiotSettings)

  useEffect(() => {
    localStorage.setItem(RIOT_SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  return { settings, setSettings }
}

export function isRiotConfigured(
  settings: RiotSettings,
  options: { hasEnvKey?: boolean } = {},
): boolean {
  const hasKey = Boolean(settings.apiKey) || Boolean(options.hasEnvKey)
  return hasKey && Boolean(settings.gameName) && Boolean(settings.tagLine)
}
