import { app, desktopCapturer, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

import { formatTimestamp } from './utils'
import { getSummonerBundle, type PlatformRegion, type RiotProfileBundle } from './riotApi'
import { getCurrentSummonerFromClient, type CurrentSummonerPayload } from './lcuClient'

const require = createRequire(import.meta.url)
const ffmpeg = require('fluent-ffmpeg') as typeof import('fluent-ffmpeg')
const ffmpegStatic = require('ffmpeg-static') as string

// In a packaged Electron app the binary lives outside the ASAR archive.
const ffmpegBinaryPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegBinaryPath)

function getRecordingsDir() {
  return path.join(app.getPath('videos'), 'CruxRecordings')
}

/** Build the atempo filter chain; `atempo` only accepts 0.5–2.0 per node. */
function buildAtempoChain(speed: number): string {
  const nodes: string[] = []
  let remaining = speed

  if (speed >= 1) {
    while (remaining > 2.0 + 1e-9) {
      nodes.push('atempo=2.0')
      remaining /= 2.0
    }
    nodes.push(`atempo=${remaining.toFixed(6)}`)
  } else {
    while (remaining < 0.5 - 1e-9) {
      nodes.push('atempo=0.5')
      remaining /= 0.5
    }
    nodes.push(`atempo=${remaining.toFixed(6)}`)
  }

  return nodes.join(',')
}

type ExportParams = {
  sourcePath: string
  startSec?: number
  endSec?: number
  speedMultiplier?: number
}

type ExportResult = {
  success: boolean
  session?: { filename: string; path: string; size: number; createdAt: number }
  error?: string
}

/**
 * Remuxes a WebM file in-place via ffmpeg -c copy.
 * MediaRecorder writes a "streaming" WebM without a Cues (seek index) element
 * and with an invalid duration, making the file unseekable in all players.
 * A copy-remux rebuilds the container with proper seek tables and duration.
 */
function remuxForSeekability(filePath: string): Promise<void> {
  const dir = path.dirname(filePath)
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const tempPath = path.join(dir, `${base}_remux${ext}`)

  return new Promise<void>((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions(['-c', 'copy'])
      .output(tempPath)
      .on('error', async (err: Error) => {
        try { await fs.unlink(tempPath) } catch { /* ignore */ }
        reject(err)
      })
      .on('end', async () => {
        try {
          await fs.unlink(filePath)
          await fs.rename(tempPath, filePath)
          resolve()
        } catch (err) {
          reject(err)
        }
      })
      .run()
  })
}

function runFfmpegExport(params: ExportParams & { outputPath: string }): Promise<void> {
  const { sourcePath, startSec, endSec, speedMultiplier, outputPath } = params
  const speed = speedMultiplier ?? 1
  const hasSpeed = speed !== 1
  const hasTrim = startSec !== undefined || endSec !== undefined

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(sourcePath)

    if (hasTrim && !hasSpeed) {
      // Trim only — use copy codec for fast, lossless export
      if (startSec !== undefined) cmd = cmd.setStartTime(startSec)
      if (endSec !== undefined) {
        const duration =
          endSec - (startSec ?? 0)
        cmd = cmd.setDuration(duration)
      }
      cmd = cmd.outputOptions(['-c', 'copy'])
    } else {
      // Speed change (optionally with trim) — must re-encode
      if (startSec !== undefined) cmd = cmd.setStartTime(startSec)
      if (endSec !== undefined) {
        const duration = endSec - (startSec ?? 0)
        cmd = cmd.setDuration(duration)
      }

      if (hasSpeed) {
        const vFilter = `setpts=${(1 / speed).toFixed(6)}*PTS`
        const aFilter = buildAtempoChain(speed)
        cmd = cmd.videoFilter(vFilter).audioFilter(aFilter)
      }
    }

    cmd
      .output(outputPath)
      .on('error', (err: Error) => reject(err))
      .on('end', () => resolve())
      .run()
  })
}

export function registerIpcHandlers() {
  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
    }))
  })

  ipcMain.handle(
    'save-recording',
    async (_event, recordingBuffer: ArrayBuffer, limits: { maxCount: number; maxSizeGB: number }) => {
      const recordingsDir = getRecordingsDir()
      await fs.mkdir(recordingsDir, { recursive: true })

      const fileName = `crux-${formatTimestamp(new Date())}.webm`
      const filePath = path.join(recordingsDir, fileName)
      const data = Buffer.from(new Uint8Array(recordingBuffer))
      await fs.writeFile(filePath, data)

      // Remux to add seek index (Cues) and fix duration — MediaRecorder writes
      // a streaming WebM that is unseekable in all players without this step.
      try {
        await remuxForSeekability(filePath)
      } catch (err) {
        console.error('Remux failed, keeping original (file may be unseekable):', err)
      }

      const allFiles = await fs.readdir(recordingsDir)
      const recordings = await Promise.all(
        allFiles
          .filter((file) => file.endsWith('.webm'))
          .map(async (file) => {
            const fp = path.join(recordingsDir, file)
            const stats = await fs.stat(fp)
            return { path: fp, size: stats.size, createdAt: stats.birthtimeMs || stats.mtimeMs }
          }),
      )

      recordings.sort((a, b) => a.createdAt - b.createdAt)

      let totalSize = recordings.reduce((sum, r) => sum + r.size, 0)
      const maxSizeBytes = limits.maxSizeGB * 1024 * 1024 * 1024

      while (recordings.length > 0 && (recordings.length > limits.maxCount || totalSize > maxSizeBytes)) {
        const oldest = recordings.shift()!
        try {
          await fs.unlink(oldest.path)
          totalSize -= oldest.size
        } catch {
          // file may have already been removed
        }
      }

      return filePath
    },
  )

  ipcMain.handle('get-recordings', async () => {
    const recordingsDir = getRecordingsDir()

    try {
      await fs.access(recordingsDir)
    } catch {
      return []
    }

    const files = await fs.readdir(recordingsDir)
    const recordings = await Promise.all(
      files
        .filter((file) => file.endsWith('.webm'))
        .map(async (file) => {
          const filePath = path.join(recordingsDir, file)
          const stats = await fs.stat(filePath)
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtimeMs || stats.mtimeMs,
          }
        }),
    )

    return recordings.sort((a, b) => b.createdAt - a.createdAt)
  })

  ipcMain.handle('delete-recording', async (_event, filePath: string) => {
    try {
      await fs.unlink(filePath)
      return true
    } catch (error) {
      console.error('Failed to delete recording:', error)
      return false
    }
  })

  ipcMain.handle('riot-env-status', async (): Promise<{ hasEnvKey: boolean }> => {
    return { hasEnvKey: Boolean(process.env.RIOT_API_KEY?.trim()) }
  })

  ipcMain.handle(
    'lcu-get-current-summoner',
    async (): Promise<
      { success: true; data: CurrentSummonerPayload } | { success: false; error: string }
    > => {
      try {
        const data = await getCurrentSummonerFromClient()
        return { success: true, data }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    },
  )

  ipcMain.handle(
    'riot-get-summoner',
    async (
      _event,
      params: {
        platform: PlatformRegion
        gameName: string
        tagLine: string
        apiKey?: string
        matchCount?: number
      },
    ): Promise<
      { success: true; data: RiotProfileBundle } | { success: false; error: string; status?: number }
    > => {
      const { platform, gameName, tagLine, matchCount } = params

      // Prefer the renderer-provided key when present so users can override
      // whatever lives in .env without a restart. Fall back to the env var.
      const apiKey = params.apiKey?.trim() || process.env.RIOT_API_KEY?.trim() || ''

      if (!apiKey) {
        return { success: false, error: 'Missing Riot API key. Set RIOT_API_KEY in .env or enter one in Settings.' }
      }
      if (!gameName || !tagLine) {
        return { success: false, error: 'Missing Riot ID (gameName#tagLine).' }
      }

      try {
        const data = await getSummonerBundle(platform, gameName, tagLine, apiKey, matchCount ?? 5)
        return { success: true, data }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        const status =
          typeof err === 'object' && err !== null && 'status' in err
            ? Number((err as { status: number }).status)
            : undefined
        console.error('Riot API error:', message)
        return { success: false, error: message, status }
      }
    },
  )

  ipcMain.handle('export-recording', async (_event, params: ExportParams): Promise<ExportResult> => {
    const { sourcePath, startSec, endSec, speedMultiplier } = params

    // ── Security: restrict to recordings directory ──────────────────────────
    const recordingsDir = path.resolve(getRecordingsDir())
    const normalizedSource = path.resolve(sourcePath)

    if (!normalizedSource.startsWith(recordingsDir + path.sep) && normalizedSource !== recordingsDir) {
      return { success: false, error: 'Source file is outside the recordings directory.' }
    }

    // ── Validate speed ───────────────────────────────────────────────────────
    const speed = speedMultiplier ?? 1
    if (speed < 0.25 || speed > 16) {
      return { success: false, error: 'Speed must be between 0.25× and 16×.' }
    }

    // ── Validate trim range ─────────────────────────────────────────────────
    if (startSec !== undefined && startSec < 0) {
      return { success: false, error: 'Start time must be >= 0.' }
    }
    if (endSec !== undefined && startSec !== undefined && endSec <= startSec) {
      return { success: false, error: 'End time must be after start time.' }
    }

    // ── Confirm source file exists ───────────────────────────────────────────
    try {
      await fs.access(normalizedSource)
    } catch {
      return { success: false, error: 'Source recording not found.' }
    }

    const outputName = `crux-edit-${Date.now()}.webm`
    const outputPath = path.join(recordingsDir, outputName)

    try {
      await runFfmpegExport({
        sourcePath: normalizedSource,
        startSec,
        endSec,
        speedMultiplier: speed,
        outputPath,
      })

      const stats = await fs.stat(outputPath)
      return {
        success: true,
        session: {
          filename: outputName,
          path: outputPath,
          size: stats.size,
          createdAt: stats.birthtimeMs || stats.mtimeMs,
        },
      }
    } catch (err) {
      // Clean up partial output if it exists
      try {
        await fs.unlink(outputPath)
      } catch {
        // ignore
      }
      console.error('FFmpeg export error:', err)
      return { success: false, error: String(err) }
    }
  })
}
