import { useCallback, useEffect, useRef, useState } from 'react'

import type { RecorderSettings, RecordingState } from '../types/recorder'

export function useLeagueRecorder(settings: RecorderSettings) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      return
    }

    recorder.stop()
  }, [])

  const startRecording = useCallback(async () => {
    if (recorderRef.current?.state === 'recording') {
      return
    }

    try {
      setErrorMessage(null)
      setLastSavedPath(null)

      const sources = await window.electronAPI.getDesktopSources()
      const leagueSource = sources.find((source) => source.name.toLowerCase().includes('league of legends'))
      const fallbackSource = sources.find((source) => source.name.toLowerCase().includes('screen')) ?? sources[0]
      const targetSource = leagueSource ?? fallbackSource
      const [captureWidth, captureHeight] = settings.resolution.split('x').map((value) => Number(value))

      if (!targetSource) {
        throw new Error('No desktop source available to record.')
      }

      const captureSource = async (sourceId: string) => {
        const videoConstraints = {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: captureWidth,
            maxWidth: captureWidth,
            minHeight: captureHeight,
            maxHeight: captureHeight,
            maxFrameRate: settings.frameRate,
          },
        } as MediaTrackConstraints

        return navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
            },
          } as MediaTrackConstraints,
          video: videoConstraints,
        })
      }

      let stream = await captureSource(targetSource.id)

      // Some platforms do not provide system audio for window-level capture.
      if (stream.getAudioTracks().length === 0 && fallbackSource && fallbackSource.id !== targetSource.id) {
        stream.getTracks().forEach((track) => track.stop())
        stream = await captureSource(fallbackSource.id)
      }

      const preferredMimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ]
      const selectedMimeType = preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        try {
          setRecordingState('saving')
          clearTimer()

          const blob = new Blob(chunksRef.current, { type: selectedMimeType ?? 'video/webm' })
          const recordingBuffer = await blob.arrayBuffer()
          const savedPath = await window.electronAPI.saveRecording(recordingBuffer, {
            maxCount: settings.maxVideoCount,
            maxSizeGB: settings.maxFolderSizeGB,
          })
          setLastSavedPath(savedPath)
          setRecordingState('saved')
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to save recording.'
          setErrorMessage(message)
          setRecordingState('error')
        } finally {
          chunksRef.current = []
          recorderRef.current = null
          startedAtRef.current = null
          releaseStream()
          setElapsedSeconds(0)
        }
      }

      recorder.start(1000)
      setRecordingState('recording')
      setElapsedSeconds(0)
      startedAtRef.current = Date.now()
      clearTimer()
      timerRef.current = window.setInterval(() => {
        const startedAt = startedAtRef.current
        if (!startedAt) {
          return
        }

        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        setElapsedSeconds(elapsed)
      }, 1000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording.'
      setErrorMessage(message)
      setRecordingState('error')
      clearTimer()
      releaseStream()
    }
  }, [clearTimer, releaseStream, settings.frameRate, settings.maxFolderSizeGB, settings.maxVideoCount, settings.resolution])

  useEffect(() => {
    return () => {
      clearTimer()
      stopRecording()
      releaseStream()
    }
  }, [clearTimer, releaseStream, stopRecording])

  return {
    recordingState,
    elapsedSeconds,
    lastSavedPath,
    errorMessage,
    startRecording,
    stopRecording,
  }
}
