import { useCallback, useEffect, useRef, useState } from 'react'

import type { LcuCurrentSummoner } from '../types/riot'

type LcuState = {
  status: 'idle' | 'loading' | 'live' | 'unavailable'
  data: LcuCurrentSummoner | null
  error: string | null
  lastCheckedAt: number | null
}

const INITIAL: LcuState = {
  status: 'idle',
  data: null,
  error: null,
  lastCheckedAt: null,
}

type Options = {
  /** Poll interval in ms while the app is open. Pass 0 to disable polling. */
  pollMs?: number
  /** Re-check when the browser window regains focus. */
  refetchOnFocus?: boolean
}

/**
 * Watches the local League client (LCU) for the currently signed-in summoner.
 *
 * - Does a lookup on mount.
 * - Polls on an interval (default 30s) so state stays fresh when the user
 *   logs in/out of the client while Crux is running.
 * - Re-polls on window focus so switching back from the client triggers an
 *   immediate refresh.
 * - Keeps the previous `data` when a later poll fails (e.g. client closed)
 *   until a successful response resets it — avoids UI flicker.
 */
export function useLcuCurrentSummoner(options: Options = {}) {
  const { pollMs = 30_000, refetchOnFocus = true } = options
  const [state, setState] = useState<LcuState>(INITIAL)
  const inFlightRef = useRef(false)

  const fetchOnce = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setState((prev) => ({ ...prev, status: prev.status === 'idle' ? 'loading' : prev.status }))

    try {
      const result = await window.electronAPI.getCurrentSummonerFromClient()
      if (result.success) {
        setState({
          status: 'live',
          data: result.data,
          error: null,
          lastCheckedAt: Date.now(),
        })
      } else {
        setState((prev) => ({
          status: 'unavailable',
          data: prev.data,
          error: result.error,
          lastCheckedAt: Date.now(),
        }))
      }
    } catch (err) {
      setState((prev) => ({
        status: 'unavailable',
        data: prev.data,
        error: err instanceof Error ? err.message : String(err),
        lastCheckedAt: Date.now(),
      }))
    } finally {
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchOnce()

    if (pollMs <= 0) return

    const interval = setInterval(() => {
      void fetchOnce()
    }, pollMs)

    return () => clearInterval(interval)
  }, [fetchOnce, pollMs])

  useEffect(() => {
    if (!refetchOnFocus) return
    const handler = () => {
      void fetchOnce()
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [fetchOnce, refetchOnFocus])

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    lastCheckedAt: state.lastCheckedAt,
    isLive: state.status === 'live' && state.data !== null,
    refetch: fetchOnce,
  }
}
