import { useEffect, useState } from 'react'

/**
 * Reports whether the Electron main process has a `RIOT_API_KEY` loaded
 * from `.env`. When true, the renderer can skip asking the user for a key.
 */
export function useRiotEnvStatus() {
  const [hasEnvKey, setHasEnvKey] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await window.electronAPI.getRiotEnvStatus()
        if (!cancelled) {
          setHasEnvKey(result.hasEnvKey)
          setLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setHasEnvKey(false)
          setLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { hasEnvKey, loaded }
}
