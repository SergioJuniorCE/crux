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
    <div className="flex h-[calc(100vh-96px)] gap-4">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <Film size={15} className="text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recordings
          </span>
        </div>

        {loading && (
          <p className="mt-4 text-center text-sm text-zinc-500">Loading...</p>
        )}

        {!loading && sessions.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500">
            <VideoOff size={32} />
            <p className="text-sm text-center">No recordings yet. Play a game to get started.</p>
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
              className={`group relative flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 transition-colors ${
                isActive
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Play size={11} className={isActive ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'} />
                <span className="truncate text-xs font-medium">{formatDate(session.createdAt)}</span>
                {isEdit && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-amber-600/70 bg-amber-400/10 px-1 rounded dark:text-amber-400/70">
                    edit
                  </span>
                )}
              </div>
              <span className="pl-4 text-[11px] text-zinc-400 dark:text-zinc-500">{formatTime(session.createdAt)}</span>
              <span className="pl-4 text-[11px] text-zinc-400 dark:text-zinc-500">{formatBytes(session.size)}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSessionToDelete(session)
                }}
                disabled={isDeleting}
                className="absolute right-2 top-2 hidden rounded p-1 text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-500 group-hover:flex disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                title="Delete recording"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </aside>

      {/* Player / Editor */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        {selected && videoSrc ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDate(selected.createdAt)} at {formatTime(selected.createdAt)}
                </p>
                <p className="text-xs text-zinc-500">
                  {selected.filename} &middot; {formatBytes(selected.size)}
                </p>
              </div>
            </div>

            <VideoEditorPanel
              src={videoSrc}
              filePath={selected.path}
              onExportDone={handleExportDone}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-600">
            <VideoOff size={48} />
            <p className="text-sm">Select a recording to watch</p>
          </div>
        )}
      </div>

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your recording.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deletingPath ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
