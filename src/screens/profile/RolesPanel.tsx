import { Shield } from 'lucide-react'
import { motion } from 'motion/react'

import { ROLE_LABELS } from '@/lib/leagueAssets'
import type { RoleStats } from './aggregate'
import { AnimatedNumber } from './AnimatedNumber'
import { EASE_OUT_EXPO, listItem, listStagger } from './motion'

export function RolesPanel({ roles }: { roles: RoleStats[] }) {
  if (roles.length === 0) return null
  const totalGames = roles.reduce((sum, r) => sum + r.games, 0)

  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Shield size={11} className="text-primary/80" />
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Role performance
        </span>
      </div>
      <motion.ul
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="mt-2 flex flex-col gap-1.5"
      >
        {roles.map((r) => {
          const wr = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0
          const shareWidth = totalGames > 0 ? (r.games / totalGames) * 100 : 0
          const wrTone =
            wr >= 60
              ? 'text-emerald-300'
              : wr >= 50
                ? 'text-foreground'
                : 'text-red-300'
          return (
            <motion.li key={r.role} variants={listItem}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  {ROLE_LABELS[r.role] ?? r.role}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {r.games}G ·{' '}
                  <AnimatedNumber
                    value={wr}
                    suffix="%"
                    duration={0.9}
                    className={wrTone}
                  />
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div
                  className="h-full bg-primary/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(shareWidth, 3)}%` }}
                  transition={{
                    duration: 1,
                    ease: EASE_OUT_EXPO,
                    delay: 0.2,
                  }}
                />
              </div>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}
