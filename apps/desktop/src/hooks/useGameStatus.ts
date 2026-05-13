import { useEffect, useState } from 'react'

export function useGameStatus() {
  const [gameActive, setGameActive] = useState(false)

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onGameStatus(({ active }) => {
      setGameActive(active)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  return gameActive
}
