import { cn } from '@/lib/utils'

export function Badge({
  label,
  icon,
  tone = 'default',
}: {
  label: string
  icon?: React.ReactNode
  tone?: 'default' | 'primary' | 'muted'
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary/10 text-primary ring-primary/25'
      : tone === 'muted'
        ? 'bg-white/[0.03] text-muted-foreground ring-white/5'
        : 'bg-white/[0.05] text-foreground/80 ring-white/10'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        toneClass,
      )}
    >
      {icon}
      {label}
    </span>
  )
}
