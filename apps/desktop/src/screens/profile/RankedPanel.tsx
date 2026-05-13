import { Flame } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import type { RankedLpSnapshot } from '@/hooks/useRankedLpHistory'
import type { RiotLeagueEntry } from '../../types/riot'
import { rankedEmblem, tierStyle } from '@/lib/leagueAssets'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './AnimatedNumber'
import { Badge } from './Badge'
import { EASE_OUT_EXPO } from './motion'
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

  const wrTone =
    wr >= 60
      ? 'text-emerald-300'
      : wr >= 50
        ? 'text-foreground'
        : 'text-red-300'
  const barTone =
    wr >= 60
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
      : wr >= 50
        ? 'bg-gradient-to-r from-emerald-500 to-primary'
        : 'bg-gradient-to-r from-red-500 to-amber-400'

  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {formatQueue(entry.queueType)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.1 }}
          className={cn(
            'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br p-1 ring-2',
            style.gradient,
            style.ring,
          )}
        >
          <span
            className={cn(
              'font-mono text-[11px] font-black leading-none tracking-tight',
              style.text,
            )}
          >
            {entry.tier.slice(0, 1)}
            <span className="text-[9px] font-bold">{entry.rank}</span>
          </span>
          <img
            src={rankedEmblem(entry.tier)}
            alt={`${formatTier(entry)} emblem`}
            className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] object-contain drop-shadow"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[14px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {formatTier(entry)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            <AnimatedNumber value={entry.leaguePoints} suffix=" LP" duration={1} />
          </div>
        </div>
        <div className="text-right">
          <AnimatedNumber
            value={wr}
            suffix="%"
            duration={1}
            className={cn(
              'font-mono text-sm font-semibold leading-tight tabular-nums',
              wrTone,
            )}
          />
          <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {entry.wins}W · {entry.losses}L
          </div>
        </div>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className={cn('h-full', barTone)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(wr, 4)}%` }}
          transition={{ duration: 1.05, ease: EASE_OUT_EXPO, delay: 0.2 }}
        />
      </div>

      <LpHistoryGraph entry={entry} history={lpHistory} />

      {(entry.hotStreak || entry.veteran || entry.freshBlood || entry.inactive) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.hotStreak && (
            <Badge icon={<Flame size={10} />} tone="primary" label="Hot streak" />
          )}
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
  const reduced = useReducedMotion()
  const points = buildLpHistory(entry, history)
  const width = 268
  const height = 80
  const padX = 8
  const padY = 8
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
  const linePath =
    coords.length > 1
      ? coords
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ')
      : ''
  const fillPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`
      : ''

  return (
    <div className="mt-2.5 overflow-hidden rounded-lg border border-white/[0.06] bg-[#15182a]/70">
      <div className="flex items-center justify-between px-2.5 pt-2">
        <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          LP history
        </div>
        <motion.div
          key={delta}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: 0.6 }}
          className={cn(
            'font-mono text-[10px] font-semibold tabular-nums',
            delta >= 0 ? 'text-emerald-300' : 'text-red-300',
          )}
        >
          {delta >= 0 ? '+' : ''}
          {delta} LP
        </motion.div>
      </div>

      <div className="relative mt-1 px-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${formatQueue(entry.queueType)} LP history`}
          className="h-20 w-full"
        >
          <defs>
            <linearGradient id={`lp-fill-${entry.queueType}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(245 197 24)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="rgb(245 197 24)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`lp-stroke-${entry.queueType}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgb(129 140 248)" />
              <stop offset="100%" stopColor="rgb(245 197 24)" />
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
                  stroke={
                    lp === 0 || lp === 100
                      ? 'rgb(245 197 24 / 0.28)'
                      : 'rgb(129 140 248 / 0.18)'
                  }
                  strokeDasharray={lp === 0 || lp === 100 ? '7 7' : '3 6'}
                />
                <text
                  x={width - padX - 2}
                  y={y - 3}
                  textAnchor="end"
                  className="fill-slate-400/55 font-mono text-[8px]"
                >
                  {lp}
                </text>
              </g>
            )
          })}

          {fillPath && (
            <motion.path
              d={fillPath}
              fill={`url(#lp-fill-${entry.queueType})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.6 }}
            />
          )}

          {linePath && (
            <motion.path
              d={linePath}
              fill="none"
              stroke={`url(#lp-stroke-${entry.queueType})`}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduced ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.25 },
                opacity: { duration: 0.4, delay: 0.25 },
              }}
            />
          )}

          {coords.map((point, index) => {
            const isLast = index === coords.length - 1
            return (
              <motion.circle
                key={`${point.timestamp}-${index}`}
                cx={point.x}
                cy={point.y}
                r={isLast ? 3 : 2}
                className={isLast ? 'fill-primary' : 'fill-indigo-300'}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.35,
                  ease: EASE_OUT_EXPO,
                  delay: 0.5 + index * 0.04,
                }}
                style={{ originX: `${point.x}px`, originY: `${point.y}px` }}
              >
                <title>
                  {formatSnapshotTier(point)}
                  {' · '}
                  {point.lp} LP
                  {' · '}
                  {relativeTime(point.timestamp)}
                </title>
              </motion.circle>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] bg-white/[0.03]">
        <GraphStat label={hasHistory ? 'Start' : 'Now'} value={points[0].lp} delay={0.7} />
        <GraphStat label="Peak" value={peak} tone="primary" delay={0.78} />
        <GraphStat label="Current" value={currentLp} delay={0.86} />
      </div>
    </div>
  )
}

function GraphStat({
  label,
  value,
  tone = 'muted',
  delay = 0,
}: {
  label: string
  value: number
  tone?: 'muted' | 'primary'
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT_EXPO, delay }}
      className="px-2 py-1.5 text-center"
    >
      <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <AnimatedNumber
        value={value}
        suffix=" LP"
        duration={0.9}
        className={cn(
          'mt-0.5 inline-block font-mono text-[10px] font-semibold tabular-nums',
          tone === 'primary' ? 'text-primary' : 'text-foreground/85',
        )}
      />
    </motion.div>
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

export function EmptyRankedPanel({
  label,
  icon,
}: {
  label: string
  icon: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card/50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/70">{icon}</span>
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 font-display text-[14px] font-semibold tracking-[-0.02em] text-muted-foreground">
        Unranked
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground/80">
        Play placement matches to rank this queue.
      </p>
    </section>
  )
}
