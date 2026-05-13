import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Gauge,
  HardDrive,
  Monitor,
  Power,
  Save,
  Square,
} from "lucide-react";

import type { RecorderSettings, RecordingState } from "../types/recorder";
import { StatCard } from "../components/StatCard";
import { SummonerCard } from "../components/SummonerCard";
import type { RecordingSession } from "../types/sessions";
import type { RiotProfileBundle } from "../types/riot";
import { useErrorToast } from "@/hooks/useErrorToast";
import { cn } from "@/lib/utils";

type RecorderViewProps = {
  gameActive: boolean;
  recordingState: RecordingState;
  elapsedSeconds: number;
  lastSavedPath: string | null;
  errorMessage: string | null;
  settings: RecorderSettings;
  summonerStatus: "idle" | "loading" | "success" | "error";
  summonerData: RiotProfileBundle | null;
  summonerError: string | null;
  summonerConfigured: boolean;
  onRefreshSummoner: () => void;
  onOpenRiotSettings: () => void;
  onStopRecording: () => void;
};

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function basename(p: string | null | undefined) {
  if (!p) return null;
  const norm = p.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i >= 0 ? norm.slice(i + 1) : norm;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function RecorderView({
  gameActive,
  recordingState,
  elapsedSeconds,
  lastSavedPath,
  errorMessage,
  settings,
  summonerStatus,
  summonerData,
  summonerError,
  summonerConfigured,
  onRefreshSummoner,
  onOpenRiotSettings,
  onStopRecording,
}: RecorderViewProps) {
  const isRecording = recordingState === "recording";
  const isSaving = recordingState === "saving";
  const recorderEnabled = settings.enabled;
  const heroLabel = !recorderEnabled
    ? "Recording disabled on this device"
    : isRecording
      ? "Recording active match"
      : isSaving
        ? "Saving last recording"
        : gameActive
          ? "Game detected"
          : "Waiting for a match";

  const heroSub = !recorderEnabled
    ? "This profile will skip match recording until you enable it in Settings."
    : isRecording
      ? "Capturing gameplay. Recording will stop and save automatically when the game ends."
      : isSaving
        ? "Encoding and writing the video file to disk."
        : gameActive
          ? "Client is in an active match. Starting capture shortly."
          : "Crux is listening. Start a League of Legends match to begin recording.";

  const dotClass = isRecording
    ? "bg-red-500 crux-pulse-red"
    : gameActive && recorderEnabled
      ? "bg-primary crux-pulse-gold"
      : "bg-zinc-500";

  const [stats, setStats] = useState<{ count: number; totalBytes: number }>({
    count: 0,
    totalBytes: 0,
  });

  useErrorToast({
    error: errorMessage,
    title: "Recorder error",
  });

  useErrorToast({
    error: summonerError,
    title: "Could not load recorder profile",
    enabled: summonerStatus === "error",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const recordings: RecordingSession[] =
          await window.electronAPI.getRecordings();
        if (cancelled) return;
        const totalBytes = recordings.reduce(
          (acc, r) => acc + (r.size ?? 0),
          0,
        );
        setStats({ count: recordings.length, totalBytes });
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [recordingState, lastSavedPath]);

  const lastSavedName = basename(lastSavedPath);

  return (
    <div className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px",
            isRecording
              ? "bg-red-500/60"
              : gameActive && recorderEnabled
                ? "bg-primary/60"
                : "bg-white/10",
          )}
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1.5 inline-block h-2.5 w-2.5 rounded-full",
                dotClass,
              )}
            />
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                {heroLabel}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {heroSub}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start sm:items-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Elapsed
            </span>
            <span
              className={cn(
                "mt-1 font-mono text-4xl font-semibold tabular-nums leading-none",
                isRecording ? "text-red-400" : "text-foreground/80",
              )}
            >
              {formatTimer(isRecording ? elapsedSeconds : 0)}
            </span>
            <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {recordingState === "idle" ? "standby" : recordingState}
            </span>
            {isRecording && (
              <button
                onClick={onStopRecording}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 active:bg-red-700"
              >
                <Square size={10} fill="currentColor" />
                Stop Recording
              </button>
            )}
          </div>
        </div>
      </section>

      <SummonerCard
        status={summonerStatus}
        data={summonerData}
        error={summonerError}
        configured={summonerConfigured}
        onRefresh={onRefreshSummoner}
        onGoToSettings={onOpenRiotSettings}
      />

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="Recorder"
          value={recorderEnabled ? "On" : "Off"}
          sub={recorderEnabled ? "Enabled here" : "Disabled here"}
          icon={<Power size={13} />}
          valueClassName={recorderEnabled ? "text-emerald-300" : "text-zinc-400"}
        />
        <StatCard
          label="Resolution"
          value={settings.resolution}
          sub="Capture size"
          icon={<Monitor size={13} />}
        />
        <StatCard
          label="Frame rate"
          value={`${settings.frameRate} fps`}
          sub="Capture FPS"
          icon={<Gauge size={13} />}
        />
        <StatCard
          label="Last save"
          value={lastSavedName ?? "—"}
          sub={lastSavedName ? "Most recent recording" : "No saves yet"}
          icon={<Save size={13} />}
          valueClassName="text-sm font-medium font-sans"
        />
        <StatCard
          label="Storage"
          value={formatBytes(stats.totalBytes)}
          sub={`${stats.count} ${stats.count === 1 ? "recording" : "recordings"}`}
          icon={<HardDrive size={13} />}
        />
      </div>

      {/* Info line */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock size={12} />
        <span>
          Recording only runs when this device profile is enabled and a League
          match is active.
        </span>
      </div>

      {lastSavedPath && recordingState === "saved" && (
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Saved to
          </div>
          <div className="mt-0.5 break-all font-mono text-[11px] text-foreground/80">
            {lastSavedPath}
          </div>
        </div>
      )}
    </div>
  );
}
