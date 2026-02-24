import { useCallback, useEffect, useRef, useState } from 'react'
import { Film, Play, Trash2, VideoOff } from 'lucide-react'

import type { RecordingSession } from '../types/sessions'

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number) {
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(ms: number) {
  const d = new Date(ms)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function SessionsView() {
  const [sessions, setSessions] = useState<RecordingSession[]>([])
  const [selected, setSelected] = useState<RecordingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const recordings = await window.electronAPI.getRecordings()
      setSessions(recordings)
      if (recordings.length > 0 && !selected) {
        setSelected(recordings[0])
      }
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => {
    void loadSessions()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !selected) return
    video.load()
  }, [selected])

  const handleDelete = async (session: RecordingSession) => {
    setDeletingPath(session.path)
    try {
      await window.electronAPI.deleteRecording(session.path)
      const updated = sessions.filter((s) => s.path !== session.path)
      setSessions(updated)
      if (selected?.path === session.path) {
        setSelected(updated[0] ?? null)
      }
    } finally {
      setDeletingPath(null)
    }
  }

  const videoSrc = selected ? `crux://${selected.path}` : undefined

  return (
    <div className="flex h-[calc(100vh-96px)] gap-4">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Film size={15} className="text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recordings
          </span>
        </div>

        {loading && (
          <p className="mt-4 text-center text-sm text-zinc-500">Loading...</p>
        )}

        {!loading && sessions.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 text-zinc-500">
            <VideoOff size={32} />
            <p className="text-sm text-center">No recordings yet. Play a game to get started.</p>
          </div>
        )}

        {sessions.map((session) => {
          const isActive = selected?.path === session.path
          const isDeleting = deletingPath === session.path
          return (
            <div
              key={session.path}
              onClick={() => setSelected(session)}
              className={`group relative flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 transition-colors ${
                isActive
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Play size={11} className={isActive ? 'text-red-400' : 'text-zinc-500'} />
                <span className="truncate text-xs font-medium">{formatDate(session.createdAt)}</span>
              </div>
              <span className="pl-4 text-[11px] text-zinc-500">{formatTime(session.createdAt)}</span>
              <span className="pl-4 text-[11px] text-zinc-500">{formatBytes(session.size)}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDelete(session)
                }}
                disabled={isDeleting}
                className="absolute right-2 top-2 hidden rounded p-1 text-zinc-500 transition-colors hover:bg-red-900/40 hover:text-red-400 group-hover:flex disabled:opacity-40"
                title="Delete recording"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </aside>

      {/* Player */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        {selected ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {formatDate(selected.createdAt)} at {formatTime(selected.createdAt)}
                </p>
                <p className="text-xs text-zinc-500">{selected.filename} &middot; {formatBytes(selected.size)}</p>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-black">
              <video
                ref={videoRef}
                key={selected.path}
                src={videoSrc}
                controls
                autoPlay
                className="h-full w-full"
                style={{ maxHeight: '100%' }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-600">
            <VideoOff size={48} />
            <p className="text-sm">Select a recording to watch</p>
          </div>
        )}
      </div>
    </div>
  )
}
