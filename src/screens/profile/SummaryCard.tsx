import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Aggregates } from './aggregate'
import { formatKda, winRate } from './utils'

export function SummaryCard({ stats }: { stats: Aggregates }) {
  const { totals } = stats
  const wr = winRate(totals.wins, totals.losses)
  const kda = formatKda(totals.kills, totals.deaths, totals.assists)
  const kdaNum = totals.deaths === 0 ? totals.kills + totals.assists : (totals.kills + totals.assists) / totals.deaths

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Last {totals.games} games performance
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 items-center gap-4 sm:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-4">
          <WinRateRing wr={wr} wins={totals.wins} losses={totals.losses} />
          <div className="hidden sm:block">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Record
            </div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              <span className="text-emerald-300">{totals.wins}W</span>
              <span className="mx-1 text-muted-foreground">·</span>
              <span className="text-red-300">{totals.losses}L</span>
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-3 sm:justify-center">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              KDA
            </div>
            <div
              className={cn(
                'font-mono text-3xl font-semibold tabular-nums',
                kdaNum >= 4
                  ? 'text-amber-300'
                  : kdaNum >= 3
                    ? 'text-emerald-300'
                    : kdaNum >= 2
                      ? 'text-foreground'
                      : 'text-red-300',
              )}
            >
              {kda}
            </div>
          </div>
          <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {(totals.kills / Math.max(1, totals.games)).toFixed(1)}
            {' / '}
            <span className="text-red-300/70">
              {(totals.deaths / Math.max(1, totals.games)).toFixed(1)}
            </span>
            {' / '}
            {(totals.assists / Math.max(1, totals.games)).toFixed(1)}
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Games
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
            {totals.games}
          </div>
        </div>
      </div>
    </section>
  )
}

function WinRateRing({ wr, wins, losses }: { wr: number; wins: number; losses: number }) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const dash = (wr / 100) * circumference
  const color = wr >= 60 ? 'stroke-emerald-400' : wr >= 50 ? 'stroke-primary' : 'stroke-red-400'

  return (
    <div className="relative h-[72px] w-[72px]">
      <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90">
        <circle cx="36" cy="36" r={radius} className="fill-none stroke-white/5" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          className={cn('fill-none transition-all', color)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{wr}%</span>
        <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
          {wins}W · {losses}L
        </span>
      </div>
    </div>
  )
}
