import https from 'node:https'

type StatusChangeCallback = (active: boolean) => void

export type GamePoller = {
  start: () => void
  stop: () => void
  getCurrentStatus: () => boolean
}

function checkLiveGameState(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname: '127.0.0.1',
        port: 2999,
        path: '/liveclientdata/allgamedata',
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 2000,
      },
      (response) => {
        response.resume()
        resolve(response.statusCode === 200)
      },
    )

    request.on('timeout', () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
    request.end()
  })
}

export function createGamePoller(onStatusChange: StatusChangeCallback): GamePoller {
  let pollInterval: NodeJS.Timeout | null = null
  let isGameActive = false

  async function pollGameStatus() {
    const active = await checkLiveGameState()
    if (active !== isGameActive) {
      isGameActive = active
      onStatusChange(active)
    }
  }

  return {
    start() {
      if (pollInterval) {
        return
      }

      void pollGameStatus()
      pollInterval = setInterval(() => {
        void pollGameStatus()
      }, 3000)
    },
    stop() {
      if (!pollInterval) {
        return
      }

      clearInterval(pollInterval)
      pollInterval = null
    },
    getCurrentStatus() {
      return isGameActive
    },
  }
}
