import { ArrowLeft } from 'lucide-react'
import { motion } from 'motion/react'

import { EASE_OUT_EXPO } from './motion'

export function PageHeader({
  right,
  isViewingOther = false,
  onBackToOwn,
}: {
  right?: React.ReactNode
  isViewingOther?: boolean
  onBackToOwn?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="flex items-end justify-between gap-4"
    >
      <div className="min-w-0">
        {isViewingOther && onBackToOwn ? (
          <button
            type="button"
            onClick={onBackToOwn}
            className="group mb-1 inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft
              size={11}
              className="transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
            />
            Back to my profile
          </button>
        ) : (
          <span className="crux-eyebrow mb-1">Overview</span>
        )}
        <h1 className="font-display text-[24px] font-semibold leading-none tracking-[-0.025em] text-foreground">
          {isViewingOther ? 'Player profile' : 'Profile'}
        </h1>
      </div>
      {right}
    </motion.div>
  )
}
