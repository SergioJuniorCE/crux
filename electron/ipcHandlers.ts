import { app, desktopCapturer, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

import { formatTimestamp } from './utils'

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

  ipcMain.handle('save-recording', async (_event, recordingBuffer: ArrayBuffer) => {
    const recordingsDir = path.join(app.getPath('videos'), 'CruxRecordings')
    await fs.mkdir(recordingsDir, { recursive: true })

    const fileName = `crux-${formatTimestamp(new Date())}.webm`
    const filePath = path.join(recordingsDir, fileName)
    const data = Buffer.from(new Uint8Array(recordingBuffer))
    await fs.writeFile(filePath, data)

    return filePath
  })

  ipcMain.handle('get-recordings', async () => {
    const recordingsDir = path.join(app.getPath('videos'), 'CruxRecordings')
    
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
        })
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
}
