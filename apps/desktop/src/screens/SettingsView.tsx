import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ExternalLink,
  HardDrive,
  Laptop,
  Loader2,
  Moon,
  Palette,
  Plus,
  Power,
  Server,
  Sparkles,
  Sun,
  Trash2,
  UserCircle2,
} from "lucide-react";

import {
  FPS_OPTIONS,
  RESOLUTION_OPTIONS,
  type RecorderDeviceProfile,
  type ResolutionOption,
  type FrameRateOption,
} from "../types/recorder";
import { Segmented } from "../components/Segmented";
import {
  PLATFORM_REGIONS,
  REGION_LABELS,
  type PlatformRegion,
} from "../types/riot";
import type { RiotSettings } from "../hooks/useRiotSettings";
import { cn } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";

type SettingsViewProps = {
  recorderProfiles: RecorderDeviceProfile[];
  activeRecorderProfileId: string;
  onActiveRecorderProfileChange: (profileId: string) => void;
  onRecorderProfileChange: (
    profileId: string,
    updater: (current: RecorderDeviceProfile) => RecorderDeviceProfile,
  ) => void;
  onAddRecorderProfile: () => string;
  onRemoveRecorderProfile: (profileId: string) => void;
  riotSettings: RiotSettings;
  onRiotSettingsChange: (
    updater: (current: RiotSettings) => RiotSettings,
  ) => void;
  /** Whether the backend reports having a Riot API key configured. */
  hasEnvRiotKey: boolean;
  isDark: boolean;
  onToggleDark: () => void;
};

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-start gap-3 border-b border-border pb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsView({
  recorderProfiles,
  activeRecorderProfileId,
  onActiveRecorderProfileChange,
  onRecorderProfileChange,
  onAddRecorderProfile,
  onRemoveRecorderProfile,
  riotSettings,
  onRiotSettingsChange,
  hasEnvRiotKey,
  isDark,
  onToggleDark,
}: SettingsViewProps) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detectSuccessAt, setDetectSuccessAt] = useState<number | null>(null);
  const [selectedRecorderProfileId, setSelectedRecorderProfileId] = useState(
    activeRecorderProfileId,
  );
  const selectedRecorderProfile =
    recorderProfiles.find(
      (profile) => profile.id === selectedRecorderProfileId,
    ) ??
    recorderProfiles.find((profile) => profile.id === activeRecorderProfileId) ??
    recorderProfiles[0];
  const selectedProfileIsActive =
    selectedRecorderProfile?.id === activeRecorderProfileId;
  const canRemoveSelectedProfile =
    Boolean(selectedRecorderProfile) && recorderProfiles.length > 1;

  const updateSelectedRecorderProfile = (
    updater: (current: RecorderDeviceProfile) => RecorderDeviceProfile,
  ) => {
    if (!selectedRecorderProfile) return;
    onRecorderProfileChange(selectedRecorderProfile.id, updater);
  };

  useErrorToast({
    error: detectError,
    title: "Could not detect League client",
  });

  const handleDetectFromClient = async () => {
    setDetecting(true);
    setDetectError(null);
    try {
      const result = await window.electronAPI.getCurrentSummonerFromClient();
      if (result.success) {
        const { summoner, platform } = result.data;
        onRiotSettingsChange((current) => ({
          ...current,
          gameName:
            summoner.gameName || summoner.displayName || current.gameName,
          tagLine: summoner.tagLine || current.tagLine,
          platform: platform ?? current.platform,
        }));
        setDetectSuccessAt(Date.now());
      } else {
        setDetectError(result.error);
      }
    } catch (err: unknown) {
      setDetectError(getErrorMessage(err));
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (!detectSuccessAt) return;
  }, [detectSuccessAt]);

  useEffect(() => {
    if (
      recorderProfiles.some(
        (profile) => profile.id === selectedRecorderProfileId,
      )
    ) {
      return;
    }

    setSelectedRecorderProfileId(activeRecorderProfileId);
  }, [activeRecorderProfileId, recorderProfiles, selectedRecorderProfileId]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes apply to the next recording session.
        </p>
      </div>

      {/* ── Backend ────────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Server size={15} />}
        title="Crux backend"
        description="The backend server handles Riot API requests and data caching."
      >
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Backend URL
            </span>
            <input
              type="text"
              placeholder="http://localhost:3001"
              autoComplete="off"
              spellCheck={false}
              className="rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={riotSettings.backendUrl}
              onChange={(event) =>
                onRiotSettingsChange((current) => ({
                  ...current,
                  backendUrl: event.target.value.trim(),
                }))
              }
            />
          </label>

          <div className="flex items-center gap-2 rounded-md bg-white/[0.03] px-3 py-2.5 text-xs">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                hasEnvRiotKey ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            {hasEnvRiotKey ? (
              <span className="text-emerald-300">
                API key configured — backend is ready to fetch Riot data.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Set{" "}
                <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">
                  RIOT_API_KEY
                </code>{" "}
                in{" "}
                <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">
                  packages/backend/.env
                </code>{" "}
                to enable Riot API access.
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Riot account ──────────────────────────────────────────────────── */}
      <SectionCard
        icon={<UserCircle2 size={15} />}
        title="Riot account"
        description="Used to fetch your summoner profile, rank, and match history."
      >
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-dashed border-border bg-background/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Detect from League client
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Reads your Riot ID and region directly from the running game
                  client.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDetectFromClient()}
                disabled={detecting}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {detecting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Detect
                  </>
                )}
              </button>
            </div>
            {detectError && (
              <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-300 ring-1 ring-red-500/20">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                <span className="break-words">{detectError}</span>
              </div>
            )}
            {!detectError && detectSuccessAt && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-emerald-500/5 px-2.5 py-1.5 text-[11px] text-emerald-300 ring-1 ring-emerald-500/20">
                <Check size={11} />
                Filled Riot ID and region from the active client.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Game name
              </span>
              <input
                type="text"
                placeholder="Faker"
                autoComplete="off"
                spellCheck={false}
                className="rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                value={riotSettings.gameName}
                onChange={(event) =>
                  onRiotSettingsChange((current) => ({
                    ...current,
                    gameName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Tagline
              </span>
              <div className="flex items-center rounded-md border border-border bg-background/50 pl-2 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                <span className="font-mono text-sm text-muted-foreground">
                  #
                </span>
                <input
                  type="text"
                  placeholder="KR1"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={5}
                  className="w-full rounded-md bg-transparent px-1 py-2 font-mono text-sm uppercase text-foreground outline-none"
                  value={riotSettings.tagLine}
                  onChange={(event) =>
                    onRiotSettingsChange((current) => ({
                      ...current,
                      tagLine: event.target.value.replace(/^#/, ""),
                    }))
                  }
                />
              </div>
            </label>
          </div>

          <FieldRow
            label="Region"
            hint="Your summoner's platform routing value"
          >
            <select
              className="rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={riotSettings.platform}
              onChange={(event) =>
                onRiotSettingsChange((current) => ({
                  ...current,
                  platform: event.target.value as PlatformRegion,
                }))
              }
            >
              {PLATFORM_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_LABELS[region]} ({region.toUpperCase()})
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Recorder devices ──────────────────────────────────────────────── */}
      <SectionCard
        icon={<Camera size={15} />}
        title="Recorder devices"
        description="Use a different recording profile on each computer."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              {recorderProfiles.map((profile) => {
                const selected = profile.id === selectedRecorderProfile?.id;
                const active = profile.id === activeRecorderProfileId;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedRecorderProfileId(profile.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                      selected
                        ? "border-primary/45 bg-primary/10"
                        : "border-border bg-background/30 hover:border-white/15",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        profile.enabled
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-white/[0.04] text-muted-foreground",
                      )}
                    >
                      <Laptop size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {profile.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {active ? "Active here" : "Saved profile"}
                        <span className="text-muted-foreground/40">·</span>
                        {profile.enabled ? "Recorder on" : "Recorder off"}
                      </span>
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  const id = onAddRecorderProfile();
                  setSelectedRecorderProfileId(id);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background/20 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Plus size={12} />
                Add device profile
              </button>
            </div>

            {selectedRecorderProfile && (
              <div className="rounded-lg border border-border bg-background/25 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Device name
                    </span>
                    <input
                      type="text"
                      value={selectedRecorderProfile.name}
                      onChange={(event) =>
                        updateSelectedRecorderProfile((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                  </label>

                  <div className="flex shrink-0 items-center gap-2">
                    {!selectedProfileIsActive && (
                      <button
                        type="button"
                        onClick={() =>
                          onActiveRecorderProfileChange(
                            selectedRecorderProfile.id,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        <Laptop size={12} />
                        Use here
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canRemoveSelectedProfile}
                      onClick={() => {
                        const removingId = selectedRecorderProfile.id;
                        onRemoveRecorderProfile(removingId);
                        const nextProfile = recorderProfiles.find(
                          (profile) => profile.id !== removingId,
                        );
                        if (nextProfile) {
                          setSelectedRecorderProfileId(nextProfile.id);
                        }
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Remove device profile"
                      aria-label="Remove device profile"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-4">
                  <FieldRow
                    label="Enable recorder"
                    hint={
                      selectedProfileIsActive
                        ? "When off, active League matches will not be captured on this device."
                        : "This applies when the profile is used on a device."
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedRecorderProfile((current) => ({
                          ...current,
                          enabled: !current.enabled,
                        }))
                      }
                      role="switch"
                      aria-checked={selectedRecorderProfile.enabled}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        selectedRecorderProfile.enabled
                          ? "bg-emerald-500"
                          : "bg-white/10",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-background shadow transition-transform",
                          selectedRecorderProfile.enabled
                            ? "translate-x-5"
                            : "translate-x-0.5",
                        )}
                      >
                        <Power size={10} className="text-foreground/80" />
                      </span>
                    </button>
                  </FieldRow>

                  <FieldRow label="Resolution" hint="Video output size">
                    <Segmented<ResolutionOption>
                      options={RESOLUTION_OPTIONS.map((r) => ({
                        value: r,
                        label: r,
                      }))}
                      value={selectedRecorderProfile.resolution}
                      onChange={(value) =>
                        updateSelectedRecorderProfile((current) => ({
                          ...current,
                          resolution: value,
                        }))
                      }
                    />
                  </FieldRow>

                  <FieldRow label="Frame rate" hint="Frames captured per second">
                    <Segmented<FrameRateOption>
                      options={FPS_OPTIONS.map((f) => ({
                        value: f,
                        label: `${f} fps`,
                      }))}
                      value={selectedRecorderProfile.frameRate}
                      onChange={(value) =>
                        updateSelectedRecorderProfile((current) => ({
                          ...current,
                          frameRate: value,
                        }))
                      }
                    />
                  </FieldRow>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Storage ───────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<HardDrive size={15} />}
        title="Storage"
        description="Oldest recordings are automatically deleted when either limit is reached."
      >
        {selectedRecorderProfile && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Max videos
              </span>
              <input
                type="number"
                min={1}
                step={1}
                className="rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-sm tabular-nums text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                value={selectedRecorderProfile.maxVideoCount}
                onChange={(event) => {
                  const value = Math.max(
                    1,
                    Math.floor(Number(event.target.value)),
                  );
                  if (!Number.isNaN(value)) {
                    updateSelectedRecorderProfile((current) => ({
                      ...current,
                      maxVideoCount: value,
                    }));
                  }
                }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Max size (GB)
              </span>
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-sm tabular-nums text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                value={selectedRecorderProfile.maxFolderSizeGB}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isNaN(value) && value > 0) {
                    updateSelectedRecorderProfile((current) => ({
                      ...current,
                      maxFolderSizeGB: value,
                    }));
                  }
                }}
              />
            </label>
          </div>
        )}
      </SectionCard>

      {/* ── Appearance ────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Palette size={15} />}
        title="Appearance"
        description="Switch between the dark and light surfaces."
      >
        <FieldRow label="Dark mode" hint="Recommended for recording sessions">
          <button
            type="button"
            onClick={onToggleDark}
            role="switch"
            aria-checked={isDark}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isDark ? "bg-primary" : "bg-white/10",
            )}
          >
            <span
              className={cn(
                "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-background shadow transition-transform",
                isDark ? "translate-x-5" : "translate-x-0.5",
              )}
            >
              {isDark ? (
                <Moon size={10} className="text-primary" />
              ) : (
                <Sun size={10} className="text-primary" />
              )}
            </span>
          </button>
        </FieldRow>
      </SectionCard>
    </div>
  );
}
