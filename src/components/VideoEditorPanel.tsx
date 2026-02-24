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

  // Reset state when the video source changes
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

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }, [speed])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    // #region agent log
    fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'play-debug',location:'VideoEditorPanel.tsx:togglePlay',message:'play button clicked',data:{paused:video.paused,readyState:video.readyState,networkState:video.networkState,currentTime:video.currentTime,duration:video.duration,seeking:video.seeking,ended:video.ended,error:video.error?.code},timestamp:Date.now(),hypothesisId:'H-E,H-F,H-H'})}).catch(()=>{});
    // #endregion
    if (video.paused) {
      video.play().then(() => {
        // #region agent log
        fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'play-debug',location:'VideoEditorPanel.tsx:togglePlay:playResolved',message:'play() promise resolved OK',data:{currentTime:video.currentTime,paused:video.paused},timestamp:Date.now(),hypothesisId:'H-E'})}).catch(()=>{});
        // #endregion
      }).catch((err: unknown) => {
        // #region agent log
        fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'play-debug',location:'VideoEditorPanel.tsx:togglePlay:playRejected',message:'play() promise REJECTED',data:{error:String(err),readyState:video.readyState,networkState:video.networkState,seeking:video.seeking},timestamp:Date.now(),hypothesisId:'H-E,H-G'})}).catch(()=>{});
        // #endregion
      })
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
    // #region agent log
    const seekableLen = video.seekable.length
    const seekableRanges = Array.from({length: seekableLen}, (_, i) => ({start: video.seekable.start(i), end: video.seekable.end(i)}))
    fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'post-fix',location:'VideoEditorPanel.tsx:handleTrackClick',message:'seek attempt',data:{targetTime:t,duration,seekableLen,seekableRanges,currentTimeBefore:video.currentTime,readyState:video.readyState,networkState:video.networkState},timestamp:Date.now(),hypothesisId:'H-A,H-C,H-D'})}).catch(()=>{});
    // #endregion
    video.currentTime = t
    // #region agent log
    setTimeout(() => {
      const v = videoRef.current
      if (v) fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'post-fix',location:'VideoEditorPanel.tsx:handleTrackClick:after50ms',message:'currentTime after seek',data:{targetTime:t,actualCurrentTime:v.currentTime,seekableLen:v.seekable.length,duration:v.duration},timestamp:Date.now(),hypothesisId:'H-A,H-D'})}).catch(()=>{})
    }, 50)
    // #endregion
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
    <div className="flex flex-col gap-3 h-full">
      {/* Video */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md bg-black min-h-0">
        {videoLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black z-10">
            <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-red-500 animate-spin" />
            <span className="text-xs text-zinc-500">Loading video…</span>
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
            // #region agent log
            const seekableLen = v.seekable.length
            const seekableRanges = Array.from({length: seekableLen}, (_, i) => ({start: v.seekable.start(i), end: v.seekable.end(i)}))
            fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'post-fix',location:'VideoEditorPanel.tsx:onDurationChange',message:'video metadata loaded',data:{duration:v.duration,seekableLen,seekableRanges,src},timestamp:Date.now(),hypothesisId:'H-A,H-B,H-D'})}).catch(()=>{});
            // #endregion
          }}
          onCanPlay={() => setVideoLoading(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onWaiting={(e) => {
            // #region agent log
            const v = e.currentTarget
            fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'play-debug',location:'VideoEditorPanel.tsx:onWaiting',message:'video waiting/stalled',data:{currentTime:v.currentTime,readyState:v.readyState,networkState:v.networkState,seeking:v.seeking},timestamp:Date.now(),hypothesisId:'H-F,H-H'})}).catch(()=>{});
            // #endregion
          }}
          onStalled={(e) => {
            // #region agent log
            const v = e.currentTarget
            fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'play-debug',location:'VideoEditorPanel.tsx:onStalled',message:'video stalled',data:{currentTime:v.currentTime,readyState:v.readyState,networkState:v.networkState},timestamp:Date.now(),hypothesisId:'H-F,H-G'})}).catch(()=>{});
            // #endregion
          }}
          onSeeked={(e) => {
            // #region agent log
            fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'post-fix',location:'VideoEditorPanel.tsx:onSeeked',message:'seeked event fired',data:{currentTime:e.currentTarget.currentTime},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{});
            // #endregion
          }}
          onError={(e) => {
            setVideoLoading(false)
            // #region agent log
            const v = e.currentTarget
            fetch('http://127.0.0.1:7262/ingest/54647385-c12e-4dfb-9096-56e77751ff86',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'35b4ac'},body:JSON.stringify({sessionId:'35b4ac',runId:'post-fix',location:'VideoEditorPanel.tsx:onError',message:'video error',data:{errorCode:v.error?.code,errorMessage:v.error?.message},timestamp:Date.now(),hypothesisId:'H-C'})}).catch(()=>{});
            // #endregion
          }}
        />
      </div>

      {/* Timeline */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-2.5 cursor-pointer rounded-full bg-zinc-300 select-none group dark:bg-zinc-700"
      >
        {/* Played region */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-red-500/70 pointer-events-none"
          style={{ width: `${pct(currentTime)}%` }}
        />

        {/* In/Out region highlight */}
        {inPct !== null && (
          <div
            className="absolute inset-y-0 bg-amber-400/35 pointer-events-none"
            style={{
              left: `${inPct}%`,
              width: outPct !== null ? `${outPct - inPct}%` : undefined,
              right: outPct !== null ? undefined : 0,
            }}
          />
        )}

        {/* In marker line */}
        {inPct !== null && (
          <div
            className="absolute inset-y-0 w-px bg-amber-400 pointer-events-none"
            style={{ left: `${inPct}%` }}
          />
        )}

        {/* Out marker line */}
        {outPct !== null && (
          <div
            className="absolute inset-y-0 w-px bg-amber-400 pointer-events-none"
            style={{ left: `${outPct}%` }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border border-zinc-400 pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"
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
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="Back to start"
        >
          <SkipBack size={14} />
        </button>

        <button
          onClick={togglePlay}
          className="rounded-full p-1.5 bg-zinc-300 text-zinc-800 hover:bg-zinc-400 transition-colors dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <span className="text-xs text-zinc-500 font-mono tabular-nums ml-1 dark:text-zinc-400">
          {formatSec(currentTime)}
          <span className="text-zinc-400 dark:text-zinc-600"> / {formatSec(duration)}</span>
        </span>

        <div className="flex-1" />

        {/* Speed presets */}
        <div className="flex items-center gap-0.5">
          {SPEED_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                'rounded px-1.5 py-1 text-[11px] font-mono transition-colors',
                speed === s
                  ? 'bg-red-500/20 text-red-500 ring-1 ring-red-500/30 dark:text-red-400'
                  : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Markers + Export */}
      <div className="flex items-center gap-2 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
        <button
          onClick={() => setInPoint(currentTime)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title="Set In point at current time"
        >
          <Scissors size={10} />
          In
        </button>

        <span
          className={cn(
            'font-mono text-[11px] min-w-[52px]',
            inPoint !== null ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-600',
          )}
        >
          {inPoint !== null ? formatSec(inPoint) : '—'}
        </span>

        <button
          onClick={() => setOutPoint(currentTime)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title="Set Out point at current time"
        >
          <Scissors size={10} className="scale-x-[-1]" />
          Out
        </button>

        <span
          className={cn(
            'font-mono text-[11px] min-w-[52px]',
            outPoint !== null ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-600',
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
            className="text-zinc-400 hover:text-zinc-600 transition-colors dark:text-zinc-600 dark:hover:text-zinc-400"
            title="Clear markers"
          >
            <X size={11} />
          </button>
        )}

        <div className="flex-1" />

        {/* Export button / status */}
        {exportStatus === 'idle' && (
          <button
            onClick={() => void handleExport()}
            disabled={!canExport}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-medium bg-red-500/15 text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Loader2 size={11} className="animate-spin" />
            Exporting…
          </span>
        )}

        {exportStatus === 'done' && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <CheckCircle2 size={11} />
            Exported!
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
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Retry
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
