import { FPS_OPTIONS, RESOLUTION_OPTIONS, type RecorderSettings, type ResolutionOption } from '../types/recorder'

type SettingsViewProps = {
  settings: RecorderSettings
  onSettingsChange: (updater: (current: RecorderSettings) => RecorderSettings) => void
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  return (
    <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm text-zinc-300">Changes apply to the next recording session.</p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-200">Resolution</span>
          <select
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={settings.resolution}
            onChange={(event) => {
              onSettingsChange((current) => ({
                ...current,
                resolution: event.target.value as ResolutionOption,
              }))
            }}
          >
            {RESOLUTION_OPTIONS.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-200">Frame Rate</span>
          <select
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={settings.frameRate}
            onChange={(event) => {
              onSettingsChange((current) => ({
                ...current,
                frameRate: Number(event.target.value) as (typeof FPS_OPTIONS)[number],
              }))
            }}
          >
            {FPS_OPTIONS.map((fps) => (
              <option key={fps} value={fps}>
                {fps} FPS
              </option>
            ))}
          </select>
        </label>

        <div className="border-t border-zinc-800 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Storage Limits</p>
          <p className="mb-3 text-xs text-zinc-400">
            Oldest recordings are automatically deleted when either limit is reached.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-200">Max Videos</span>
              <input
                type="number"
                min={1}
                step={1}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={settings.maxVideoCount}
                onChange={(event) => {
                  const value = Math.max(1, Math.floor(Number(event.target.value)))
                  if (!Number.isNaN(value)) {
                    onSettingsChange((current) => ({ ...current, maxVideoCount: value }))
                  }
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-200">Max Size (GB)</span>
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
        </div>
      </div>
    </section>
  )
}
