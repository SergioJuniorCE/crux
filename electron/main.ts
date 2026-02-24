import { app, BrowserWindow, protocol, net } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { createGamePoller } from './gamePoller'
import { registerIpcHandlers } from './ipcHandlers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Must be called before app is ready so the scheme is treated as privileged,
// allowing the <video> element to issue HTTP range requests for streaming.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'crux',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

let win: BrowserWindow | null

function emitGameStatus(active: boolean) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('game-status', { active })
  }
}

const gamePoller = createGamePoller((active) => {
  emitGameStatus(active)
})

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  win.setMenu(null)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    win?.webContents.send('game-status', { active: gamePoller.getCurrentStatus() })
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    gamePoller.stop()
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  protocol.handle('crux', (request) => {
    const requestUrl = new URL(request.url);
    const queryPath = requestUrl.searchParams.get('path');
    const legacyRawPath = request.url.replace(/^crux:\/\//i, '');
    let decodedPath = queryPath ? decodeURIComponent(queryPath) : decodeURI(legacyRawPath);
    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decodedPath)) {
      decodedPath = decodedPath.slice(1);
    }
    const fileUrl = pathToFileURL(decodedPath).href;

    return net.fetch(fileUrl);
  })
  registerIpcHandlers()
  gamePoller.start()
  createWindow()
})
