import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'
import type { Aggregates } from './aggregate'
import { AnimatedNumber } from './AnimatedNumber'
import { EASE_OUT_EXPO } from './motion'
import { winRate } from './utils'

export function SummaryCard({ stats }: { stats: Aggregates }) {
  const { totals } = stats
  const wr = winRate(totals.wins, totals.losses)
  const kdaNum =
    totals.deaths === 0
      ? totals.kills + totals.assists
      : (totals.kills + totals.assists) / totals.deaths

  const kdaTone =
    kdaNum >= 4
      ? 'text-amber-300'
      : kdaNum >= 3
        ? 'text-emerald-300'
        : kdaNum >= 2
          ? 'text-foreground'
          : 'text-red-300'

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5">
      {/* Editorial vertical hairline anchored to the left of the title */}
      <span className="pointer-events-none absolute left-0 top-3 h-4 w-0.5 rounded-r-full bg-primary/70" />

      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Form
        </span>
        <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground/60">
          / last {totals.games} games
        </span>
        <span className="ml-auto h-px flex-1 self-center bg-gradient-to-r from-border to-transparent" />
      </div>

      <div className="mt-3 grid grid-cols-2 items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-3">
          <WinRateRing wr={wr} wins={totals.wins} losses={totals.losses} />
          <div className="hidden sm:block">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Record
            </div>
            <div className="mt-1 font-mono text-[12px] tabular-nums">
              <AnimatedNumber
                value={totals.wins}
                suffix="W"
                className="text-emerald-300"
              />
              <span className="mx-1 text-muted-foreground">·</span>
              <AnimatedNumber
                value={totals.losses}
                suffix="L"
                className="text-red-300"
              />
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-3 sm:justify-center">
          <div>
            <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              KDA
            </div>
            <AnimatedNumber
              value={kdaNum}
              decimals={2}
              duration={1.2}
              className={cn(
                'mt-0.5 inline-block font-display text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums',
                kdaTone,
              )}
            />
          </div>
          <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
            <AnimatedNumber
              value={totals.kills / Math.max(1, totals.games)}
              decimals={1}
            />
            {' / '}
            <AnimatedNumber
              value={totals.deaths / Math.max(1, totals.games)}
              decimals={1}
              className="text-red-300/70"
            />
            {' / '}
            <AnimatedNumber
              value={totals.assists / Math.max(1, totals.games)}
              decimals={1}
            />
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Games
          </div>
          <AnimatedNumber
            value={totals.games}
            duration={0.9}
            className="mt-0.5 inline-block font-display text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground"
          />
        </div>
      </div>
    </section>
  )
}

function WinRateRing({
  wr,
  wins,
  losses,
}: {
  wr: number
  wins: number
  losses: number
}) {
  const reduced = useReducedMotion()
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const dash = (wr / 100) * circumference
  const color =
    wr >= 60 ? 'stroke-emerald-400' : wr >= 50 ? 'stroke-primary' : 'stroke-red-400'

  return (
    <div className="relative h-[60px] w-[60px]">
      <svg viewBox="0 0 60 60" className="h-[60px] w-[60px] -rotate-90">
        <circle cx="30" cy="30" r={radius} className="fill-none stroke-white/5" strokeWidth="5" />
        <motion.circle
          cx="30"
          cy="30"
          r={radius}
          className={cn('fill-none', color)}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? circumference - dash : circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{
            duration: reduced ? 0 : 1.1,
            ease: EASE_OUT_EXPO,
            delay: 0.15,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={wr}
          suffix="%"
          duration={1.1}
          className="font-mono text-[12px] font-semibold leading-none tabular-nums text-foreground"
        />
        <span className="mt-0.5 font-mono text-[8px] leading-none tabular-nums text-muted-foreground">
          {wins}W · {losses}L
        </span>
      </div>
    </div>
  )
}
