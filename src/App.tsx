import { useCallback, useEffect, useMemo } from "react";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { Header } from "./components/Header";
import { RecorderView } from "./screens/RecorderView";
import { SettingsView } from "./screens/SettingsView";
import { SessionsView } from "./screens/SessionsView";
import { ProfileView } from "./screens/ProfileView";
import { useGameStatus } from "./hooks/useGameStatus";
import { useLeagueRecorder } from "./hooks/useLeagueRecorder";
import { useRecorderSettings } from "./hooks/useRecorderSettings";
import {
  useRiotSettings,
  isRiotConfigured,
  type RiotSettings,
} from "./hooks/useRiotSettings";
import { useRiotEnvStatus } from "./hooks/useRiotEnvStatus";
import { useLcuCurrentSummoner } from "./hooks/useLcuCurrentSummoner";
import { useSummoner } from "./hooks/useSummoner";
import { useDarkMode } from "./hooks/useDarkMode";
import { PLATFORM_REGIONS, type PlatformRegion } from "./types/riot";
import { Toaster } from "./components/ui/sonner";

function App() {
  const gameActive = useGameStatus();
  const {
    settings,
    recorderProfiles,
    activeRecorderProfileId,
    setActiveRecorderProfileId,
    updateRecorderProfile,
    addRecorderProfile,
    removeRecorderProfile,
  } = useRecorderSettings();
  const { settings: riotSettings, setSettings: setRiotSettings } =
    useRiotSettings();
  const { hasEnvKey } = useRiotEnvStatus();
  const lcu = useLcuCurrentSummoner({ pollMs: 30_000 });
  const { isDark, toggle: toggleDark } = useDarkMode();
  const {
    recordingState,
    elapsedSeconds,
    lastSavedPath,
    errorMessage,
    startRecording,
    stopRecording,
  } = useLeagueRecorder(settings);

  // When the League client is running, prefer its identity over whatever
  // the user typed into Settings. The API key always comes from user
  // settings (or the RIOT_API_KEY env var in main).
  const lcuGameName = lcu.data?.summoner.gameName || lcu.data?.summoner.displayName;
  const lcuTagLine = lcu.data?.summoner.tagLine;
  const lcuPlatform = lcu.data?.platform;
  const effectiveRiotSettings = useMemo<RiotSettings>(() => {
    if (lcu.isLive) {
      return {
        ...riotSettings,
        gameName: lcuGameName || riotSettings.gameName,
        tagLine: lcuTagLine || riotSettings.tagLine,
        platform: lcuPlatform ?? riotSettings.platform,
      };
    }
    return riotSettings;
  }, [lcu.isLive, lcuGameName, lcuPlatform, lcuTagLine, riotSettings]);

  const summoner = useSummoner(effectiveRiotSettings, {
    matchCount: 15,
    hasEnvKey,
  });
  const configured = isRiotConfigured(effectiveRiotSettings, { hasEnvKey });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (gameActive && settings.enabled) {
      void startRecording();
      return;
    }

    stopRecording();
  }, [gameActive, settings.enabled, startRecording, stopRecording]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <Header
        gameActive={gameActive}
        recordingState={recordingState}
        isDark={isDark}
        activePlatform={effectiveRiotSettings.platform}
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
                  hasIdentity={Boolean(
                    effectiveRiotSettings.gameName.trim() &&
                    effectiveRiotSettings.tagLine.trim(),
                  )}
                  hasApiAccess={Boolean(
                    effectiveRiotSettings.apiKey.trim() || hasEnvKey,
                  )}
                  platform={effectiveRiotSettings.platform}
                  clientLive={lcu.isLive}
                  isViewingOther={false}
                  ownIdentity={{
                    gameName: effectiveRiotSettings.gameName,
                    tagLine: effectiveRiotSettings.tagLine,
                  }}
                  onRefresh={() => {
                    void lcu.refetch();
                    void summoner.refetch();
                  }}
                  onOpenSettings={() => navigate("/settings")}
                  onSelectPlayer={(gameName, tagLine) => {
                    navigate(
                      `/profile/${encodeURIComponent(effectiveRiotSettings.platform)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
                    );
                  }}
                  onBackToOwn={() => navigate("/")}
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
                  onOpenRiotSettings={() => navigate("/settings")}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsView
                  recorderProfiles={recorderProfiles}
                  activeRecorderProfileId={activeRecorderProfileId}
                  onActiveRecorderProfileChange={setActiveRecorderProfileId}
                  onRecorderProfileChange={updateRecorderProfile}
                  onAddRecorderProfile={addRecorderProfile}
                  onRemoveRecorderProfile={removeRecorderProfile}
                  riotSettings={riotSettings}
                  onRiotSettingsChange={setRiotSettings}
                  hasEnvRiotKey={hasEnvKey}
                  isDark={isDark}
                  onToggleDark={toggleDark}
                />
              }
            />
            <Route
              path="/profile/:platform/:gameName/:tagLine"
              element={
                <OtherPlayerProfileRoute
                  baseSettings={effectiveRiotSettings}
                  hasEnvKey={hasEnvKey}
                  onOpenSettings={() => navigate("/settings")}
                  onBackToOwn={() => navigate("/")}
                  ownIdentity={{
                    gameName: effectiveRiotSettings.gameName,
                    tagLine: effectiveRiotSettings.tagLine,
                  }}
                />
              }
            />
            <Route
              path="/profile/:gameName/:tagLine"
              element={
                <LegacyOtherPlayerProfileRedirect
                  baseSettings={effectiveRiotSettings}
                />
              }
            />
            <Route path="/sessions" element={<SessionsView />} />
          </Routes>
        </div>
      </main>
      <Toaster isDark={isDark} />
    </div>
  );
}

export default App;

type OtherPlayerProfileRouteProps = {
  baseSettings: RiotSettings;
  hasEnvKey: boolean;
  ownIdentity: { gameName: string; tagLine: string };
  onOpenSettings: () => void;
  onBackToOwn: () => void;
};

/**
 * Renders someone else's Riot profile. Reuses our API key from the effective
 * settings, but takes both platform + Riot ID from the URL so the page is
 * self-contained and doesn't silently depend on the signed-in user's shard.
 * A separate `useSummoner` instance keeps this fetch independent from the
 * user's own profile so navigating between players doesn't clobber "my
 * profile" cache.
 */
function OtherPlayerProfileRoute({
  baseSettings,
  hasEnvKey,
  ownIdentity,
  onOpenSettings,
  onBackToOwn,
}: OtherPlayerProfileRouteProps) {
  const navigate = useNavigate();
  const params = useParams<{
    platform: string;
    gameName: string;
    tagLine: string;
  }>();
  const routePlatform = isPlatformRegion(params.platform)
    ? params.platform
    : baseSettings.platform;
  const gameName = params.gameName ? decodeURIComponent(params.gameName) : "";
  const tagLine = params.tagLine
    ? decodeURIComponent(params.tagLine).replace(/^#/, "")
    : "";

  const targetSettings = useMemo<RiotSettings>(
    () => ({
      ...baseSettings,
      platform: routePlatform,
      gameName,
      tagLine,
    }),
    [baseSettings, routePlatform, gameName, tagLine],
  );

  const summoner = useSummoner(targetSettings, { matchCount: 15, hasEnvKey });
  const refetchSummoner = summoner.refetch;
  const configured = isRiotConfigured(targetSettings, { hasEnvKey });

  const refresh = useCallback(() => {
    void refetchSummoner();
  }, [refetchSummoner]);

  const handleSelectPlayer = useCallback(
    (nextGameName: string, nextTagLine: string) => {
      navigate(
        `/profile/${encodeURIComponent(routePlatform)}/${encodeURIComponent(nextGameName)}/${encodeURIComponent(nextTagLine)}`,
      );
    },
    [navigate, routePlatform],
  );

  return (
    <ProfileView
      status={summoner.status}
      data={summoner.data}
      error={summoner.error}
      configured={configured}
      hasIdentity={Boolean(gameName.trim() && tagLine.trim())}
      hasApiAccess={Boolean(targetSettings.apiKey.trim() || hasEnvKey)}
      platform={targetSettings.platform}
      clientLive={false}
      isViewingOther
      ownIdentity={ownIdentity}
      onRefresh={refresh}
      onOpenSettings={onOpenSettings}
      onSelectPlayer={handleSelectPlayer}
      onBackToOwn={onBackToOwn}
    />
  );
}

function LegacyOtherPlayerProfileRedirect({
  baseSettings,
}: {
  baseSettings: RiotSettings;
}) {
  const params = useParams<{ gameName: string; tagLine: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const gameName = params.gameName ? decodeURIComponent(params.gameName) : "";
    const tagLine = params.tagLine
      ? decodeURIComponent(params.tagLine).replace(/^#/, "")
      : "";

    if (!gameName || !tagLine) {
      navigate("/", { replace: true });
      return;
    }

    navigate(
      `/profile/${encodeURIComponent(baseSettings.platform)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { replace: true },
    );
  }, [baseSettings.platform, navigate, params.gameName, params.tagLine]);

  return null;
}

function isPlatformRegion(value: string | undefined): value is PlatformRegion {
  return Boolean(value && PLATFORM_REGIONS.includes(value as PlatformRegion));
}
