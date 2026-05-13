import { cn } from '@/lib/utils'

export type StatusPillVariant = 'recording' | 'live' | 'idle' | 'saving' | 'error'

type Props = {
  variant: StatusPillVariant
  label?: string
  className?: string
}

const CONFIG: Record<
  StatusPillVariant,
  { label: string; dot: string; text: string; ring: string; pulse?: string }
> = {
  recording: {
    label: 'Recording',
    dot: 'bg-red-500',
    text: 'text-red-400',
    ring: 'ring-red-500/25 bg-red-500/10',
    pulse: 'crux-pulse-red',
  },
  live: {
    label: 'Game live',
    dot: 'bg-primary',
    text: 'text-primary',
    ring: 'ring-primary/25 bg-primary/10',
    pulse: 'crux-pulse-gold',
  },
  idle: {
    label: 'Idle',
    dot: 'bg-zinc-500',
    text: 'text-zinc-400 dark:text-zinc-400',
    ring: 'ring-white/5 bg-white/[0.03] dark:bg-white/[0.03]',
  },
  saving: {
    label: 'Saving',
    dot: 'bg-sky-400',
    text: 'text-sky-400',
    ring: 'ring-sky-500/25 bg-sky-500/10',
    pulse: 'crux-pulse-gold',
  },
  error: {
    label: 'Error',
    dot: 'bg-red-500',
    text: 'text-red-400',
    ring: 'ring-red-500/30 bg-red-500/10',
  },
}

export function StatusPill({ variant, label, className }: Props) {
  const cfg = CONFIG[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 tracking-wide',
        cfg.ring,
        cfg.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot, cfg.pulse)} />
      {label ?? cfg.label}
    </span>
  )
}
