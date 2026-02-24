import { NavLink } from 'react-router-dom'

export function Header() {
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <h1 className="text-2xl font-semibold">Crux</h1>
      <div className="flex gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `rounded-md px-3 py-1 text-sm ${
              isActive
                ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`
          }
          end
        >
          Recorder
        </NavLink>
        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            `rounded-md px-3 py-1 text-sm ${
              isActive
                ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`
          }
        >
          Sessions
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `rounded-md px-3 py-1 text-sm ${
              isActive
                ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`
          }
        >
          Settings
        </NavLink>
      </div>
    </div>
  )
}
