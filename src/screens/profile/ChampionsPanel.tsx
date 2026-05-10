import { Target } from 'lucide-react'
import { motion } from 'motion/react'

import { ddragonChampionSquare } from '@/lib/leagueAssets'
import { cn } from '@/lib/utils'
import type { ChampionStats } from './aggregate'
import { AnimatedNumber } from './AnimatedNumber'
import { EASE_OUT_EXPO, listItem, listStagger } from './motion'
import { formatKda, winRate } from './utils'

export function ChampionsPanel({
  champions,
  version,
}: {
  champions: ChampionStats[]
  version: string
}) {
  if (champions.length === 0) return null
  const top = champions.slice(0, 10)
  const maxGames = Math.max(...top.map((c) => c.games), 1)

  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Target size={11} className="text-primary/80" />
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Champion performance
        </span>
      </div>
      <motion.ul
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="mt-2 flex flex-col gap-1"
      >
        {top.map((c) => {
          const wr = winRate(c.wins, c.losses)
          const kda = formatKda(c.kills, c.deaths, c.assists)
          const wrTone =
            wr >= 60
              ? 'text-emerald-300'
              : wr >= 50
                ? 'text-foreground'
                : 'text-red-300'
          return (
            <motion.li
              key={c.championName}
              variants={listItem}
              whileHover={{ x: 1 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="group relative flex items-center gap-2 overflow-hidden rounded-md bg-background/30 px-1.5 py-1 transition-colors hover:bg-background/50"
            >
              {/* Subtle play-share bar across the row background */}
              <motion.span
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: c.games / maxGames }}
                transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.15 }}
                style={{ transformOrigin: '0% 50%' }}
                className="absolute inset-y-0 left-0 right-0 -z-0 bg-primary/[0.04]"
              />
              <img
                src={ddragonChampionSquare(version, c.championName)}
                alt={c.championName}
                className="relative h-7 w-7 shrink-0 rounded-md border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
              <div className="relative min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-medium leading-tight text-foreground">
                  {c.championName}
                </div>
                <div className="mt-0.5 font-mono text-[9.5px] leading-none tabular-nums text-muted-foreground">
                  {kda} KDA
                </div>
              </div>
              <div className="relative shrink-0 text-right">
                <AnimatedNumber
                  value={wr}
                  suffix="%"
                  duration={0.9}
                  className={cn(
                    'font-mono text-[11.5px] font-semibold leading-tight tabular-nums',
                    wrTone,
                  )}
                />
                <div className="font-mono text-[9px] leading-none tabular-nums text-muted-foreground">
                  {c.games}G
                </div>
              </div>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}
