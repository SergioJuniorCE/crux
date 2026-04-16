import { useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Optional placeholder override. */
  placeholder?: string
}

/**
 * Global player lookup. Accepts `Name#TAG` (with or without the `#`) and
 * navigates to `/profile/:gameName/:tagLine`. The region used for the lookup
 * is whatever the user has currently saved in Riot settings (enforced by the
 * `ProfileView` route which reuses `effectiveRiotSettings`).
 */
export function PlayerSearch({ className, placeholder = 'Search summoner (Name#TAG)' }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const raw = value.trim()
    if (!raw) return

    // Accept forms like "Name#TAG", "Name #TAG", "Name-TAG" (some sites use this).
    const match = raw.match(/^(.+?)\s*[#\-]\s*([A-Za-z0-9]+)$/)
    if (!match) {
      setError('Use the format Name#TAG')
      return
    }
    const [, gameName, tagLine] = match
    const cleanName = gameName.trim()
    const cleanTag = tagLine.trim()
    if (!cleanName || !cleanTag) {
      setError('Use the format Name#TAG')
      return
    }
    setError(null)
    navigate(`/profile/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`)
  }

  const clear = () => {
    setValue('')
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)} role="search">
      <Search
        size={13}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (error) setError(null)
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          'h-8 w-full rounded-md border bg-card pl-7 pr-7 text-[12.5px] font-medium text-foreground placeholder:text-muted-foreground/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
          error ? 'border-red-500/50' : 'border-border focus:border-white/15',
        )}
        aria-label="Search summoner by Riot ID"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X size={12} />
        </button>
      )}
      {error && (
        <div className="absolute left-0 top-full mt-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-300 shadow-lg">
          {error}
        </div>
      )}
    </form>
  )
}
