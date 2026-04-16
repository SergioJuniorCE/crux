import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Camera,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  Moon,
  Palette,
  Sparkles,
  Sun,
  UserCircle2,
} from 'lucide-react'

import {
  FPS_OPTIONS,
  RESOLUTION_OPTIONS,
  type RecorderSettings,
  type ResolutionOption,
  type FrameRateOption,
} from '../types/recorder'
import { Segmented } from '../components/Segmented'
import { PLATFORM_REGIONS, REGION_LABELS, type PlatformRegion } from '../types/riot'
import type { RiotSettings } from '../hooks/useRiotSettings'
import { cn } from '@/lib/utils'

type SettingsViewProps = {
  settings: RecorderSettings
  onSettingsChange: (updater: (current: RecorderSettings) => RecorderSettings) => void
  riotSettings: RiotSettings
  onRiotSettingsChange: (updater: (current: RiotSettings) => RiotSettings) => void
  hasEnvRiotKey: boolean
  isDark: boolean
  onToggleDark: () => void
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
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
  )
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsView({
  settings,
  onSettingsChange,
  riotSettings,
  onRiotSettingsChange,
  hasEnvRiotKey,
  isDark,
  onToggleDark,
}: SettingsViewProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const [detectSuccessAt, setDetectSuccessAt] = useState<number | null>(null)
  const hasUiKey = Boolean(riotSettings.apiKey)
  const envKeyActive = hasEnvRiotKey && !hasUiKey

  const handleDetectFromClient = async () => {
    setDetecting(true)
    setDetectError(null)
    try {
      const result = await window.electronAPI.getCurrentSummonerFromClient()
      if (result.success) {
        const { summoner, platform } = result.data
        onRiotSettingsChange((current) => ({
          ...current,
          gameName: summoner.gameName || summoner.displayName || current.gameName,
          tagLine: summoner.tagLine || current.tagLine,
          platform: platform ?? current.platform,
        }))
        setDetectSuccessAt(Date.now())
      } else {
        setDetectError(result.error)
      }
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : String(err))
    } finally {
      setDetecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes apply to the next recording session.
        </p>
      </div>

      <SectionCard
        icon={<UserCircle2 size={15} />}
        title="Riot account"
        description="Used to fetch your summoner profile, rank, and match history."
      >
        <div className="flex flex-col gap-5">
          {/* Auto-detect from running League client */}
          <div className="rounded-lg border border-dashed border-border bg-background/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Detect from League client</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Reads your Riot ID and region directly from the running game client — no API key needed.
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
                <span className="font-mono text-sm text-muted-foreground">#</span>
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
                      tagLine: event.target.value.replace(/^#/, ''),
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

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              API key
              {envKeyActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-semibold tracking-wide text-emerald-300 ring-1 ring-emerald-500/25">
                  <Check size={10} />
                  Loaded from .env
                </span>
              )}
              {hasUiKey && hasEnvRiotKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-semibold tracking-wide text-muted-foreground ring-1 ring-white/10">
                  Override active
                </span>
              )}
            </span>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 pr-1 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder={envKeyActive ? 'Using RIOT_API_KEY from .env' : 'RGAPI-...'}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                value={riotSettings.apiKey}
                onChange={(event) =>
                  onRiotSettingsChange((current) => ({
                    ...current,
                    apiKey: event.target.value.trim(),
                  }))
                }
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                title={showApiKey ? 'Hide API key' : 'Show API key'}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              {envKeyActive ? (
                <>
                  Using <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-foreground/80">RIOT_API_KEY</code>
                  from your <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-foreground/80">.env</code>.
                  Enter a key above to override.
                </>
              ) : (
                <>
                  Get a development key from the
                  <a
                    href="https://developer.riotgames.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Riot Developer Portal
                    <ExternalLink size={10} />
                  </a>
                  . Or set <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-foreground/80">RIOT_API_KEY</code> in a
                  <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[10.5px] text-foreground/80">.env</code> file at the project root.
                </>
              )}
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Camera size={15} />}
        title="Capture"
        description="Resolution and frame rate used when recording a match."
      >
        <div className="flex flex-col gap-5">
          <FieldRow label="Resolution" hint="Video output size">
            <Segmented<ResolutionOption>
              options={RESOLUTION_OPTIONS.map((r) => ({ value: r, label: r }))}
              value={settings.resolution}
              onChange={(value) =>
                onSettingsChange((current) => ({ ...current, resolution: value }))
              }
            />
          </FieldRow>

          <FieldRow label="Frame rate" hint="Frames captured per second">
            <Segmented<FrameRateOption>
              options={FPS_OPTIONS.map((f) => ({ value: f, label: `${f} fps` }))}
              value={settings.frameRate}
              onChange={(value) =>
                onSettingsChange((current) => ({ ...current, frameRate: value }))
              }
            />
          </FieldRow>
        </div>
      </SectionCard>

      <SectionCard
        icon={<HardDrive size={15} />}
        title="Storage"
        description="Oldest recordings are automatically deleted when either limit is reached."
      >
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
              value={settings.maxVideoCount}
              onChange={(event) => {
                const value = Math.max(1, Math.floor(Number(event.target.value)))
                if (!Number.isNaN(value)) {
                  onSettingsChange((current) => ({ ...current, maxVideoCount: value }))
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
              value={settings.maxFolderSizeGB}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isNaN(value) && value > 0) {
                  onSettingsChange((current) => ({ ...current, maxFolderSizeGB: value }))
                }
              }}
            />
          </label>
        </div>
      </SectionCard>

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
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              isDark ? 'bg-primary' : 'bg-white/10',
            )}
          >
            <span
              className={cn(
                'inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-background shadow transition-transform',
                isDark ? 'translate-x-5' : 'translate-x-0.5',
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
  )
}
