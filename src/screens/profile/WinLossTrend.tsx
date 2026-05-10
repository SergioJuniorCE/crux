import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import { EASE_OUT_EXPO } from './motion'
import { relativeTime } from './utils'

export function WinLossTrend({
  recent,
}: {
  recent: { win: boolean; timestamp: number }[]
}) {
  const series = [...recent].slice(0, 20).reverse()

  return (
    <div className="flex items-end gap-1">
      {series.map((r, i) => (
        <motion.span
          key={`${r.timestamp}-${i}`}
          title={`${r.win ? 'Win' : 'Loss'} · ${relativeTime(r.timestamp)}`}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            duration: 0.45,
            ease: EASE_OUT_EXPO,
            delay: 0.05 + i * 0.025,
          }}
          style={{ transformOrigin: '50% 100%' }}
          className={cn(
            'h-6 flex-1 min-w-[10px] rounded-sm transition-colors',
            r.win
              ? 'bg-emerald-400/80 hover:bg-emerald-400'
              : 'bg-red-400/70 hover:bg-red-400',
          )}
        />
      ))}
    </div>
  )
}
