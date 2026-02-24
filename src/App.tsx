import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'

import { Header } from './components/Header'
import { RecorderView } from './screens/RecorderView'
import { SettingsView } from './screens/SettingsView'
import { SessionsView } from './screens/SessionsView'
import { useGameStatus } from './hooks/useGameStatus'
import { useLeagueRecorder } from './hooks/useLeagueRecorder'
import { useRecorderSettings } from './hooks/useRecorderSettings'
import { useDarkMode } from './hooks/useDarkMode'

function App() {
  const gameActive = useGameStatus()
  const { settings, setSettings } = useRecorderSettings()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const { recordingState, elapsedSeconds, lastSavedPath, errorMessage, startRecording, stopRecording } =
    useLeagueRecorder(settings)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        window.location.reload()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (gameActive) {
      void startRecording()
      return
    }

    stopRecording()
  }, [gameActive, startRecording, stopRecording])

  const settingsSummary = `${settings.resolution} @ ${settings.frameRate} FPS`

  return (
    <main className="min-h-screen w-full bg-zinc-100 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Header />

      <Routes>
        <Route 
          path="/" 
          element={
            <RecorderView
              gameActive={gameActive}
              recordingState={recordingState}
              elapsedSeconds={elapsedSeconds}
              lastSavedPath={lastSavedPath}
              errorMessage={errorMessage}
              settingsSummary={settingsSummary}
            />
          } 
        />
        <Route 
          path="/settings" 
          element={
            <SettingsView settings={settings} onSettingsChange={setSettings} isDark={isDark} onToggleDark={toggleDark} />
          } 
        />
        <Route path="/sessions" element={<SessionsView />} />
      </Routes>
    </main>
  )
}

export default App
