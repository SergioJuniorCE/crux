import { useRef, useState, useEffect } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  Scissors,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecordingSession } from '../types/sessions'

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4]

function formatSec(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00.0'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${String(sec).padStart(2, '0')}.${ms}`
}

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error'

type Props = {
  src: string
  filePath: string
  onExportDone?: (session: RecordingSession) => void
}

export function VideoEditorPanel({ src, filePath, onExportDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [inPoint, setInPoint] = useState<number | null>(null)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportError, setExportError] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setInPoint(null)
    setOutPoint(null)
    setExportStatus('idle')
    setExportError(null)
    setSpeed(1)

    setVideoLoading(true)

    const video = videoRef.current
    if (video) {
      video.load()
      video.playbackRate = 1
    }
  }, [src])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }, [speed])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current
    const video = videoRef.current
    if (!track || !video || !duration) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const t = ratio * duration
    video.currentTime = t
    setCurrentTime(t)
  }

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0)

  const inPct = inPoint !== null ? pct(inPoint) : null
  const outPct = outPoint !== null ? pct(outPoint) : null

  const canExport = inPoint !== null || outPoint !== null || speed !== 1

  const handleExport = async () => {
    if (!canExport) return
    setExportStatus('exporting')
    setExportError(null)

    try {
      const result = await window.electronAPI.exportRecording({
        sourcePath: filePath,
        startSec: inPoint ?? undefined,
        endSec: outPoint ?? undefined,
        speedMultiplier: speed !== 1 ? speed : undefined,
      })

      if (result.success && result.session) {
        setExportStatus('done')
        onExportDone?.(result.session)
      } else {
        setExportStatus('error')
        setExportError(result.error ?? 'Export failed')
      }
    } catch (err) {
      setExportStatus('error')
      setExportError(String(err))
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-black min-h-0 ring-1 ring-white/5">
        {videoLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
            <span className="text-xs text-muted-foreground">Loading video…</span>
          </div>
        )}
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-contain"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => {
            const v = e.currentTarget
            setDuration(v.duration)
          }}
          onCanPlay={() => setVideoLoading(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setVideoLoading(false)
          }}
        />
      </div>

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="group relative h-2.5 cursor-pointer select-none rounded-full bg-white/[0.08]"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary/80"
          style={{ width: `${pct(currentTime)}%` }}
        />

        {inPct !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 bg-primary/25"
            style={{
              left: `${inPct}%`,
              width: outPct !== null ? `${outPct - inPct}%` : undefined,
              right: outPct !== null ? undefined : 0,
            }}
          />
        )}

        {inPct !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-primary"
            style={{ left: `${inPct}%` }}
          />
        )}

        {outPct !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-primary"
            style={{ left: `${outPct}%` }}
          />
        )}

        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
          style={{ left: `${pct(currentTime)}%` }}
        />
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0
              setCurrentTime(0)
            }
          }}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
          title="Back to start"
        >
          <SkipBack size={14} />
        </button>

        <button
          onClick={togglePlay}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:brightness-110"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={13} /> : <Play size={13} className="translate-x-px" />}
        </button>

        <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="text-foreground/85">{formatSec(currentTime)}</span>
          <span className="text-muted-foreground/50"> / {formatSec(duration)}</span>
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background/30 p-0.5">
          {SPEED_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors',
                speed === s
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-2.5">
        <button
          onClick={() => setInPoint(currentTime)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          title="Set In point at current time"
        >
          <Scissors size={10} />
          In
        </button>

        <span
          className={cn(
            'min-w-[52px] font-mono text-[11px] tabular-nums',
            inPoint !== null ? 'text-primary' : 'text-muted-foreground/50',
          )}
        >
          {inPoint !== null ? formatSec(inPoint) : '—'}
        </span>

        <button
          onClick={() => setOutPoint(currentTime)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          title="Set Out point at current time"
        >
          <Scissors size={10} className="scale-x-[-1]" />
          Out
        </button>

        <span
          className={cn(
            'min-w-[52px] font-mono text-[11px] tabular-nums',
            outPoint !== null ? 'text-primary' : 'text-muted-foreground/50',
          )}
        >
          {outPoint !== null ? formatSec(outPoint) : '—'}
        </span>

        {(inPoint !== null || outPoint !== null) && (
          <button
            onClick={() => {
              setInPoint(null)
              setOutPoint(null)
            }}
            className="text-muted-foreground/60 transition-colors hover:text-foreground"
            title="Clear markers"
          >
            <X size={11} />
          </button>
        )}

        <div className="flex-1" />

        {exportStatus === 'idle' && (
          <button
            onClick={() => void handleExport()}
            disabled={!canExport}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-medium transition-colors',
              canExport
                ? 'bg-primary text-primary-foreground hover:brightness-110'
                : 'cursor-not-allowed bg-white/[0.04] text-muted-foreground/60',
            )}
            title={
              canExport
                ? 'Export edited clip as new recording'
                : 'Set In/Out markers or change speed to enable export'
            }
          >
            <Download size={11} />
            Export Edit
          </button>
        )}

        {exportStatus === 'exporting' && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 size={11} className="animate-spin" />
            Exporting…
          </span>
        )}

        {exportStatus === 'done' && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <CheckCircle2 size={11} />
            Exported
          </span>
        )}

        {exportStatus === 'error' && (
          <span className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle size={11} />
              {exportError ?? 'Export failed'}
            </span>
            <button
              onClick={() => setExportStatus('idle')}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Retry
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
