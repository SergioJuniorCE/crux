import { useEffect, useState } from "react";

import { PLATFORM_REGIONS, type PlatformRegion } from "../types/riot";

export type RiotSettings = {
  /** Crux backend URL (e.g. http://localhost:3001) */
  backendUrl: string;
  /** Summoner game name (Riot ID name) */
  gameName: string;
  /** Summoner tag line (e.g. "NA1", "KR1") */
  tagLine: string;
  /** Platform region (e.g. "na1", "euw1") */
  platform: PlatformRegion;
};

const RIOT_SETTINGS_KEY = "crux-riot-settings";

export const DEFAULT_RIOT_SETTINGS: RiotSettings = {
  backendUrl: "http://localhost:3001",
  gameName: "",
  tagLine: "",
  platform: "na1",
};

function loadRiotSettings(): RiotSettings {
  try {
    const raw = localStorage.getItem(RIOT_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_RIOT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<RiotSettings>;
    const platform = PLATFORM_REGIONS.includes(parsed.platform as PlatformRegion)
      ? (parsed.platform as PlatformRegion)
      : DEFAULT_RIOT_SETTINGS.platform;

    return {
      backendUrl:
        typeof parsed.backendUrl === "string" && parsed.backendUrl.trim()
          ? parsed.backendUrl.trim()
          : DEFAULT_RIOT_SETTINGS.backendUrl,
      gameName: typeof parsed.gameName === "string" ? parsed.gameName : "",
      tagLine: typeof parsed.tagLine === "string" ? parsed.tagLine : "",
      platform,
    };
  } catch {
    return DEFAULT_RIOT_SETTINGS;
  }
}

export function useRiotSettings() {
  const [settings, setSettings] = useState<RiotSettings>(loadRiotSettings);

  useEffect(() => {
    localStorage.setItem(RIOT_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
}

/**
 * Returns true when the user has entered enough info to look up a profile.
 * In the split architecture, the API key lives on the backend, so we only
 * check for game name and tag line.
 */
export function isRiotConfigured(settings: RiotSettings): boolean {
  return Boolean(settings.gameName) && Boolean(settings.tagLine);
}
