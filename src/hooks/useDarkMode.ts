import { useEffect, useState } from 'react'

const STORAGE_KEY = 'crux-dark-mode'

function getInitial(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) return stored === 'true'
  return true // default to dark
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(STORAGE_KEY, String(isDark))
  }, [isDark])

  const toggle = () => setIsDark((prev) => !prev)

  return { isDark, toggle }
}
