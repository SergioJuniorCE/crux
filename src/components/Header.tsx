import { NavLink } from 'react-router-dom'
import { Moon, Sun, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusPill, type StatusPillVariant } from './StatusPill'
import { PlayerSearch } from './PlayerSearch'
import type { RecordingState } from '../types/recorder'

type Props = {
  gameActive: boolean
  recordingState: RecordingState
  isDark: boolean
  onToggleDark: () => void
}

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Profile', end: true },
  { to: '/recorder', label: 'Recorder' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/settings', label: 'Settings' },
]

function deriveStatus(gameActive: boolean, state: RecordingState): StatusPillVariant {
  if (state === 'recording') return 'recording'
  if (state === 'saving') return 'saving'
  if (state === 'error') return 'error'
  if (gameActive) return 'live'
  return 'idle'
}

export function Header({ gameActive, recordingState, isDark, onToggleDark }: Props) {
  const status = deriveStatus(gameActive, recordingState)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
            <Zap size={13} strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Crux
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-primary transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <PlayerSearch className="w-64" />
          <StatusPill variant={status} />
          <button
            type="button"
            onClick={onToggleDark}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground hover:border-white/15"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </header>
  )
}
