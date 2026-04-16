import { useCallback, useEffect, useMemo } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Header } from './components/Header'
import { RecorderView } from './screens/RecorderView'
import { SettingsView } from './screens/SettingsView'
import { SessionsView } from './screens/SessionsView'
import { ProfileView } from './screens/ProfileView'
import { useGameStatus } from './hooks/useGameStatus'
import { useLeagueRecorder } from './hooks/useLeagueRecorder'
import { useRecorderSettings } from './hooks/useRecorderSettings'
import { useRiotSettings, isRiotConfigured, type RiotSettings } from './hooks/useRiotSettings'
import { useRiotEnvStatus } from './hooks/useRiotEnvStatus'
import { useLcuCurrentSummoner } from './hooks/useLcuCurrentSummoner'
import { useSummoner } from './hooks/useSummoner'
import { useDarkMode } from './hooks/useDarkMode'

function App() {
  const gameActive = useGameStatus()
  const { settings, setSettings } = useRecorderSettings()
  const { settings: riotSettings, setSettings: setRiotSettings } = useRiotSettings()
  const { hasEnvKey } = useRiotEnvStatus()
  const lcu = useLcuCurrentSummoner({ pollMs: 30_000 })
  const { isDark, toggle: toggleDark } = useDarkMode()
  const { recordingState, elapsedSeconds, lastSavedPath, errorMessage, startRecording, stopRecording } =
    useLeagueRecorder(settings)

  // When the League client is running, prefer its identity over whatever
  // the user typed into Settings. The API key always comes from user
  // settings (or the RIOT_API_KEY env var in main).
  const effectiveRiotSettings = useMemo<RiotSettings>(() => {
    if (lcu.isLive && lcu.data) {
      return {
        ...riotSettings,
        gameName: lcu.data.summoner.gameName || lcu.data.summoner.displayName || riotSettings.gameName,
        tagLine: lcu.data.summoner.tagLine || riotSettings.tagLine,
        platform: lcu.data.platform ?? riotSettings.platform,
      }
    }
    return riotSettings
  }, [lcu.isLive, lcu.data, riotSettings])

  const summoner = useSummoner(effectiveRiotSettings, { matchCount: 15, hasEnvKey })
  const configured = isRiotConfigured(effectiveRiotSettings, { hasEnvKey })
  const location = useLocation()
  const navigate = useNavigate()

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

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <Header
        gameActive={gameActive}
        recordingState={recordingState}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div
          key={location.pathname}
          className="animate-in fade-in-50 slide-in-from-bottom-1 duration-300"
        >
          <Routes location={location}>
            <Route
              path="/"
              element={
                <ProfileView
                  status={summoner.status}
                  data={summoner.data}
                  error={summoner.error}
                  configured={configured}
                  platform={effectiveRiotSettings.platform}
                  clientLive={lcu.isLive}
                  isViewingOther={false}
                  ownIdentity={{
                    gameName: effectiveRiotSettings.gameName,
                    tagLine: effectiveRiotSettings.tagLine,
                  }}
                  onRefresh={() => {
                    void lcu.refetch()
                    void summoner.refetch()
                  }}
                  onOpenSettings={() => navigate('/settings')}
                  onSelectPlayer={(gameName, tagLine) => {
                    navigate(
                      `/profile/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
                    )
                  }}
                  onBackToOwn={() => navigate('/')}
                />
              }
            />
            <Route
              path="/recorder"
              element={
                <RecorderView
                  gameActive={gameActive}
                  recordingState={recordingState}
                  elapsedSeconds={elapsedSeconds}
                  lastSavedPath={lastSavedPath}
                  errorMessage={errorMessage}
                  settings={settings}
                  summonerStatus={summoner.status}
                  summonerData={summoner.data}
                  summonerError={summoner.error}
                  summonerConfigured={configured}
                  onRefreshSummoner={() => void summoner.refetch()}
                  onOpenRiotSettings={() => navigate('/settings')}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsView
                  settings={settings}
                  onSettingsChange={setSettings}
                  riotSettings={riotSettings}
                  onRiotSettingsChange={setRiotSettings}
                  hasEnvRiotKey={hasEnvKey}
                  isDark={isDark}
                  onToggleDark={toggleDark}
                />
              }
            />
            <Route
              path="/profile/:gameName/:tagLine"
              element={
                <OtherPlayerProfileRoute
                  baseSettings={effectiveRiotSettings}
                  hasEnvKey={hasEnvKey}
                  onOpenSettings={() => navigate('/settings')}
                  onSelectPlayer={(gameName, tagLine) => {
                    navigate(
                      `/profile/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
                    )
                  }}
                  onBackToOwn={() => navigate('/')}
                  ownIdentity={{
                    gameName: effectiveRiotSettings.gameName,
                    tagLine: effectiveRiotSettings.tagLine,
                  }}
                />
              }
            />
            <Route path="/sessions" element={<SessionsView />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App

type OtherPlayerProfileRouteProps = {
  baseSettings: RiotSettings
  hasEnvKey: boolean
  ownIdentity: { gameName: string; tagLine: string }
  onOpenSettings: () => void
  onSelectPlayer: (gameName: string, tagLine: string) => void
  onBackToOwn: () => void
}

/**
 * Renders someone else's Riot profile. Reuses our platform + API key from
 * the effective settings, but swaps in the Riot ID from the URL. A separate
 * `useSummoner` instance keeps this fetch independent from the user's own
 * profile so navigating between players doesn't clobber "my profile" cache.
 */
function OtherPlayerProfileRoute({
  baseSettings,
  hasEnvKey,
  ownIdentity,
  onOpenSettings,
  onSelectPlayer,
  onBackToOwn,
}: OtherPlayerProfileRouteProps) {
  const params = useParams<{ gameName: string; tagLine: string }>()
  const gameName = params.gameName ? decodeURIComponent(params.gameName) : ''
  const tagLine = params.tagLine ? decodeURIComponent(params.tagLine).replace(/^#/, '') : ''

  const targetSettings = useMemo<RiotSettings>(
    () => ({
      ...baseSettings,
      gameName,
      tagLine,
    }),
    [baseSettings, gameName, tagLine],
  )

  const summoner = useSummoner(targetSettings, { matchCount: 15, hasEnvKey })
  const configured = isRiotConfigured(targetSettings, { hasEnvKey })

  const refresh = useCallback(() => {
    void summoner.refetch()
  }, [summoner])

  return (
    <ProfileView
      status={summoner.status}
      data={summoner.data}
      error={summoner.error}
      configured={configured}
      platform={targetSettings.platform}
      clientLive={false}
      isViewingOther
      ownIdentity={ownIdentity}
      onRefresh={refresh}
      onOpenSettings={onOpenSettings}
      onSelectPlayer={onSelectPlayer}
      onBackToOwn={onBackToOwn}
    />
  )
}
