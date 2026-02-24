import { formatElapsed } from '../utils/format'
import type { RecordingState } from '../types/recorder'

type RecorderViewProps = {
  gameActive: boolean
  recordingState: RecordingState
  elapsedSeconds: number
  lastSavedPath: string | null
  errorMessage: string | null
  settingsSummary: string
}

export function RecorderView({
  gameActive,
  recordingState,
  elapsedSeconds,
  lastSavedPath,
  errorMessage,
  settingsSummary,
}: RecorderViewProps) {
  const statusText = gameActive ? 'Game detected' : 'Waiting for game...'

  return (
    <>
      <p className="mt-2 text-sm text-zinc-400">
        The app records only while an active match is detected. Opening the client alone does not start recording.
      </p>
      <p className="mt-2 text-sm text-zinc-400">Capture settings: {settingsSummary}</p>

      <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              recordingState === 'recording' ? 'bg-red-500' : gameActive ? 'bg-emerald-500' : 'bg-zinc-500'
            }`}
          />
          <p className="font-medium">{statusText}</p>
        </div>

        <p className="mt-3 text-sm text-zinc-300">
          Recorder status: <span className="font-medium capitalize">{recordingState === 'idle' ? 'idle' : recordingState}</span>
        </p>

        {recordingState === 'recording' && (
          <p className="mt-2 text-sm text-zinc-200">Recording time: {formatElapsed(elapsedSeconds)}</p>
        )}

        {recordingState === 'saving' && (
          <p className="mt-2 text-sm text-zinc-200">Saving recording to disk...</p>
        )}

        {lastSavedPath && recordingState === 'saved' && (
          <p className="mt-2 break-all text-sm text-zinc-200">Saved: {lastSavedPath}</p>
        )}

        {errorMessage && (
          <p className="mt-2 text-sm text-red-400">Error: {errorMessage}</p>
        )}
      </section>
    </>
  )
}
