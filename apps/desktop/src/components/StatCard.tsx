import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  valueClassName?: string
  className?: string
}

export function StatCard({ label, value, sub, icon, valueClassName, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-white/10',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <div
        className={cn(
          'mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground truncate',
          valueClassName,
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  )
}
