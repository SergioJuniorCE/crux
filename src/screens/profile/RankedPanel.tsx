import { Flame } from 'lucide-react'

import type { RankedLpSnapshot } from '@/hooks/useRankedLpHistory'
import type { RiotLeagueEntry } from '../../types/riot'
import { rankedEmblem, tierStyle } from '@/lib/leagueAssets'
import { cn } from '@/lib/utils'
import { Badge } from './Badge'
import { formatQueue, formatTier, relativeTime, winRate } from './utils'

export function RankedPanel({
  entry,
  icon,
  lpHistory = [],
}: {
  entry: RiotLeagueEntry
  icon: React.ReactNode
  lpHistory?: RankedLpSnapshot[]
}) {
  const wr = winRate(entry.wins, entry.losses)
  const style = tierStyle(entry.tier)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {formatQueue(entry.queueType)}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className={cn(
            'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br p-1.5 ring-2',
            style.gradient,
            style.ring,
          )}
        >
          <span className={cn('font-mono text-sm font-black tracking-tight', style.text)}>
            {entry.tier.slice(0, 1)}
            <span className="text-[10px] font-bold">{entry.rank}</span>
          </span>
          <img
            src={rankedEmblem(entry.tier)}
            alt={`${formatTier(entry)} emblem`}
            className="absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] object-contain drop-shadow"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-base font-semibold text-foreground">
            {formatTier(entry)}
          </div>
          <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {entry.leaguePoints} LP
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'font-mono text-base font-semibold tabular-nums',
              wr >= 60 ? 'text-emerald-300' : wr >= 50 ? 'text-foreground' : 'text-red-300',
            )}
          >
            {wr}%
          </div>
          <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {entry.wins}W · {entry.losses}L
          </div>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={cn(
            'h-full',
            wr >= 60
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
              : wr >= 50
                ? 'bg-gradient-to-r from-emerald-500 to-primary'
                : 'bg-gradient-to-r from-red-500 to-amber-400',
          )}
          style={{ width: `${Math.max(wr, 4)}%` }}
        />
      </div>

      <LpHistoryGraph entry={entry} history={lpHistory} />

      {(entry.hotStreak || entry.veteran || entry.freshBlood || entry.inactive) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.hotStreak && <Badge icon={<Flame size={10} />} tone="primary" label="Hot streak" />}
          {entry.veteran && <Badge label="Veteran" />}
          {entry.freshBlood && <Badge label="Fresh blood" />}
          {entry.inactive && <Badge tone="muted" label="Inactive" />}
        </div>
      )}
    </section>
  )
}

type LpPoint = {
  tier: string
  rank: string
  lp: number
  wins: number
  losses: number
  timestamp: number
}

function LpHistoryGraph({
  entry,
  history,
}: {
  entry: RiotLeagueEntry
  history: RankedLpSnapshot[]
}) {
  const points = buildLpHistory(entry, history)
  const width = 268
  const height = 112
  const padX = 8
  const padY = 10
  const graphWidth = width - padX * 2
  const graphHeight = height - padY * 2
  const xStep = points.length > 1 ? graphWidth / (points.length - 1) : graphWidth
  const coords = points.map((point, index) => ({
    ...point,
    x: points.length > 1 ? padX + index * xStep : width - padX,
    y: padY + (1 - point.lp / 100) * graphHeight,
  }))
  const currentLp = entry.leaguePoints
  const peak = Math.max(...points.map((point) => point.lp))
  const delta = currentLp - points[0].lp
  const hasHistory = points.length > 1

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06] bg-[#15182a]/70">
      <div className="flex items-center justify-between px-3 pt-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            LP history
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
            {hasHistory ? 'Observed from profile refreshes' : 'Tracking starts now'}
          </div>
        </div>
        <div
          className={cn(
            'font-mono text-[11px] font-semibold tabular-nums',
            delta >= 0 ? 'text-emerald-300' : 'text-red-300',
          )}
        >
          {delta >= 0 ? '+' : ''}
          {delta} LP
        </div>
      </div>

      <div className="relative mt-2 px-2">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${formatQueue(entry.queueType)} LP history`} className="h-32 w-full">
          <defs>
            <linearGradient id={`lp-fill-${entry.queueType}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(129 140 248)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="rgb(129 140 248)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[100, 75, 50, 25, 0].map((lp) => {
            const y = padY + (1 - lp / 100) * graphHeight
            return (
              <g key={lp}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke={lp === 0 || lp === 100 ? 'rgb(52 211 153 / 0.45)' : 'rgb(129 140 248 / 0.26)'}
                  strokeDasharray={lp === 0 || lp === 100 ? '7 7' : '3 6'}
                />
                <text x={width - padX - 2} y={y - 3} textAnchor="end" className="fill-slate-400/60 font-mono text-[8px]">
                  {lp}
                </text>
              </g>
            )
          })}

          {coords.length > 1 && (
            <path
              d={`${coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`}
              fill={`url(#lp-fill-${entry.queueType})`}
            />
          )}

          {coords.slice(1).map((point, index) => {
            const previous = coords[index]
            const gaining = point.lp >= previous.lp
            return (
              <g key={`${point.x}-${point.y}`}>
                <line
                  x1={previous.x}
                  x2={point.x}
                  y1={previous.y}
                  y2={point.y}
                  stroke={gaining ? 'rgb(74 222 128 / 0.18)' : 'rgb(129 140 248 / 0.18)'}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <line
                  x1={previous.x}
                  x2={point.x}
                  y1={previous.y}
                  y2={point.y}
                  stroke={gaining ? 'rgb(74 222 128)' : 'rgb(129 140 248)'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </g>
            )
          })}

          {coords.map((point, index) => (
            <circle
              key={`${point.timestamp}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === coords.length - 1 ? 3 : 2}
              className={index === coords.length - 1 ? 'fill-primary' : 'fill-indigo-300'}
            >
              <title>
                {formatSnapshotTier(point)}
                {' · '}
                {point.lp} LP
                {' · '}
                {relativeTime(point.timestamp)}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] bg-white/[0.03]">
        <GraphStat label={hasHistory ? 'Start' : 'Now'} value={`${points[0].lp} LP`} />
        <GraphStat label="Peak" value={`${peak} LP`} tone="primary" />
        <GraphStat label="Current" value={`${currentLp} LP`} />
      </div>
    </div>
  )
}

function GraphStat({
  label,
  value,
  tone = 'muted',
}: {
  label: string
  value: string
  tone?: 'muted' | 'primary'
}) {
  return (
    <div className="px-2 py-2 text-center">
      <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 font-mono text-[11px] font-semibold tabular-nums',
          tone === 'primary' ? 'text-primary' : 'text-foreground/85',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function buildLpHistory(entry: RiotLeagueEntry, history: RankedLpSnapshot[]): LpPoint[] {
  const snapshots = history
    .filter((snapshot) => snapshot.queueType === entry.queueType)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-24)

  if (snapshots.length > 0) {
    return snapshots.map((snapshot) => ({
      tier: snapshot.tier,
      rank: snapshot.rank,
      lp: clampLp(snapshot.leaguePoints),
      wins: snapshot.wins,
      losses: snapshot.losses,
      timestamp: snapshot.timestamp,
    }))
  }

  return [
    {
      tier: entry.tier,
      rank: entry.rank,
      lp: clampLp(entry.leaguePoints),
      wins: entry.wins,
      losses: entry.losses,
      timestamp: Date.now(),
    },
  ]
}

function clampLp(lp: number) {
  return Math.min(100, Math.max(0, Math.round(lp)))
}

function formatSnapshotTier(point: LpPoint) {
  const tier = point.tier.charAt(0) + point.tier.slice(1).toLowerCase()
  return `${tier} ${point.rank}`
}

export function EmptyRankedPanel({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="mt-3 font-mono text-sm text-muted-foreground">Unranked</div>
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
        Play placement matches to rank this queue.
      </p>
    </section>
  )
}
