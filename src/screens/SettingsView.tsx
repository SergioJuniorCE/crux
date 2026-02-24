import { Moon, Sun } from 'lucide-react'
import { FPS_OPTIONS, RESOLUTION_OPTIONS, type RecorderSettings, type ResolutionOption } from '../types/recorder'

type SettingsViewProps = {
  settings: RecorderSettings
  onSettingsChange: (updater: (current: RecorderSettings) => RecorderSettings) => void
  isDark: boolean
  onToggleDark: () => void
}

export function SettingsView({ settings, onSettingsChange, isDark, onToggleDark }: SettingsViewProps) {
  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Changes apply to the next recording session.</p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Resolution</span>
          <select
            className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
          <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Frame Rate</span>
          <select
            className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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

        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Dark Mode</p>
            <p className="text-xs text-zinc-500">Toggle between light and dark theme</p>
          </div>
          <button
            onClick={onToggleDark}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isDark ? 'bg-zinc-600' : 'bg-zinc-300'
            }`}
            role="switch"
            aria-checked={isDark}
          >
            <span
              className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform ${
                isDark ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            >
              {isDark ? (
                <Moon size={10} className="text-zinc-600" />
              ) : (
                <Sun size={10} className="text-amber-500" />
              )}
            </span>
          </button>
        </div>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Storage Limits</p>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Oldest recordings are automatically deleted when either limit is reached.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Max Videos</span>
              <input
                type="number"
                min={1}
                step={1}
                className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Max Size (GB)</span>
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
