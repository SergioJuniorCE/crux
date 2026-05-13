import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { AppSidebar } from "./components/AppSidebar";
import { TopBar } from "./components/TopBar";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "./components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import { RecorderView } from "./screens/RecorderView";
import { SettingsView } from "./screens/SettingsView";
import { SessionsView } from "./screens/SessionsView";
import { ProfileView } from "./screens/ProfileView";
import { ChampSelectView } from "./screens/ChampSelectView";
import { useGameStatus } from "./hooks/useGameStatus";
import { useChampSelectSession } from "./hooks/useChampSelectSession";
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

const SIDEBAR_WIDTH_STORAGE_KEY = "crux:sidebar-width";
const SIDEBAR_DEFAULT_WIDTH = 256;
const SIDEBAR_MIN_WIDTH = 208;
const SIDEBAR_MAX_WIDTH = 340;
const SIDEBAR_COLLAPSED_WIDTH = 48;

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));
}

function getInitialSidebarWidth() {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;

  const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  return Number.isFinite(saved)
    ? clampSidebarWidth(saved)
    : SIDEBAR_DEFAULT_WIDTH;
}

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
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
  const champSelect = useChampSelectSession();
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
  const lcuGameName =
    lcu.data?.summoner.gameName || lcu.data?.summoner.displayName;
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
    matchCount: 30,
    hasEnvKey,
  });
  const configured = isRiotConfigured(effectiveRiotSettings, { hasEnvKey });
  const location = useLocation();
  const navigate = useNavigate();
  const setResizableSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampSidebarWidth(width);
    setSidebarWidth(nextWidth);
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
  }, []);

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
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <ResizableAppLayout
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setResizableSidebarWidth}
        sidebar={
          <AppSidebar
            gameActive={gameActive}
            recordingState={recordingState}
            isDark={isDark}
            onToggleDark={toggleDark}
          />
        }
      >
        <SidebarInset className="max-h-svh overflow-y-auto bg-background text-foreground">
          <TopBar
            current={{
              gameName: effectiveRiotSettings.gameName,
              tagLine: effectiveRiotSettings.tagLine,
              platform: effectiveRiotSettings.platform,
              profileIconId: summoner.data?.summoner.profileIconId,
              dataDragonVersion: summoner.data?.dataDragonVersion,
            }}
            configured={configured}
            onSelectOwn={() => navigate("/")}
          />

          <main className="w-full flex-1 px-6 py-5">
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
                  path="/champ-select"
                  element={
                    <ChampSelectView
                      status={champSelect.status}
                      session={champSelect.data}
                      error={champSelect.error}
                      profileStatus={summoner.status}
                      profileData={summoner.data}
                      profileConfigured={configured}
                      onRefresh={() => {
                        void champSelect.refetch();
                        void summoner.refetch();
                      }}
                      onOpenSettings={() => navigate("/settings")}
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
        </SidebarInset>
      </ResizableAppLayout>
      <Toaster isDark={isDark} />
    </SidebarProvider>
  );
}

type ResizableAppLayoutProps = {
  sidebar: ReactNode;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  children: ReactNode;
};

function ResizableAppLayout({
  sidebar,
  sidebarWidth,
  onSidebarWidthChange,
  children,
}: ResizableAppLayoutProps) {
  const { isMobile, open, setOpen } = useSidebar();
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel || isMobile) return;

    if (open) {
      panel.resize(`${sidebarWidthRef.current}px`);
    } else {
      panel.collapse();
    }
  }, [isMobile, open]);

  if (isMobile) {
    return (
      <>
        {sidebar}
        {children}
      </>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      id="crux-app-layout"
      className="min-h-svh"
    >
      <ResizablePanel
        panelRef={sidebarPanelRef}
        id="app-sidebar"
        collapsible
        collapsedSize={`${SIDEBAR_COLLAPSED_WIDTH}px`}
        defaultSize={`${sidebarWidth}px`}
        groupResizeBehavior="preserve-pixel-size"
        minSize={`${SIDEBAR_MIN_WIDTH}px`}
        maxSize={`${SIDEBAR_MAX_WIDTH}px`}
        onResize={(size: PanelSize) => {
          if (size.inPixels <= SIDEBAR_COLLAPSED_WIDTH + 2) {
            if (open) setOpen(false);
            return;
          }

          if (!open) setOpen(true);
          onSidebarWidthChange(size.inPixels);
        }}
        className="overflow-visible"
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="z-20 bg-border/60 transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/70"
      />
      <ResizablePanel id="app-content" minSize="40%">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
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
