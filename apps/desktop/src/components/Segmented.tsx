import { cn } from '@/lib/utils'

type Option<T extends string | number> = {
  value: T
  label: string
}

type Props<T extends string | number> = {
  options: readonly Option<T>[] | readonly T[]
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}

function normalize<T extends string | number>(
  options: readonly Option<T>[] | readonly T[],
): Option<T>[] {
  return options.map((o) =>
    typeof o === 'object' && o !== null && 'value' in o
      ? (o as Option<T>)
      : ({ value: o as T, label: String(o) } as Option<T>),
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: Props<T>) {
  const opts = normalize<T>(options)
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-background/40 p-1',
        className,
      )}
    >
      {opts.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative rounded px-3 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              size === 'sm' ? 'py-1 text-[11px]' : 'py-1.5 text-xs',
              active
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
