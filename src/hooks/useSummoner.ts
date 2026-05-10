import { useCallback, useEffect, useRef, useState } from 'react'

import type { RiotProfileBundle } from '../types/riot'
import type { RiotSettings } from './useRiotSettings'

type Status = 'idle' | 'loading' | 'success' | 'error'

type State = {
  status: Status
  data: RiotProfileBundle | null
  error: string | null
  lastFetchedAt: number | null
}

const INITIAL_STATE: State = {
  status: 'idle',
  data: null,
  error: null,
  lastFetchedAt: null,
}

type UseSummonerOptions = {
  matchCount?: number
  refreshKey?: number
  hasEnvKey?: boolean
}

/**
 * Fetches the Riot summoner bundle (profile, rank, recent matches).
 * Re-fetches when Riot settings, matchCount, or `refreshKey` change.
 * When `hasEnvKey` is true, the renderer may skip sending an api key and
 * the main process will fall back to `process.env.RIOT_API_KEY`.
 */
export function useSummoner(settings: RiotSettings, options: UseSummonerOptions = {}) {
  const { matchCount = 10, refreshKey = 0, hasEnvKey = false } = options
  const [state, setState] = useState<State>(INITIAL_STATE)
  const requestIdRef = useRef(0)
  const platform = settings.platform
  const gameName = settings.gameName.trim()
  const tagLine = settings.tagLine.replace(/^#/, '').trim()
  const apiKey = settings.apiKey.trim()

  const fetchBundle = useCallback(async () => {
    if (!(apiKey || hasEnvKey) || !gameName || !tagLine) {
      setState(INITIAL_STATE)
      return
    }

    const reqId = ++requestIdRef.current
    setState((prev) => ({ ...prev, status: 'loading', error: null }))

    try {
      const result = await window.electronAPI.getRiotSummoner({
        platform,
        gameName,
        tagLine,
        apiKey: apiKey || undefined,
        matchCount,
      })

      if (reqId !== requestIdRef.current) {
        return
      }

      if (result.success) {
        setState({
          status: 'success',
          data: result.data,
          error: null,
          lastFetchedAt: Date.now(),
        })
      } else {
        setState({
          status: 'error',
          data: null,
          error: result.error,
          lastFetchedAt: Date.now(),
        })
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return
      setState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : String(err),
        lastFetchedAt: Date.now(),
      })
    }
  }, [apiKey, gameName, hasEnvKey, matchCount, platform, tagLine])

  useEffect(() => {
    void fetchBundle()
  }, [fetchBundle, refreshKey])

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    lastFetchedAt: state.lastFetchedAt,
    refetch: fetchBundle,
  }
}
