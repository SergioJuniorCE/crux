import { useCallback, useEffect, useState } from 'react'
import { Film, Play, Trash2, VideoOff } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { RecordingSession } from '../types/sessions'
import { VideoEditorPanel } from '../components/VideoEditorPanel'
import { cn } from '@/lib/utils'

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
  const [sessionToDelete, setSessionToDelete] = useState<RecordingSession | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const recordings = await window.electronAPI.getRecordings()
      setSessions(recordings)
      setSelected((prev) => prev ?? recordings[0] ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const handleDelete = async () => {
    if (!sessionToDelete) return

    setDeletingPath(sessionToDelete.path)
    try {
      await window.electronAPI.deleteRecording(sessionToDelete.path)
      const updated = sessions.filter((s) => s.path !== sessionToDelete.path)
      setSessions(updated)
      if (selected?.path === sessionToDelete.path) {
        setSelected(updated[0] ?? null)
      }
    } finally {
      setDeletingPath(null)
      setSessionToDelete(null)
    }
  }

  const handleExportDone = (newSession: RecordingSession) => {
    setSessions((prev) => [newSession, ...prev])
    setSelected(newSession)
  }

  const videoSrc = selected
    ? `crux://recording?path=${encodeURIComponent(selected.path)}`
    : undefined

  return (
    <div className="flex h-[calc(100vh-116px)] gap-4">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
          <div className="flex items-center gap-2">
            <Film size={14} className="text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Recordings
            </span>
          </div>
          <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-white/5 px-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {sessions.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {loading && (
            <p className="mt-4 text-center text-sm text-muted-foreground">Loading...</p>
          )}

          {!loading && sessions.length === 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 px-4 text-muted-foreground">
              <VideoOff size={28} />
              <p className="text-center text-xs leading-relaxed">
                No recordings yet. Play a League match to get started.
              </p>
            </div>
          )}

          {sessions.map((session) => {
            const isActive = selected?.path === session.path
            const isDeleting = deletingPath === session.path
            const isEdit = session.filename.startsWith('crux-edit-')
            return (
              <div
                key={session.path}
                onClick={() => setSelected(session)}
                className={cn(
                  'group relative cursor-pointer rounded-md px-3 py-2.5 transition-colors',
                  isActive
                    ? 'bg-white/[0.04] text-foreground'
                    : 'text-muted-foreground hover:bg-white/[0.02] hover:text-foreground',
                )}
              >
                {isActive && (
                  <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />
                )}

                <div className="flex items-center gap-1.5 pl-1">
                  <Play
                    size={10}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground/60',
                    )}
                  />
                  <span className="truncate text-[12px] font-medium text-foreground/90">
                    {formatDate(session.createdAt)}
                  </span>
                  {isEdit && (
                    <span className="ml-auto rounded bg-primary/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
                      edit
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 pl-[18px]">
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/80">
                    {formatTime(session.createdAt)}
                  </span>
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
                    {formatBytes(session.size)}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSessionToDelete(session)
                  }}
                  disabled={isDeleting}
                  className="absolute right-2 top-2 hidden rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-400 group-hover:flex disabled:opacity-40"
                  title="Delete recording"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {selected && videoSrc ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {formatDate(selected.createdAt)} &middot; {formatTime(selected.createdAt)}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {selected.filename} &middot; {formatBytes(selected.size)}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-4">
              <VideoEditorPanel
                src={videoSrc}
                filePath={selected.path}
                onExportDone={handleExportDone}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.03]">
              <VideoOff size={28} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground/80">No recording selected</p>
              <p className="mt-1 text-xs">
                Pick a session from the list to watch, trim, and export.
              </p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The video file will be permanently removed from disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deletingPath ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
