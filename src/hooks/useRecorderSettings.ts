import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_DEVICE_PROFILE_NAME,
  DEFAULT_SETTINGS,
  FPS_OPTIONS,
  RESOLUTION_OPTIONS,
  SETTINGS_STORAGE_KEY,
  type RecorderDeviceProfile,
  type RecorderSettings,
  type RecorderSettingsStore,
  type ResolutionOption,
} from '../types/recorder'

function createProfileId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createProfile(
  settings: RecorderSettings = DEFAULT_SETTINGS,
  name = DEFAULT_DEVICE_PROFILE_NAME,
): RecorderDeviceProfile {
  return {
    id: createProfileId(),
    name,
    ...settings,
  }
}

function normalizeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function sanitizeSettings(value: Partial<RecorderSettings> | null | undefined): RecorderSettings {
  const isResolutionValid = RESOLUTION_OPTIONS.includes(value?.resolution as ResolutionOption)
  const isFpsValid = FPS_OPTIONS.includes(value?.frameRate as (typeof FPS_OPTIONS)[number])

  const maxVideoCount =
    typeof value?.maxVideoCount === 'number' && value.maxVideoCount >= 1
      ? Math.floor(value.maxVideoCount)
      : DEFAULT_SETTINGS.maxVideoCount
  const maxFolderSizeGB =
    typeof value?.maxFolderSizeGB === 'number' && value.maxFolderSizeGB > 0
      ? value.maxFolderSizeGB
      : DEFAULT_SETTINGS.maxFolderSizeGB

  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
    resolution: isResolutionValid ? (value?.resolution as ResolutionOption) : DEFAULT_SETTINGS.resolution,
    frameRate: isFpsValid ? (value?.frameRate as (typeof FPS_OPTIONS)[number]) : DEFAULT_SETTINGS.frameRate,
    maxVideoCount,
    maxFolderSizeGB,
  }
}

function sanitizeProfile(value: Partial<RecorderDeviceProfile>, fallbackName: string): RecorderDeviceProfile {
  return {
    id: normalizeName(value.id, createProfileId()),
    name: normalizeName(value.name, fallbackName),
    ...sanitizeSettings(value),
  }
}

function sanitizeStore(value: Partial<RecorderSettingsStore> | null | undefined): RecorderSettingsStore {
  const profiles = Array.isArray(value?.profiles)
    ? value.profiles
        .map((profile, index) => sanitizeProfile(profile, index === 0 ? DEFAULT_DEVICE_PROFILE_NAME : `Device ${index + 1}`))
        .filter((profile, index, all) => all.findIndex((candidate) => candidate.id === profile.id) === index)
    : []

  if (profiles.length === 0) {
    const legacyProfile = createProfile(sanitizeSettings(value as Partial<RecorderSettings>), DEFAULT_DEVICE_PROFILE_NAME)
    return {
      activeProfileId: legacyProfile.id,
      profiles: [legacyProfile],
    }
  }

  const activeProfileId =
    typeof value?.activeProfileId === 'string' && profiles.some((profile) => profile.id === value.activeProfileId)
      ? value.activeProfileId
      : profiles[0].id

  return {
    activeProfileId,
    profiles,
  }
}

function loadRecorderSettings(): RecorderSettingsStore {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return sanitizeStore(null)
    }

    return sanitizeStore(JSON.parse(raw) as Partial<RecorderSettingsStore>)
  } catch {
    return sanitizeStore(null)
  }
}

export function useRecorderSettings() {
  const [store, setStore] = useState<RecorderSettingsStore>(loadRecorderSettings)
  const activeProfile = useMemo(
    () => store.profiles.find((profile) => profile.id === store.activeProfileId) ?? store.profiles[0],
    [store.activeProfileId, store.profiles],
  )
  const settings = useMemo(() => sanitizeSettings(activeProfile), [activeProfile])

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store))
  }, [store])

  const setSettings = useCallback((updater: (current: RecorderSettings) => RecorderSettings) => {
    setStore((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === current.activeProfileId
          ? {
              ...profile,
              ...sanitizeSettings(updater(sanitizeSettings(profile))),
            }
          : profile,
      ),
    }))
  }, [])

  const setActiveProfileId = useCallback((profileId: string) => {
    setStore((current) => {
      if (!current.profiles.some((profile) => profile.id === profileId)) {
        return current
      }

      return {
        ...current,
        activeProfileId: profileId,
      }
    })
  }, [])

  const updateProfile = useCallback((profileId: string, updater: (current: RecorderDeviceProfile) => RecorderDeviceProfile) => {
    setStore((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === profileId ? sanitizeProfile(updater(profile), profile.name) : profile,
      ),
    }))
  }, [])

  const addProfile = useCallback(() => {
    const profile = createProfile(
      {
        ...settings,
        enabled: false,
      },
      `Device ${store.profiles.length + 1}`,
    )

    setStore((current) => ({
      activeProfileId: current.activeProfileId,
      profiles: [...current.profiles, profile],
    }))

    return profile.id
  }, [settings, store.profiles.length])

  const removeProfile = useCallback((profileId: string) => {
    setStore((current) => {
      if (current.profiles.length <= 1) {
        return current
      }

      const profiles = current.profiles.filter((profile) => profile.id !== profileId)
      if (profiles.length === current.profiles.length) {
        return current
      }

      return {
        activeProfileId: current.activeProfileId === profileId ? profiles[0].id : current.activeProfileId,
        profiles,
      }
    })
  }, [])

  return {
    settings,
    setSettings,
    recorderProfiles: store.profiles,
    activeRecorderProfileId: store.activeProfileId,
    setActiveRecorderProfileId: setActiveProfileId,
    updateRecorderProfile: updateProfile,
    addRecorderProfile: addProfile,
    removeRecorderProfile: removeProfile,
  }
}
