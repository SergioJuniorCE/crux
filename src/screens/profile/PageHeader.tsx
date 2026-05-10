import { ArrowLeft } from 'lucide-react'

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
    <div className="flex items-end justify-between gap-4">
      <div>
        {isViewingOther && onBackToOwn && (
          <button
            type="button"
            onClick={onBackToOwn}
            className="mb-1.5 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={11} />
            Back to my profile
          </button>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {isViewingOther ? 'Player profile' : 'Profile'}
        </h1>
      </div>
      {right}
    </div>
  )
}
